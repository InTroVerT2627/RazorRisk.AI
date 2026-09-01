import { 
  FinOpsCase, 
  MerchantPolicy, 
  RecoveryActionType, 
  RecoveryChannel, 
  RiskClassification 
} from '@/types';

export interface PolicyEvaluationResult {
  passed: boolean;
  actionAllowed: boolean;
  requiresHumanApproval: boolean;
  violations: string[];
  rulesEvaluated: string[];
  clampedDiscountBps?: number;
  reason: string;
}

export const DEFAULT_MERCHANT_POLICY: MerchantPolicy = {
  merchantId: 'MERCHANT_DEFAULT',
  merchantName: 'Razorpay Enterprise Demo',
  maxRetryAttempts: 3,
  retryCooldownHours: 2,
  maxDiscountBps: 1000, // 10% max
  minSettlementBps: 8500, // 85% minimum settlement
  maxNegotiationRounds: 2, // 2 rounds max
  eligibleSegments: ['ENTERPRISE', 'MID_MARKET', 'SMB'],
  minNegotiationInvoiceAmountCents: 1000000, // ₹10,000 min invoice for negotiation
  settlementWindowHours: 72,
  autoRecoveryMaxAmountCents: 5000000, // ₹50,000 max auto
  riskScoreBlockThreshold: 70, // Scores >= 70 blocked
  riskScoreHumanThreshold: 45, // Scores 45-70 require human review
  allowedChannels: ['WHATSAPP', 'EMAIL', 'SMS', 'GATEWAY', 'GATEWAY_RETRY', 'PORTAL', 'HUMAN_CALL'],
  maxWeeklyContacts: 3, // Max 3 outbound messages per 7 days
  minReminderIntervalHours: 24, // Min 24 hours between reminder dispatches
  isActive: true,
  mandatoryHumanCategories: ['CHARGEBACK_SUSPECTED', 'CRITICAL_FRAUD', 'AMOUNT_MISMATCH'],
};

export class PolicyEngine {
  private static instance: PolicyEngine;
  private policies: Map<string, MerchantPolicy> = new Map();

  private constructor() {
    this.policies.set(DEFAULT_MERCHANT_POLICY.merchantId, DEFAULT_MERCHANT_POLICY);
  }

  public static getInstance(): PolicyEngine {
    if (!PolicyEngine.instance) {
      PolicyEngine.instance = new PolicyEngine();
    }
    return PolicyEngine.instance;
  }

  public setPolicy(policy: MerchantPolicy): void {
    this.policies.set(policy.merchantId, policy);
  }

  public getPolicy(merchantId: string): MerchantPolicy {
    return this.policies.get(merchantId) || { ...DEFAULT_MERCHANT_POLICY, merchantId };
  }

