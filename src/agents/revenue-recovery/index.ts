import { 
  FinOpsCase, 
  RecoveryActionType, 
  RecoveryActionRecord, 
  RecoveryChannel,
  CustomerResponseType,
  NegotiationRoundRecord
} from '@/types';
import { LedgerStore } from '@/core/ledger/ledger-store';
import { PolicyEngine } from '@/core/policy-engine';
import { AuditLogger } from '@/core/audit/audit-logger';
import { FinOpsAIProvider } from '@/core/ai/provider';
import { PROMPT_VERSIONS, SYSTEM_PROMPTS } from '@/core/ai/prompts';
import { createRecoveryTools, RecoveryDecisionSchema, RecoveryDecision } from './tools';
import { AgentMessageEnvelope, AgentMessage } from '@/core/ai/agent-message';
import { MessagingProviderFactory } from '@/core/messaging-provider';

export class RevenueRecoveryAgent {
  private ledger = LedgerStore.getInstance();
  private policyEngine = PolicyEngine.getInstance();
  private audit = AuditLogger.getInstance();
  private aiProvider = FinOpsAIProvider.getInstance();
  private messaging = MessagingProviderFactory.getSimulationAdapter();

  /**
   * Evaluates and dispatches an adaptive recovery or bounded negotiation strategy.
   * STRICT BOUNDARY: LLM Proposes -> Code Enforces -> Ledger Stores.
   */
  public async executeRecovery(
    caseId: string,
    forcedActionType?: RecoveryActionType,
    customerInputMessage?: string
  ): Promise<{
    actionRecord: RecoveryActionRecord;
    policyPassed: boolean;
    policyViolations: string[];
    executionStatus: RecoveryActionRecord['executionStatus'];
    message: string;
    agentMessage: AgentMessage<RecoveryDecision>;
  }> {
    const finOpsCase = this.ledger.getCase(caseId);
    if (!finOpsCase) {
      throw new Error(`Case ${caseId} not found`);
    }

    const tx = finOpsCase.transactionId ? this.ledger.getTransaction(finOpsCase.transactionId) : undefined;
    const currentRound = finOpsCase.negotiation?.currentRound ?? 1;

    // 1. Sanitize untrusted customer message (PROMPT INJECTION DEFENSE)
    const sanitizedCustomerInput = customerInputMessage
      ? customerInputMessage.replace(/[\{\}\[\]"'\\]/g, '').substring(0, 200)
      : undefined;

    // 2. AI Strategy Formulation
    let actionType: RecoveryActionType = forcedActionType || 'SEND_PAYMENT_LINK';
    let channel: RecoveryChannel = 'WHATSAPP';
    let discountBps = (forcedActionType === 'BOUNDED_NEGOTIATE' || forcedActionType === 'OFFER_BOUNDED_DISCOUNT') ? 1000 : 0;
    let strategyReasoning = '';
    let expectedOutcome = 'Recover funds via customer prompt';
    let agentMessage: AgentMessage<RecoveryDecision>;

    const isHighRisk = finOpsCase.riskClassification === 'CRITICAL_FRAUD' || (finOpsCase.riskScore ?? 0) >= 70;

    if (isHighRisk) {
      actionType = 'STOP_RECOVERY';
      channel = 'PORTAL';
      strategyReasoning = 'Risk triage flagged critical fraud vector. Automated recovery is prohibited.';
      expectedOutcome = 'Halt recovery per safety policy';

      agentMessage = AgentMessageEnvelope.create<RecoveryDecision>(
        'REVENUE_RECOVERY',
        caseId,
        '1.0.0',
        {
          actionType: 'STOP_RECOVERY',
          channel: 'PORTAL',
          discountBps: 0,
          delaySeconds: 0,
          confidence: 0.99,
          rationale: strategyReasoning,
          expectedOutcome,
        }
      );
    } else if (!forcedActionType) {
      const tools = createRecoveryTools(this.ledger);

      // Adaptive Context Extraction
      let contextTag = 'RECOVERY_DECISION_CONTEXT: ';
      if (finOpsCase.retryCount >= 1 && tx?.errorCode === 'GATEWAY_TIMEOUT_504') {
        contextTag += 'REPEATED_GATEWAY_FAILURE_SWITCH_TO_LINK ';
      } else if (tx?.customerSegment === 'ENTERPRISE' && (tx.daysOverdue ?? 0) > 30 && finOpsCase.amountAtRiskCents >= 1000000) {
        contextTag += 'ELIGIBLE_B2B_NEGOTIATION ';
      } else if (finOpsCase.scenarioType === 'ABANDONED_CHECKOUT') {
        contextTag += 'ABANDONED_CHECKOUT ';
      } else if (tx?.paymentMethod === 'AUTOPAY' || finOpsCase.scenarioType === 'FAILED_RECURRING_SUBSCRIPTION') {
        contextTag += 'AUTOPAY SUBSCRIPTION ';
      }

      if (sanitizedCustomerInput) {
        contextTag += `CUSTOMER_MSG: "${sanitizedCustomerInput}" `;
      }

      const userPrompt = `${contextTag} Case ${finOpsCase.caseNumber}. Amount: ₹${(finOpsCase.amountAtRiskCents / 100).toFixed(2)}.
RiskScore: ${finOpsCase.riskScore ?? 20}. RetryCount: ${finOpsCase.retryCount}. Error: "${tx?.errorCode || ''}". Round: ${currentRound}.`;

      const fallback: RecoveryDecision = {
        actionType: 'STOP_RECOVERY',
        channel: 'PORTAL',
        discountBps: 0,
        delaySeconds: 0,
        confidence: 0.5,
        rationale: 'Fallback safe strategy triggered; halting automated recovery.',
        expectedOutcome: 'Halt recovery per safety policy',
      };

      const aiResult = await this.aiProvider.generateToolDecision<RecoveryDecision>({
        promptVersion: PROMPT_VERSIONS.REVENUE_RECOVERY_V1,
        systemPrompt: SYSTEM_PROMPTS.REVENUE_RECOVERY_V1,
        userPrompt,
        schema: RecoveryDecisionSchema,
        fallbackDecision: fallback,
        tools,
        maxToolSteps: 2,
      });

      actionType = aiResult.decision.actionType as RecoveryActionType;
      channel = aiResult.decision.channel as RecoveryChannel;
      discountBps = aiResult.decision.discountBps;
      strategyReasoning = aiResult.decision.rationale;
      expectedOutcome = aiResult.decision.expectedOutcome || 'Recovery action dispatched';

      agentMessage = AgentMessageEnvelope.create<RecoveryDecision>(
        'REVENUE_RECOVERY',
        caseId,
        '1.0.0',
        aiResult.decision,
        aiResult.telemetry,
        'POLICY_ENGINE'
      );
    } else {
      agentMessage = AgentMessageEnvelope.create<RecoveryDecision>(
        'REVENUE_RECOVERY',
        caseId,
        '1.0.0',
        {
          actionType: forcedActionType as any,
          channel: 'WHATSAPP',
          discountBps,
          delaySeconds: 0,
          confidence: 1.0,
          rationale: `Forced manual action: ${forcedActionType}`,
          expectedOutcome: 'Manual operator action',
        }
      );
    }

    // 3. Deterministic Policy Gate Evaluation (CODE ENFORCES)
    const policyResult = this.policyEngine.evaluateRecoveryAction({
      finOpsCase,
      actionType,
      channel,
      discountOfferedBps: discountBps,
      riskScore: finOpsCase.riskScore,
      riskClassification: finOpsCase.riskClassification,
      negotiationRound: currentRound,
    });

    const actionId = `act_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    let executionStatus: RecoveryActionRecord['executionStatus'] = 'PENDING_POLICY';
    let executionResult: RecoveryActionRecord['executionResult'];

    if (actionType === 'STOP_RECOVERY' || isHighRisk) {
      executionStatus = 'BLOCKED_POLICY';
      this.ledger.updateCaseStatus(caseId, 'RISK_BLOCKED', 'AGENT_RECOVERY', strategyReasoning);
      executionResult = { message: 'Recovery halted per risk assessment.' };
    } else if (!policyResult.passed) {
      executionStatus = 'BLOCKED_POLICY';
      this.ledger.updateCaseStatus(
        caseId,
        policyResult.requiresHumanApproval ? 'HUMAN_REVIEW_REQUIRED' : 'CLOSED_UNRESOLVED',
        'AGENT_RECOVERY',
        policyResult.reason
      );
      executionResult = { message: `Blocked by policy: ${policyResult.violations.join('; ')}` };
    } else if (policyResult.requiresHumanApproval) {
      executionStatus = 'PENDING_POLICY';
      this.ledger.updateCaseStatus(caseId, 'HUMAN_REVIEW_REQUIRED', 'AGENT_RECOVERY', policyResult.reason);
      executionResult = { message: 'Action flagged for human operator review.' };
    } else {
      // Policy Passed -> Execute bounded recovery side effect
      executionStatus = 'EXECUTED';
      const effectiveDiscount = policyResult.clampedDiscountBps ?? discountBps;

      // Simulate customer response dynamics
      let customerResponse: CustomerResponseType = 'ACCEPT';
      let counterAmountCents: number | undefined;

      if (sanitizedCustomerInput?.includes('PAY_PARTIAL') || sanitizedCustomerInput?.includes('PARTIAL_PAYMENT')) {
        customerResponse = 'PARTIAL_PAYMENT';
      } else if (sanitizedCustomerInput?.includes('PAID') || sanitizedCustomerInput?.includes('PAY_FULL')) {
        customerResponse = 'PAID';
      } else if (sanitizedCustomerInput?.includes('PROMISE_TO_PAY')) {
        customerResponse = 'PROMISE_TO_PAY';
      } else if (sanitizedCustomerInput?.includes('REQUEST_HUMAN')) {
        customerResponse = 'REQUEST_HUMAN';
      } else if (sanitizedCustomerInput?.includes('NO_RESPONSE') || sanitizedCustomerInput?.includes('IGNORES')) {
        customerResponse = 'NO_RESPONSE';
      } else if (actionType === 'BOUNDED_NEGOTIATE' || actionType === 'OFFER_BOUNDED_DISCOUNT') {
        if (effectiveDiscount < 500) {
          customerResponse = 'COUNTER_OFFER';
          counterAmountCents = Math.round(finOpsCase.amountAtRiskCents * 0.90);
        } else {
          customerResponse = 'ACCEPT';
        }
      }

      // Record Negotiation History if applicable
      if (actionType === 'BOUNDED_NEGOTIATE' || actionType === 'OFFER_BOUNDED_DISCOUNT') {
        const roundRecord: NegotiationRoundRecord = {
          round: currentRound,
          actor: 'AGENT',
          proposedAmountCents: Math.round(finOpsCase.amountAtRiskCents * (1 - effectiveDiscount / 10000)),
          discountBps: effectiveDiscount,
          policyPassed: true,
          policyReason: 'Offer validated within merchant bounds',
          customerResponse,
          counterAmountCents,
          timestamp: new Date().toISOString(),
        };

        const existingRounds = finOpsCase.negotiation?.rounds || [];
        this.ledger.updateCaseDetails(caseId, {
          negotiation: {
            caseId,
            originalAmountCents: finOpsCase.amountAtRiskCents,
            currentAgreedAmountCents: roundRecord.proposedAmountCents,
            currentDiscountBps: effectiveDiscount,
            status: customerResponse === 'ACCEPT' ? 'SETTLEMENT_AGREED' : 'CUSTOMER_COUNTERED',
            currentRound: currentRound + 1,
            maxRounds: 2,
            rounds: [...existingRounds, roundRecord],
            settlementWindowHours: 72,
            expiresAt: new Date(Date.now() + 72 * 3600 * 1000).toISOString(),
          },
        });
      }

      // Dispatch message if communication channel
      let msgDeliveryStatus: string = 'DELIVERED';
      let deliveredAtIso = new Date().toISOString();
      let readAtIso: string | undefined;

      if (['WHATSAPP', 'EMAIL', 'SMS'].includes(channel)) {
        try {
          const msgResp = await this.messaging.sendMessage(
            channel as any,
            {
              name: tx?.customerEmail?.split('@')[0] || 'Client',
              email: tx?.customerEmail,
              phone: tx?.customerPhone,
            },
            {
              body: `Recovery action ${actionType} for ₹${(finOpsCase.amountAtRiskCents / 100).toFixed(2)}: https://pay.razorpay.com/recovery/${finOpsCase.caseNumber}`,
              paymentLinkUrl: `https://pay.razorpay.com/recovery/${finOpsCase.caseNumber}`,
            },
            `rec_idemp_${caseId}_${finOpsCase.retryCount + 1}`,
            caseId
          );
          msgDeliveryStatus = msgResp.status;
          if (msgResp.deliveredAt) deliveredAtIso = msgResp.deliveredAt;
          if (msgResp.readAt) readAtIso = msgResp.readAt;
        } catch {
          // Fallback gracefully
        }
      }

      const nowIso = new Date().toISOString();
      const currentContacts = finOpsCase.outboundContactCount7d ?? 0;
      const isOutbound = ['WHATSAPP', 'EMAIL', 'SMS', 'SEND_PAYMENT_LINK', 'SEND_NUDGE', 'CHASE_RECEIVABLE'].includes(channel) || ['SEND_PAYMENT_LINK', 'SEND_NUDGE', 'CHASE_RECEIVABLE', 'OFFER_BOUNDED_DISCOUNT', 'BOUNDED_NEGOTIATE'].includes(actionType);

      this.ledger.updateCaseDetails(caseId, {
        retryCount: finOpsCase.retryCount + 1,
        lastActionAt: nowIso,
        outboundContactCount7d: currentContacts + (isOutbound ? 1 : 0),
        deliveredAt: deliveredAtIso,
        delivered_at: deliveredAtIso,
        readAt: readAtIso,
        read_at: readAtIso,
        respondedAt: (customerResponse === 'ACCEPT' || customerResponse === 'COUNTER_OFFER') ? nowIso : undefined,
        responded_at: (customerResponse === 'ACCEPT' || customerResponse === 'COUNTER_OFFER') ? nowIso : undefined,
      });
      this.ledger.updateCaseStatus(caseId, 'RECOVERY_EXECUTED', 'AGENT_RECOVERY', strategyReasoning);

      executionResult = {
        gatewayResponseCode: 'GATEWAY_ACCEPTED_200',
        notificationId: `notif_${Date.now()}`,
        paymentUrl: `https://pay.razorpay.com/recovery/${finOpsCase.caseNumber}`,
        discountBpsApplied: effectiveDiscount,
        simulatedSettlementUtr: `UTR_REC_${finOpsCase.caseNumber}_${Math.floor(1000 + Math.random() * 9000)}`,
        customerResponseSimulated: customerResponse,
        counterAmountCents,
        message: `Adaptive recovery dispatched via ${channel} (${actionType}). Delivery: ${msgDeliveryStatus}.`,
      };
    }

    const actionRecord: RecoveryActionRecord = {
      id: actionId,
      caseId,
      actionType,
      channel,
      actionPayload: {
        amountAtRiskCents: finOpsCase.amountAtRiskCents,
        discountOfferedBps: discountBps,
        customerIdentifier: tx?.customerEmail || tx?.customerPhone,
      },
      policyPassed: !isHighRisk && policyResult.passed,
      policyViolations: isHighRisk ? ['High-risk / Critical fraud block'] : policyResult.violations,
      executionStatus,
      executionResult,
      discountOfferedBps: discountBps,
      expectedOutcome,
      createdAt: new Date().toISOString(),
    };

    // Store in Ledger
    this.ledger.addRecoveryAction(actionRecord);

    // Audit Trail Entry
    this.audit.record({
      caseId,
      actorType: 'AGENT_RECOVERY',
      actorId: 'REVENUE_RECOVERY_AGENT',
      action: `RECOVERY_ACTION_${actionType}`,
      decision: `${actionType} via ${channel} -> ${executionStatus} (Discount: ${(discountBps/100).toFixed(1)}%)`,
      policyEvaluation: {
        passed: actionRecord.policyPassed,
        violations: actionRecord.policyViolations,
        rulesEvaluated: policyResult.rulesEvaluated,
      },
      stateBefore: { retryCount: finOpsCase.retryCount },
      stateAfter: { retryCount: finOpsCase.retryCount + (executionStatus === 'EXECUTED' ? 1 : 0), executionStatus },
      reasoningSummary: strategyReasoning || policyResult.reason,
    });

    return {
      actionRecord,
      policyPassed: actionRecord.policyPassed,
      policyViolations: actionRecord.policyViolations,
      executionStatus,
      message: executionResult?.message || 'Recovery processed.',
      agentMessage,
    };
  }
}
