import { 
  FinOpsCase, 
  TransactionRecord, 
  MerchantPolicy, 
  RecoveryEligibilityStatus, 
  RecoveryOpportunityScore,
  CustomerSegment,
  CustomerBehaviorSegment
} from '@/types';
import { ChannelPerformanceTracker } from './channel-performance';

export interface EligibilityResult {
  status: RecoveryEligibilityStatus;
  isEligible: boolean;
  reason: string;
  checks: Array<{ name: string; passed: boolean; details: string }>;
  opportunityScore: RecoveryOpportunityScore;
  behaviorSegment: CustomerBehaviorSegment;
}

export class RecoveryEligibilityEngine {
  private static instance: RecoveryEligibilityEngine;
  private channelTracker: ChannelPerformanceTracker;

  private constructor() {
    this.channelTracker = ChannelPerformanceTracker.getInstance();
  }

  public static getInstance(): RecoveryEligibilityEngine {
    if (!RecoveryEligibilityEngine.instance) {
      RecoveryEligibilityEngine.instance = new RecoveryEligibilityEngine();
    }
    return RecoveryEligibilityEngine.instance;
  }

  /**
   * Deterministic recovery eligibility evaluation.
   * The LLM CANNOT override these programmatic checks.
   */
  public evaluateCase(
    finOpsCase: FinOpsCase,
    tx?: TransactionRecord,
    policy?: MerchantPolicy
  ): EligibilityResult {
    const checks: Array<{ name: string; passed: boolean; details: string }> = [];

    // 1. Reconciliation & Terminal State Check
    const isTerminal = finOpsCase.status === 'SETTLED_VERIFIED' || 
                       finOpsCase.status === 'CLOSED_WRITTEN_OFF' ||
                       finOpsCase.status === 'RECONCILED';
    const isBenignRecon = finOpsCase.reconStatus === 'EXACT_MATCH' || 
                          finOpsCase.reconStatus === 'FEE_MISMATCH' || 
                          finOpsCase.reconStatus === 'TIMING_DELAY';
    const hasException = !isBenignRecon && finOpsCase.amountAtRiskCents > 0;
    checks.push({
      name: 'RECONCILIATION_EXCEPTION',
      passed: !isTerminal && hasException,
      details: isTerminal 
        ? `Case is in terminal state (${finOpsCase.status})` 
        : isBenignRecon 
          ? `Benign operational/settlement status (${finOpsCase.reconStatus}); no outstanding customer obligation` 
          : `Discrepancy: ₹${(finOpsCase.amountAtRiskCents / 100).toFixed(2)}`,
    });

    if (isTerminal || !hasException) {
      const opportunityScore = this.computeOpportunityScore(finOpsCase, tx, 0);
      return {
        status: finOpsCase.status === 'SETTLED_VERIFIED' ? 'VERIFIED' : 'NOT_APPLICABLE',
        isEligible: false,
        reason: isTerminal 
          ? `Case is already in terminal state (${finOpsCase.status})` 
          : isBenignRecon 
            ? `Benign reconciliation/settlement status (${finOpsCase.reconStatus}); customer receivable not applicable`
            : 'Exact match or zero discrepancy; recovery not applicable',
        checks,
        opportunityScore,
        behaviorSegment: this.deriveBehaviorSegment(finOpsCase, tx),
      };
    }

    // 2. Risk Hard Block Gate (Score >= 70 or CRITICAL_FRAUD)
    const riskScore = finOpsCase.riskScore ?? 20;
    const isRiskBlocked = riskScore >= (policy?.riskScoreBlockThreshold ?? 70) || finOpsCase.riskClassification === 'CRITICAL_FRAUD';
    checks.push({
      name: 'RISK_HARD_GATE',
      passed: !isRiskBlocked,
      details: isRiskBlocked ? `Risk score (${riskScore}/100) exceeds threshold (70)` : `Risk score (${riskScore}/100) is clear`,
    });

    if (isRiskBlocked) {
      const opportunityScore = this.computeOpportunityScore(finOpsCase, tx, 0.05);
      return {
        status: 'BLOCKED',
        isEligible: false,
        reason: `Risk score (${riskScore}/100) or fraud pattern strictly blocked by policy gate`,
        checks,
        opportunityScore,
        behaviorSegment: 'HIGH_RISK',
      };
    }

    // 3. Human Review Boundary (45-69 or Borderline)
    const requiresHumanReview = (riskScore >= (policy?.riskScoreHumanThreshold ?? 45) && finOpsCase.status === 'HUMAN_REVIEW_REQUIRED') ||
                                finOpsCase.riskClassification === 'BORDERLINE_REVIEW';
    checks.push({
      name: 'HUMAN_REVIEW_BOUNDARY',
      passed: !requiresHumanReview,
      details: requiresHumanReview ? `Risk score (${riskScore}/100) requires operator authorization` : `Clear for autonomous processing`,
    });

    if (requiresHumanReview) {
      const opportunityScore = this.computeOpportunityScore(finOpsCase, tx, 0.45);
      return {
        status: 'HUMAN_REVIEW',
        isEligible: false,
        reason: `Elevated or borderline risk score (${riskScore}/100) requires human review authorization`,
        checks,
        opportunityScore,
        behaviorSegment: this.deriveBehaviorSegment(finOpsCase, tx),
      };
    }

    // 4. Retry & Contact Exhaustion
    const maxRetries = policy?.maxRetryAttempts ?? finOpsCase.maxRetriesAllowed ?? 3;
    const isExhausted = finOpsCase.retryCount >= maxRetries;
    checks.push({
      name: 'ATTEMPT_CEILING',
      passed: !isExhausted,
      details: `Attempts: ${finOpsCase.retryCount} of ${maxRetries}`,
    });

    if (isExhausted) {
      const opportunityScore = this.computeOpportunityScore(finOpsCase, tx, 0.1);
      return {
        status: 'EXHAUSTED',
        isEligible: false,
        reason: `Maximum automated recovery attempts (${maxRetries}) exhausted`,
        checks,
        opportunityScore,
        behaviorSegment: this.deriveBehaviorSegment(finOpsCase, tx),
      };
    }

    // 5. Promise-to-Pay Grace Lock Check
    const activePromise = finOpsCase.promiseToPay;
    if (activePromise && activePromise.status === 'PENDING') {
      const promiseDate = new Date(activePromise.promisedDate).getTime();
      const now = Date.now();
      if (now < promiseDate) {
        checks.push({
          name: 'PROMISE_TO_PAY_GRACE',
          passed: false,
          details: `Active commitment of ₹${(activePromise.promisedAmountCents / 100).toLocaleString('en-IN')} pending until ${activePromise.promisedDate}`,
        });
        const opportunityScore = this.computeOpportunityScore(finOpsCase, tx, 0.85);
        return {
          status: 'ELIGIBLE', // Still eligible, but active lock in queue
          isEligible: true,
          reason: `Customer promised to pay on ${activePromise.promisedDate}; grace period locked`,
          checks,
          opportunityScore,
          behaviorSegment: 'RESPONSIVE',
        };
      }
    }

    // 6. Economic Feasibility Check
    const rawProb = this.calculateRecoveryProbability(finOpsCase, tx);
    const opportunityScore = this.computeOpportunityScore(finOpsCase, tx, rawProb);
    const isEconomicallyFeasible = opportunityScore.expectedNetRecoveryCents > 0;
    checks.push({
      name: 'ECONOMIC_FEASIBILITY',
      passed: isEconomicallyFeasible,
      details: `Expected net recovery: ₹${(opportunityScore.expectedNetRecoveryCents / 100).toFixed(2)}`,
    });

    const behaviorSegment = this.deriveBehaviorSegment(finOpsCase, tx);

    return {
      status: 'ELIGIBLE',
      isEligible: true,
      reason: `Verified recoverable exception (${behaviorSegment}) with positive expected yield (₹${(opportunityScore.expectedNetRecoveryCents / 100).toFixed(2)})`,
      checks,
      opportunityScore,
      behaviorSegment,
    };
  }