  public evaluateRecoveryAction(params: {
    finOpsCase: FinOpsCase;
    actionType: RecoveryActionType;
    channel?: RecoveryChannel;
    discountOfferedBps?: number;
    riskScore?: number;
    riskClassification?: RiskClassification;
    negotiationRound?: number;
  }): PolicyEvaluationResult {
    const { finOpsCase, actionType, channel, discountOfferedBps = 0, riskScore, riskClassification, negotiationRound = 1 } = params;
    const policy = this.getPolicy(finOpsCase.merchantId);

    const violations: string[] = [];
    const rulesEvaluated: string[] = [];
    let requiresHumanApproval = false;
    let clampedDiscountBps = discountOfferedBps;

    // Rule 1: Master Policy Active Flag
    rulesEvaluated.push('MERCHANT_POLICY_ACTIVE');
    if (!policy.isActive) {
      violations.push('Merchant automated policy is paused.');
    }

    // Rule 2: Risk Score Hard Block Threshold (>= 70)
    rulesEvaluated.push('RISK_SCORE_BLOCK_THRESHOLD');
    const effectiveRiskScore = riskScore ?? finOpsCase.riskScore ?? 0;
    if (effectiveRiskScore >= policy.riskScoreBlockThreshold) {
      violations.push(
        `Risk score (${effectiveRiskScore}) exceeds hard block threshold (${policy.riskScoreBlockThreshold}). Auto-recovery blocked.`
      );
    }

    // Rule 3: Risk Classification Gate
    rulesEvaluated.push('RISK_CLASSIFICATION_GATE');
    const effectiveClassification = riskClassification ?? finOpsCase.riskClassification;
    if (effectiveClassification === 'CRITICAL_FRAUD' || effectiveClassification === 'RISK_SHAPED') {
      if (effectiveRiskScore >= policy.riskScoreBlockThreshold) {
        violations.push(`Case is classified as ${effectiveClassification}. Automated recovery is strictly prohibited.`);
      }
    }

    // Rule 4: Risk Score Human Review Threshold (45 - 70)
    rulesEvaluated.push('RISK_SCORE_HUMAN_REVIEW_THRESHOLD');
    if (effectiveRiskScore >= policy.riskScoreHumanThreshold && effectiveRiskScore < policy.riskScoreBlockThreshold) {
      requiresHumanApproval = true;
    }

    // Rule 5: Mandatory Human Review for Special Categories
    rulesEvaluated.push('MANDATORY_HUMAN_CATEGORIES');
    if (policy.mandatoryHumanCategories?.includes(finOpsCase.reconStatus)) {
      requiresHumanApproval = true;
    }

    // Rule 6: Maximum Retry Limit
    rulesEvaluated.push('MAX_RETRY_ATTEMPTS');
    if (actionType === 'RETRY_PAYMENT' && finOpsCase.retryCount >= policy.maxRetryAttempts) {
      violations.push(
        `Retry count (${finOpsCase.retryCount}) reached maximum allowable retries (${policy.maxRetryAttempts}). Action blocked.`
      );
    }

    // Rule 7: Cooldown Window
    rulesEvaluated.push('RETRY_COOLDOWN_WINDOW');
    if (finOpsCase.lastActionAt && actionType === 'RETRY_PAYMENT') {
      const lastActionTime = new Date(finOpsCase.lastActionAt).getTime();
      const now = Date.now();
      const elapsedHours = (now - lastActionTime) / (1000 * 60 * 60);
      if (elapsedHours < policy.retryCooldownHours) {
        violations.push(
          `Cooldown violation: only ${elapsedHours.toFixed(1)}h elapsed. Required cooldown is ${policy.retryCooldownHours}h.`
        );
      }
    }

    // Rule 8: Max Discount Clamping & Enforcement
    rulesEvaluated.push('MAX_DISCOUNT_BOUND');
    if (discountOfferedBps > policy.maxDiscountBps) {
      violations.push(
        `Proposed discount (${(discountOfferedBps / 100).toFixed(1)}%) exceeds policy maximum (${(policy.maxDiscountBps / 100).toFixed(1)}%).`
      );
      clampedDiscountBps = policy.maxDiscountBps;
    }

    // Rule 9: Minimum Settlement Percentage (Phase 6)
    rulesEvaluated.push('MIN_SETTLEMENT_BOUND');
    const minSettlementBps = policy.minSettlementBps ?? 8500;
    const effectiveSettlementBps = 10000 - discountOfferedBps;
    if (effectiveSettlementBps < minSettlementBps) {
      violations.push(
        `Settlement offer (${(effectiveSettlementBps / 100).toFixed(1)}%) falls below minimum permitted threshold (${(minSettlementBps / 100).toFixed(1)}%).`
      );
    }

    // Rule 10: Maximum Negotiation Rounds (Phase 6)
    rulesEvaluated.push('MAX_NEGOTIATION_ROUNDS');
    const maxRounds = policy.maxNegotiationRounds ?? 2;
    if ((actionType === 'OFFER_BOUNDED_DISCOUNT' || actionType === 'BOUNDED_NEGOTIATE') && negotiationRound > maxRounds) {
      violations.push(
        `Negotiation round (${negotiationRound}) exceeds maximum allowable rounds (${maxRounds}). Escalation required.`
      );
      requiresHumanApproval = true;
    }

    // Rule 11: Minimum Invoice Amount for Negotiation (Phase 6)
    rulesEvaluated.push('MIN_NEGOTIATION_INVOICE_AMOUNT');
    const minInvoice = policy.minNegotiationInvoiceAmountCents ?? 1000000;
    if (actionType === 'BOUNDED_NEGOTIATE' && finOpsCase.amountAtRiskCents < minInvoice) {
      violations.push(
        `Invoice amount (₹${(finOpsCase.amountAtRiskCents / 100).toFixed(2)}) is below minimum threshold for negotiation (₹${(minInvoice / 100).toFixed(2)}).`
      );
    }

    // Rule 12: Monetary Auto-Recovery Maximum Limit
    rulesEvaluated.push('AUTO_RECOVERY_MAX_AMOUNT');
    if (actionType !== 'BOUNDED_NEGOTIATE' && finOpsCase.amountAtRiskCents > policy.autoRecoveryMaxAmountCents) {
      requiresHumanApproval = true;
    }

    // Rule 13: Allowed Communication Channels
    rulesEvaluated.push('ALLOWED_CHANNELS');
    if (channel && !policy.allowedChannels.includes(channel)) {
      violations.push(`Channel '${channel}' is not permitted by merchant policy.`);
    }

    // Rule 14: Weekly Contact Cap (Max Outbound Contacts per 7-Day Window)
    rulesEvaluated.push('WEEKLY_CONTACT_CAP');
    const isOutboundContact = [
      'DISPATCH_INVOICE',
      'DISPATCH_REMINDER',
      'DISPATCH_NEGOTIATION_OFFER',
      'SEND_PAYMENT_LINK',
      'SEND_NUDGE',
      'CHASE_RECEIVABLE',
    ].includes(actionType);

    const maxContacts = policy.maxWeeklyContacts ?? 3;
    const currentContacts = finOpsCase.outboundContactCount7d ?? 0;
    if (isOutboundContact && currentContacts >= maxContacts) {
      violations.push(
        `Weekly outbound contact cap (${maxContacts}) reached for case ${finOpsCase.caseNumber}. Current count: ${currentContacts}. Action '${actionType}' blocked.`
      );
    }

    // Rule 15: Reminder Interval Cooldown
    rulesEvaluated.push('REMINDER_INTERVAL_COOLDOWN');
    if (actionType === 'DISPATCH_REMINDER' && finOpsCase.lastActionAt) {
      const minIntervalHours = policy.minReminderIntervalHours ?? 24;
      const lastActionTime = new Date(finOpsCase.lastActionAt).getTime();
      const elapsedHours = (Date.now() - lastActionTime) / (1000 * 60 * 60);
      if (elapsedHours < minIntervalHours) {
        violations.push(
          `Reminder interval cooldown violation: only ${elapsedHours.toFixed(1)}h elapsed since last contact. Required interval is ${minIntervalHours}h.`
        );
      }
    }

    const passed = violations.length === 0;
    const actionAllowed = passed && !requiresHumanApproval;

    let reason = 'Action conforms to all deterministic merchant policies.';
    if (!passed) {
      reason = `Policy violations: ${violations.join('; ')}`;
    } else if (requiresHumanApproval) {
      reason = 'Action requires human approval due to risk or monetary threshold conditions.';
    }

    return {
      passed,
      actionAllowed,
      requiresHumanApproval,
      violations,
      rulesEvaluated,
      clampedDiscountBps,
      reason,
    };
  }
}
