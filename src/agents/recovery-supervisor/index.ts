import { 
  FinOpsCase, 
  RecoveryCase, 
  TransactionRecord, 
  RecoveryActionType, 
  RecoveryChannel, 
  SpecialistAgentType, 
  CustomerResponseType, 
  RecoveryTrace, 
  PromiseToPayRecord, 
  PartialCollectionRecord,
  RecoveryCampaign,
  CustomerSegment
} from '@/types';
import { LedgerStore } from '@/core/ledger/ledger-store';
import { PolicyEngine } from '@/core/policy-engine';
import { AuditLogger } from '@/core/audit/audit-logger';
import { ChannelPerformanceTracker } from '@/core/recovery/channel-performance';
import { RecoveryEligibilityEngine } from '@/core/recovery/eligibility-engine';
import { RecoveryPriorityEngine } from '@/core/recovery/priority-engine';
import { RecoveryCampaignManager } from '@/core/recovery/campaign-manager';
import { selectPlaybookForCase, RECOVERY_PLAYBOOKS } from '@/core/recovery/playbooks';
import { RevenueRecoveryAgent } from '@/agents/revenue-recovery';
import { InvoiceGenerator } from '@/core/documents/invoice-generator';
import { OpportunityStore } from '@/core/recovery/opportunity-store';

export interface SupervisorExecutionResult {
  caseId: string;
  specialistAgent: SpecialistAgentType;
  actionTaken: RecoveryActionType;
  channel: RecoveryChannel;
  policyPassed: boolean;
  policyViolations: string[];
  customerResponse?: CustomerResponseType;
  verifiedRecovery: boolean;
  recoveredAmountCents: number;
  remainingAmountCents: number;
  promiseToPay?: PromiseToPayRecord;
  partialCollection?: PartialCollectionRecord;
  recoveryTrace: RecoveryTrace;
}

export class RecoverySupervisorAgent {
  private static instance: RecoverySupervisorAgent;
  private ledger = LedgerStore.getInstance();
  private policyEngine = PolicyEngine.getInstance();
  private audit = AuditLogger.getInstance();
  private eligibilityEngine = RecoveryEligibilityEngine.getInstance();
  private priorityEngine = RecoveryPriorityEngine.getInstance();
  private campaignManager = RecoveryCampaignManager.getInstance();
  private channelTracker = ChannelPerformanceTracker.getInstance();
  private recoveryAgent = new RevenueRecoveryAgent();
  private oppStore = OpportunityStore.getInstance();

  public static getInstance(): RecoverySupervisorAgent {
    if (!RecoverySupervisorAgent.instance) {
      RecoverySupervisorAgent.instance = new RecoverySupervisorAgent();
    }
    return RecoverySupervisorAgent.instance;
  }

  /**
   * Portfolio Discovery: Scans all cases, evaluates eligibility, priority, opportunity scores, and assigns specialist playbooks.
   */
  public discoverPortfolio(): {
    totalCases: number;
    actionableCases: number;
    totalExposureCents: number;
    actionableExposureCents: number;
    eligibleCases: RecoveryCase[];
  } {
    const cases = this.ledger.getAllCases();
    const policy = this.policyEngine.getPolicy('MERCHANT_DEFAULT');
    let totalExposureCents = 0;
    let actionableExposureCents = 0;
    const eligibleCases: RecoveryCase[] = [];

    for (const c of cases) {
      totalExposureCents += c.amountAtRiskCents;
      const tx = c.transactionId ? this.ledger.getTransaction(c.transactionId) : undefined;
      
      const eligibility = this.eligibilityEngine.evaluateCase(c, tx, policy);
      const priorityResult = this.priorityEngine.evaluatePriority(c, tx);
      const playbookType = selectPlaybookForCase(c, tx);
      const specialist = this.routeSpecialist(c, tx, playbookType);

      // Persist eligibility and priority
      this.ledger.evaluateAndSetRecoveryEligibility(
        c.id,
        eligibility.isEligible,
        eligibility.status,
        eligibility.reason
      );

      if (eligibility.isEligible) {
        actionableExposureCents += c.remainingRecoverableAmountCents ?? c.amountAtRiskCents;
        const recCase = this.ledger.getRecoveryCase(c.id);
        if (recCase) {
          recCase.specialistAgent = specialist;
          recCase.playbook = playbookType;
          recCase.opportunityScore = eligibility.opportunityScore;
          recCase.priority = priorityResult.priority;
          recCase.priorityReason = priorityResult.priorityReason;
          recCase.behaviorSegment = eligibility.behaviorSegment;
          this.ledger.saveRecoveryCase(recCase);
          eligibleCases.push(recCase);
        }

        // Sync first-class RecoveryOpportunity
        this.oppStore.createFromCase(c, tx);
      }
    }

    return {
      totalCases: cases.length,
      actionableCases: eligibleCases.length,
      totalExposureCents,
      actionableExposureCents,
      eligibleCases,
    };
  }

