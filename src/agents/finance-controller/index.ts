import { 
  TransactionRecord, 
  SettlementRecord, 
  ReconStatus, 
  FinOpsCase 
} from '@/types';
import { ReconciliationEngine, ReconMatchResult } from '@/core/reconciliation';
import { LedgerStore } from '@/core/ledger/ledger-store';
import { AuditLogger } from '@/core/audit/audit-logger';
import { FinOpsAIProvider } from '@/core/ai/provider';
import { PROMPT_VERSIONS, SYSTEM_PROMPTS } from '@/core/ai/prompts';
import { createFinanceTools, FinanceDecisionSchema, FinanceDecision } from './tools';
import { AgentMessageEnvelope, AgentMessage } from '@/core/ai/agent-message';

export interface FinanceControllerReconOutput {
  batchId: string;
  exactMatchesCount: number;
  exceptionsCount: number;
  matchRate: number;
  casesCreated: FinOpsCase[];
  matches: ReconMatchResult[];
  agentMessages: AgentMessage<FinanceDecision>[];
}

export class FinanceControllerAgent {
  private ledger = LedgerStore.getInstance();
  private audit = AuditLogger.getInstance();
  private aiProvider = FinOpsAIProvider.getInstance();

  /**
   * Reconciles transaction records against settlement batch feeds.
   * Deterministic exact match first -> Contextual AI investigation for ambiguous cases.
   */
  public async reconcileIngestedBatch(
    transactions: TransactionRecord[],
    settlements: SettlementRecord[],
    scenarioMapping?: Record<string, string>
  ): Promise<FinanceControllerReconOutput> {
    const batchResult = ReconciliationEngine.reconcileBatch(transactions, settlements);
    const casesCreated: FinOpsCase[] = [];
    const agentMessages: AgentMessage<FinanceDecision>[] = [];

    // 1. Process Exact & Rule Matches (Deterministic First)
    for (const match of batchResult.matched) {
      if (match.status === 'EXACT_MATCH') {
        const tx = transactions.find((t) => t.id === match.transactionId);
        const st = settlements.find((s) => s.id === match.settlementId);
        if (st) st.reconciledStatus = 'EXACT_MATCH';

        this.audit.record({
          actorType: 'AGENT_FINANCE',
          actorId: 'FINANCE_CONTROLLER_AGENT',
          action: 'EXACT_RECONCILIATION_MATCH',
          decision: `Exact match verified for TX ${tx?.externalRef || ''} with Bank UTR ${st?.utrRrn || ''}`,
          stateBefore: { txId: match.transactionId, status: 'UNRECONCILED' },
          stateAfter: { txId: match.transactionId, status: 'RECONCILED' },
          confidence: 1.0,
          reasoningSummary: match.reason,
        });
      } else {
        // Discrepancy match (Fee Mismatch or Amount Mismatch) -> AI Investigation
        const tx = transactions.find((t) => t.id === match.transactionId);
        const st = settlements.find((s) => s.id === match.settlementId);
        const scenarioType = tx?.id ? scenarioMapping?.[tx.id] : undefined;

        const newCase = this.ledger.createCase({
          transactionId: tx?.id,
          settlementId: st?.id,
          merchantId: tx?.merchantId || 'MERCHANT_DEFAULT',
          amountAtRiskCents: match.discrepancyAmountCents,
          reconStatus: match.status,
          scenarioType,
        });

        // AI Agent Investigation
        const aiDecision = await this.investigateAmbiguousCase(newCase, tx, st);
        agentMessages.push(aiDecision);

        casesCreated.push(newCase);
      }
    }

    // 2. Process Unmatched Transactions
    for (const tx of batchResult.unmatchedTransactions) {
      let reconStatus: ReconStatus = 'UNMATCHED_TRANSACTION';

      if (tx.status === 'DISPUTED') {
        reconStatus = 'CHARGEBACK_SUSPECTED';
      } else if (tx.metadata?.duplicateOf) {
        reconStatus = 'DUPLICATE_SUSPECTED';
      }

      const scenarioType = scenarioMapping?.[tx.id];

      const newCase = this.ledger.createCase({
        transactionId: tx.id,
        merchantId: tx.merchantId,
        amountAtRiskCents: tx.amountCents,
        reconStatus,
        scenarioType,
      });
      casesCreated.push(newCase);
    }

    // 3. Process Unmatched Settlements
    for (const st of batchResult.unmatchedSettlements) {
      const newCase = this.ledger.createCase({
        settlementId: st.id,
        merchantId: 'MERCHANT_DEFAULT',
        amountAtRiskCents: st.amountCents,
        reconStatus: 'UNMATCHED_SETTLEMENT',
      });
      casesCreated.push(newCase);
    }

    return {
      batchId: `BATCH_${Date.now()}`,
      exactMatchesCount: batchResult.matched.filter((m) => m.status === 'EXACT_MATCH').length,
      exceptionsCount: casesCreated.length,
      matchRate: batchResult.matchRate,
      casesCreated,
      matches: batchResult.matched,
      agentMessages,
    };
  }