  /**
   * Derive behavioral customer segment from transactional and historical signals
   */
  public deriveBehaviorSegment(
    finOpsCase: FinOpsCase,
    tx?: TransactionRecord
  ): CustomerBehaviorSegment {
    const risk = finOpsCase.riskScore ?? 20;
    if (risk >= 70) return 'HIGH_RISK';

    const segment = tx?.customerSegment || 'SMB';
    const amount = finOpsCase.amountAtRiskCents;

    if (segment === 'ENTERPRISE' && amount >= 5000000) return 'STABLE_HIGH_VALUE';
    if (finOpsCase.negotiation || finOpsCase.scenarioType?.includes('NEGOTIATION')) return 'PRICE_SENSITIVE';
    if (finOpsCase.priorResponses?.some((r) => r === 'IGNORES' || r === 'NO_RESPONSE')) return 'UNRESPONSIVE';
    if (finOpsCase.priorResponses?.some((r) => r === 'ACCEPT' || r === 'PROMISE_TO_PAY')) return 'RESPONSIVE';
    if ((tx?.daysOverdue ?? 0) > 60) return 'LONG_TERM';

    return 'NEW_CUSTOMER';
  }

  /**
   * Calculate probability of recovery based on segment, error code, and channel statistics
   */
  public calculateRecoveryProbability(
    finOpsCase: FinOpsCase,
    tx?: TransactionRecord
  ): number {
    let baseProb = 0.75;
    const segment: CustomerSegment = tx?.customerSegment || 'SMB';

    // Segment adjustments
    if (segment === 'ENTERPRISE') baseProb = 0.88;
    else if (segment === 'MID_MARKET') baseProb = 0.80;
    else if (segment === 'SMB') baseProb = 0.72;
    else if (segment === 'CONSUMER') baseProb = 0.65;

    // Error code adjustments
    const err = tx?.errorCode || '';
    if (err.includes('504') || err.includes('TIMEOUT') || err.includes('UNAVAILABLE')) {
      baseProb += 0.12; // Highly recoverable transient drop
    } else if (err.includes('EXPIRED') || err.includes('INSUFFICIENT')) {
      baseProb -= 0.08;
    } else if (err.includes('FRAUD') || err.includes('CLOSED')) {
      baseProb -= 0.35;
    }

    // Days overdue penalty
    const daysOverdue = tx?.daysOverdue ?? 0;
    if (daysOverdue > 60) baseProb -= 0.20;
    else if (daysOverdue > 30) baseProb -= 0.10;
    else if (daysOverdue > 15) baseProb -= 0.05;

    // Retry penalty
    baseProb -= (finOpsCase.retryCount || 0) * 0.08;

    // Risk score penalty
    const risk = finOpsCase.riskScore ?? 20;
    baseProb -= (risk / 100) * 0.25;

    // Clamp between 0.05 and 0.98
    return Math.max(0.05, Math.min(0.98, Number(baseProb.toFixed(2))));
  }