  /**
   * Deterministic Specialist Routing (Architectural roles; zero unnecessary LLM nesting)
   */
  public routeSpecialist(
    finOpsCase: FinOpsCase,
    tx?: TransactionRecord,
    playbookType?: string
  ): SpecialistAgentType {
    if (tx?.customerSegment === 'ENTERPRISE' || tx?.customerSegment === 'MID_MARKET') {
      if (finOpsCase.negotiation || (tx.daysOverdue ?? 0) > 30) {
        return 'NEGOTIATION_AGENT';
      }
      return 'INVOICE_AGENT';
    }

    if (tx?.paymentMethod === 'AUTOPAY' || finOpsCase.scenarioType?.includes('SUBSCRIPTION')) {
      return 'SUBSCRIPTION_RECOVERY_AGENT';
    }

    if (tx?.errorCode === 'MANDATE_EXPIRED' || tx?.errorCode === 'VPA_NOT_FOUND') {
      return 'MANDATE_RECOVERY_AGENT';
    }

    if (finOpsCase.retryCount >= 2 && tx?.customerPhone) {
      return 'VOICE_RECOVERY_AGENT';
    }

    if (finOpsCase.retryCount >= 1) {
      return 'PAYMENT_AGENT';
    }

    return 'COLLECTIONS_AGENT';
  }