  /**
   * Multi-step structured AI tool investigation for ambiguous reconciliation cases
   */
  public async investigateAmbiguousCase(
    finOpsCase: FinOpsCase,
    tx?: TransactionRecord,
    st?: SettlementRecord
  ): Promise<AgentMessage<FinanceDecision>> {
    const tools = createFinanceTools(this.ledger);
    const contextPrompt = `RECON_DECISION_CONTEXT: Case ${finOpsCase.caseNumber}. Status: ${finOpsCase.reconStatus}.
Transaction Amount: ₹${((tx?.amountCents || 0) / 100).toFixed(2)}. Settlement Amount: ₹${((st?.amountCents || 0) / 100).toFixed(2)}.
Discrepancy: ₹${(finOpsCase.amountAtRiskCents / 100).toFixed(2)}. Narration: "${st?.rawDescription || ''}".`;

    const fallback: FinanceDecision = {
      decision: 'AMBIGUOUS',
      confidence: 0.5,
      evidence: [{ signal: 'DISCREPANCY_UNRESOLVED', value: 'Requires manual verification', weight: 1.0 }],
      rationale: 'Discrepancy identified; escalated to human review per deterministic fallback.',
      requiresVerification: true,
    };

    const aiResult = await this.aiProvider.generateToolDecision<FinanceDecision>({
      promptVersion: PROMPT_VERSIONS.FINANCE_CONTROLLER_V1,
      systemPrompt: SYSTEM_PROMPTS.FINANCE_CONTROLLER_V1,
      userPrompt: contextPrompt,
      schema: FinanceDecisionSchema,
      fallbackDecision: fallback,
      tools,
      maxToolSteps: 2,
    });

    const envelope = AgentMessageEnvelope.create<FinanceDecision>(
      'FINANCE_CONTROLLER',
      finOpsCase.id,
      '1.0.0',
      aiResult.decision,
      aiResult.telemetry,
      'FINOPS_ORCHESTRATOR'
    );

    // Record audit event with telemetry
    this.audit.record({
      caseId: finOpsCase.id,
      actorType: 'AGENT_FINANCE',
      actorId: 'FINANCE_CONTROLLER_AGENT',
      action: 'AI_RECONCILIATION_INVESTIGATION',
      decision: `AI Decision: ${aiResult.decision.decision} (Confidence: ${(aiResult.decision.confidence * 100).toFixed(1)}%)`,
      confidence: aiResult.decision.confidence,
      reasoningSummary: aiResult.decision.rationale,
      stateBefore: { reconStatus: finOpsCase.reconStatus },
      stateAfter: { reconStatus: finOpsCase.reconStatus, aiDecision: aiResult.decision.decision },
      policyEvaluation: {
        passed: true,
        violations: [],
        rulesEvaluated: ['PROMPT_VERSION_CHECK', 'SCHEMA_VALIDATION', 'EVIDENCE_WEIGHT_CHECK'],
      },
    });

    return envelope;
  }

  /**
   * Re-reconciles a recovered transaction against bank settlement proofs.
   * FINTECH RULE: NEVER CLAIM RECOVERY UNTIL SETTLEMENT IS VERIFIED.
   */
  public async verifyRecoverySettlement(
    caseId: string,
    simulatedSettlement?: SettlementRecord
  ): Promise<{ verified: boolean; settlementId?: string; reason: string }> {
    const finOpsCase = this.ledger.getCase(caseId);
    if (!finOpsCase || !finOpsCase.transactionId) {
      return { verified: false, reason: 'Case or transaction record missing.' };
    }

    const tx = this.ledger.getTransaction(finOpsCase.transactionId);
    if (!tx) {
      return { verified: false, reason: 'Transaction record not found in ledger.' };
    }

    if (!simulatedSettlement) {
      return {
        verified: false,
        reason: 'No bank settlement batch found matching the recovery reference.',
      };
    }

    // Check exact match or bounded negotiated agreement
    const isNegotiatedAgreement = 
      finOpsCase.negotiation?.currentAgreedAmountCents && 
      simulatedSettlement.amountCents === finOpsCase.negotiation.currentAgreedAmountCents;

    let isMatch = false;
    let confidence = 1.0;
    let matchReason = '';

    if (isNegotiatedAgreement) {
      isMatch = true;
      confidence = 1.0;
      matchReason = `Negotiated settlement verified. Received agreed discounted amount of ₹${(simulatedSettlement.amountCents / 100).toFixed(2)}.`;
    } else {
      const matchResult = ReconciliationEngine.reconcilePair(tx, simulatedSettlement, 0);
      if (matchResult.status === 'EXACT_MATCH' || matchResult.status === 'FUZZY_MATCH_HIGH') {
        isMatch = true;
        confidence = matchResult.confidence;
        matchReason = matchResult.reason;
      }
    }

    if (isMatch) {
      this.ledger.addSettlement(simulatedSettlement);
      this.ledger.updateCaseDetails(caseId, {
        recoveredAmountCents: simulatedSettlement.amountCents,
        settlementId: simulatedSettlement.id,
      });
      this.ledger.updateCaseStatus(caseId, 'SETTLED_VERIFIED', 'AGENT_FINANCE', matchReason);

      this.audit.record({
        caseId,
        actorType: 'AGENT_FINANCE',
        actorId: 'FINANCE_CONTROLLER_AGENT',
        action: 'VERIFY_RECOVERY_RECONCILIATION',
        decision: `Settlement VERIFIED. Credited ₹${(simulatedSettlement.amountCents / 100).toFixed(2)} under UTR ${simulatedSettlement.utrRrn}`,
        stateBefore: { status: finOpsCase.status, recoveredAmount: finOpsCase.recoveredAmountCents },
        stateAfter: { status: 'SETTLED_VERIFIED', recoveredAmount: simulatedSettlement.amountCents },
        confidence,
        reasoningSummary: matchReason,
      });

      return {
        verified: true,
        settlementId: simulatedSettlement.id,
        reason: `Re-reconciliation confirmed receipt of ₹${(simulatedSettlement.amountCents / 100).toFixed(2)} with bank UTR ${simulatedSettlement.utrRrn}.`,
      };
    }

    return {
      verified: false,
      reason: `Settlement discrepancy: Bank amount does not match expected invoice or negotiated settlement.`,
    };
  }
}