  /**
   * Compute expected net recovery score:
   * expectedNetRecovery = recoverableAmount * recoveryProbability - expectedDiscountCost - expectedCommunicationCost
   */
  public computeOpportunityScore(
    finOpsCase: FinOpsCase,
    tx: TransactionRecord | undefined,
    recoveryProbability: number
  ): RecoveryOpportunityScore {
    const recoverableAmountCents = finOpsCase.remainingRecoverableAmountCents ?? finOpsCase.amountAtRiskCents;
    
    // Expected discount cost (e.g. 5% if B2B negotiation eligible, else 0)
    const isB2B = tx?.customerSegment === 'ENTERPRISE' || tx?.customerSegment === 'MID_MARKET';
    const expectedDiscountBps = isB2B && (tx?.daysOverdue ?? 0) > 20 ? 500 : 0; // 5% discount
    const expectedDiscountCostCents = Math.round((recoverableAmountCents * expectedDiscountBps) / 10000);

    // Communication cost (WhatsApp ₹0.40, SMS ₹0.20, Email ₹0.05 -> in cents)
    const estimatedContacts = Math.max(1, 3 - (finOpsCase.retryCount || 0));
    const unitCostCents = 40; // ₹0.40 in cents
    const expectedCommunicationCostCents = estimatedContacts * unitCostCents;

    const grossExpectedCents = Math.round(recoverableAmountCents * recoveryProbability);
    const expectedNetRecoveryCents = Math.max(
      0,
      grossExpectedCents - expectedDiscountCostCents - expectedCommunicationCostCents
    );

    return {
      caseId: finOpsCase.id,
      expectedNetRecoveryCents,
      recoverableAmountCents,
      recoveryProbability,
      expectedDiscountCostCents,
      expectedCommunicationCostCents,
      confidenceScore: recoveryProbability >= 0.7 ? 0.95 : 0.82,
    };
  }
}