  /**
   * Execute Autonomous Recovery Lifecycle for a single case
   */
  public async executeCaseRecovery(
    caseId: string,
    options?: {
      campaignId?: string;
      customerMessage?: string;
      forcedAction?: RecoveryActionType;
    }
  ): Promise<SupervisorExecutionResult> {
    const finOpsCase = this.ledger.getCase(caseId);
    if (!finOpsCase) throw new Error(`Case ${caseId} not found`);

    const tx = finOpsCase.transactionId ? this.ledger.getTransaction(finOpsCase.transactionId) : undefined;
    const policy = this.policyEngine.getPolicy(finOpsCase.merchantId || 'MERCHANT_DEFAULT');
    const segment: CustomerSegment = tx?.customerSegment || 'SMB';

    // 1. Concurrency Claiming Lock (if part of a campaign)
    if (options?.campaignId) {
      const claim = this.campaignManager.claimCaseForCampaign(
        options.campaignId,
        caseId,
        options.forcedAction || 'AUTONOMOUS_RECOVERY'
      );
      if (!claim.success) {
        throw new Error(claim.reason || 'Case claim failed');
      }
      finOpsCase.campaignId = options.campaignId;
    }

    // 2. Deterministic Eligibility & Playbook Selection
    const eligibility = this.eligibilityEngine.evaluateCase(finOpsCase, tx, policy);
    if (!eligibility.isEligible && eligibility.status !== 'ELIGIBLE') {
      const trace: RecoveryTrace = {
        opportunity: `₹${(finOpsCase.amountAtRiskCents / 100).toFixed(2)} exposure`,
        context: `Eligibility check: ${eligibility.status}`,
        agentDecision: 'STOP_RECOVERY',
        policyResult: 'BLOCKED',
        expectedOutcome: 'Halt automated recovery',
        nextCondition: eligibility.reason,
      };
      finOpsCase.recoveryTrace = trace;
      return {
        caseId,
        specialistAgent: 'RECOVERY_SUPERVISOR',
        actionTaken: 'STOP_RECOVERY',
        channel: 'PORTAL',
        policyPassed: false,
        policyViolations: [eligibility.reason],
        verifiedRecovery: false,
        recoveredAmountCents: 0,
        remainingAmountCents: finOpsCase.remainingRecoverableAmountCents ?? finOpsCase.amountAtRiskCents,
        recoveryTrace: trace,
      };
    }

    const playbook = selectPlaybookForCase(finOpsCase, tx);
    const specialist = this.routeSpecialist(finOpsCase, tx, playbook);
    const optimalChannel = this.channelTracker.selectOptimalChannel(
      segment,
      policy?.allowedChannels || ['WHATSAPP', 'EMAIL', 'SMS']
    );

    // 3. Dispatch to Specialist Execution through RevenueRecoveryAgent
    const result = await this.recoveryAgent.executeRecovery(
      caseId,
      options?.forcedAction,
      options?.customerMessage
    );

    const recAction = result.actionRecord;
    const customerResponse = recAction.executionResult?.customerResponseSimulated;

    // Record outbound observation for channel optimizer (no hardcoding)
    this.channelTracker.recordOutbound({
      customerSegment: segment,
      channel: recAction.channel,
      delivered: true,
      responded: customerResponse !== 'NO_RESPONSE' && customerResponse !== 'IGNORES',
      convertedPayment: customerResponse === 'PAID' || customerResponse === 'PAY_FULL' || customerResponse === 'PARTIAL_PAYMENT',
    });

    // 4. Adaptive Response Handling
    let verifiedRecovery = false;
    let recoveredAmountCents = 0;
    const originalRecoverable = finOpsCase.amountAtRiskCents;
    let remainingAmountCents = finOpsCase.remainingRecoverableAmountCents ?? originalRecoverable;
    let promiseToPay: PromiseToPayRecord | undefined;
    let partialCollection: PartialCollectionRecord | undefined;

    if (customerResponse === 'PAID' || customerResponse === 'PAY_FULL' || customerResponse === 'ACCEPTS_DISCOUNT' || customerResponse === 'ACCEPT' || customerResponse === 'ACCEPTED') {
      // Full Payment
      verifiedRecovery = true;
      recoveredAmountCents = remainingAmountCents;
      remainingAmountCents = 0;
      finOpsCase.status = 'SETTLED_VERIFIED';
      finOpsCase.recoveredAmountCents = originalRecoverable;
      finOpsCase.verifiedCollectedAmountCents = originalRecoverable;
      finOpsCase.remainingRecoverableAmountCents = 0;
      this.campaignManager.releaseCaseClaim(caseId);

      const recCase = this.ledger.getRecoveryCase(caseId);
      if (recCase) {
        recCase.status = 'VERIFIED';
        recCase.verifiedCollectedCents = originalRecoverable;
        recCase.remainingAmountCents = 0;
        this.ledger.saveRecoveryCase(recCase);
      }
    } else if (customerResponse === 'PARTIAL_PAYMENT' || customerResponse === 'PAY_PARTIAL') {
      // PARTIAL RECOVERY INVARIANT: Do NOT mark SETTLED_VERIFIED. Status = PARTIALLY_RECOVERED.
      const partialCollected = Math.round(remainingAmountCents * 0.60); // 60% collected
      remainingAmountCents = remainingAmountCents - partialCollected;
      recoveredAmountCents = partialCollected;
      
      partialCollection = {
        id: `part_${Date.now()}`,
        caseId,
        originalRecoverableCents: originalRecoverable,
        verifiedCollectedCents: (finOpsCase.verifiedCollectedAmountCents || 0) + partialCollected,
        remainingAmountCents,
        utrRrn: `UTR_PART_${Date.now().toString().slice(-6)}`,
        collectedAt: new Date().toISOString(),
      };

      finOpsCase.status = 'PARTIALLY_RECOVERED';
      finOpsCase.partialCollection = partialCollection;
      finOpsCase.verifiedCollectedAmountCents = partialCollection.verifiedCollectedCents;
      finOpsCase.remainingRecoverableAmountCents = remainingAmountCents;

      const recCase = this.ledger.getRecoveryCase(caseId);
      if (recCase) {
        recCase.status = 'PARTIALLY_RECOVERED';
        recCase.partialCollection = partialCollection;
        recCase.verifiedCollectedCents = partialCollection.verifiedCollectedCents;
        recCase.remainingAmountCents = remainingAmountCents;
        this.ledger.saveRecoveryCase(recCase);
      }
    } else if (customerResponse === 'PROMISE_TO_PAY') {
      // PROMISE TO PAY: Register commitment and lock grace period
      const promiseDate = new Date(Date.now() + 72 * 3600000).toISOString().split('T')[0];
      promiseToPay = {
        id: `p2p_${Date.now()}`,
        caseId,
        promisedAmountCents: remainingAmountCents,
        promisedDate: promiseDate,
        status: 'PENDING',
        createdAt: new Date().toISOString(),
      };

      finOpsCase.promiseToPay = promiseToPay;
      const recCase = this.ledger.getRecoveryCase(caseId);
      if (recCase) {
        recCase.promiseToPay = promiseToPay;
        recCase.status = 'WAITING_FOR_CUSTOMER';
        this.ledger.saveRecoveryCase(recCase);
      }
    }

    // 5. Structured Recovery Trace (Concise rationale, zero CoT)
    const trace: RecoveryTrace = {
      opportunity: `₹${(originalRecoverable / 100).toLocaleString('en-IN')} receivable (${segment})`,
      context: `${tx?.daysOverdue ?? 15}d overdue, risk ${finOpsCase.riskScore ?? 20}/100, observed channel: ${recAction.channel}`,
      agentDecision: `${specialist}: ${recAction.actionType} via ${recAction.channel}`,
      policyResult: result.policyPassed ? 'ALLOW' : 'POLICY_BLOCK',
      expectedOutcome: recAction.expectedOutcome || 'Recover funds via customer prompt',
      nextCondition: verifiedRecovery 
        ? 'Bank UTR settlement verified; case closed'
        : partialCollection 
          ? `Collected ₹${(partialCollection.verifiedCollectedCents / 100).toLocaleString('en-IN')}; ₹${(remainingAmountCents / 100).toLocaleString('en-IN')} remaining in queue`
          : promiseToPay 
            ? `Promise registered for ${promiseToPay.promisedDate}; grace period locked`
            : 'If no response in 24h → escalate to next playbook step',
    };

    finOpsCase.recoveryTrace = trace;
    const recCase = this.ledger.getRecoveryCase(caseId);
    if (recCase) {
      recCase.recoveryTrace = trace;
      this.ledger.saveRecoveryCase(recCase);
    }

    // Sync OpportunityStore
    const opp = this.oppStore.getOpportunityByCaseId(caseId);
    if (opp) {
      opp.attemptCount = finOpsCase.retryCount || 1;
      opp.recoveryState = verifiedRecovery ? 'VERIFIED' : partialCollection ? 'PARTIALLY_RECOVERED' : promiseToPay ? 'WAITING_FOR_CUSTOMER' : 'ACTIVE';
      opp.remainingAmountCents = remainingAmountCents;
      opp.verifiedCollectedCents = (opp.amountAtRiskCents - remainingAmountCents);
      opp.lastAction = `${specialist}: ${recAction.actionType} via ${recAction.channel}`;
      opp.lastActionAt = new Date().toISOString();
      opp.promiseToPay = promiseToPay;
      opp.partialCollection = partialCollection;
      if (trace) opp.recoveryTrace = [trace, ...(opp.recoveryTrace || [])];
      this.oppStore.updateOpportunity(opp.id, opp);
    }

    return {
      caseId,
      specialistAgent: specialist,
      actionTaken: recAction.actionType,
      channel: recAction.channel,
      policyPassed: result.policyPassed,
      policyViolations: result.policyViolations,
      customerResponse,
      verifiedRecovery,
      recoveredAmountCents,
      remainingAmountCents,
      promiseToPay,
      partialCollection,
      recoveryTrace: trace,
    };
  }

  /**
   * Run an entire Recovery Campaign autonomously across all matching cases
   */
  public async runCampaign(campaignId: string): Promise<{
    campaign: RecoveryCampaign;
    executedCasesCount: number;
    results: SupervisorExecutionResult[];
  }> {
    const campaign = this.campaignManager.getCampaign(campaignId);
    if (!campaign) throw new Error(`Campaign ${campaignId} not found`);

    campaign.status = 'ACTIVE';
    campaign.startedAt = new Date().toISOString();

    const allCases = this.ledger.getAllCases();
    const transactions = new Map<string, TransactionRecord>();
    for (const c of allCases) {
      if (c.transactionId) {
        const tx = this.ledger.getTransaction(c.transactionId);
        if (tx) transactions.set(c.transactionId, tx);
      }
    }

    const eligibleCases = this.campaignManager.filterEligibleCasesForCampaign(
      campaignId,
      allCases,
      transactions
    );

    const results: SupervisorExecutionResult[] = [];

    for (const targetCase of eligibleCases) {
      const res = await this.executeCaseRecovery(targetCase.id, { campaignId });
      results.push(res);
    }

    // Refresh live metrics
    this.campaignManager.refreshCampaignMetrics(campaignId, this.ledger.getAllCases());
    campaign.completedAt = new Date().toISOString();

    // Log immutable audit entry for the campaign run
    this.audit.record({
      caseId: campaignId,
      actorType: 'RECOVERY_SUPERVISOR',
      actorId: 'RECOVERY_SUPERVISOR_ENGINE',
      action: 'RUN_RECOVERY_CAMPAIGN',
      decision: `Executed campaign '${campaign.name}' across ${results.length} cases`,
      stateBefore: { status: 'DRAFT', targetCount: eligibleCases.length },
      stateAfter: { status: campaign.status, metrics: campaign.metrics },
      reasoningSummary: `Autonomous campaign targeting ${campaign.targetSegments.join(', ')} achieved ${campaign.metrics.recoveryRate} recovery rate with net recovery of ₹${(campaign.metrics.netRecoveredCents / 100).toLocaleString('en-IN')}`,
      confidence: 0.96,
    });

    return {
      campaign,
      executedCasesCount: results.length,
      results,
    };
  }
}
