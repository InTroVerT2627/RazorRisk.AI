import { 
  FinOpsCase, 
  TransactionRecord, 
  RecoveryPriority, 
  CustomerSegment 
} from '@/types';
import { RecoveryEligibilityEngine } from './eligibility-engine';

export interface PriorityWeights {
  wAmount: number;
  wAge: number;
  wProbability: number;
  wSegment: number;
  wRisk: number;
}

export interface PriorityEvaluationResult {
  priority: RecoveryPriority;
  priorityScore: number; // 0.0 - 1.0
  priorityReason: string;
  normalizedComponents: {
    normalizedAmount: number;
    normalizedDaysOverdue: number;
    paymentProbability: number;
    segmentWeight: number;
    riskPenalty: number;
  };
  dominantFactors: string[];
}

export const DEFAULT_PRIORITY_WEIGHTS: PriorityWeights = {
  wAmount: 0.35,
  wAge: 0.20,
  wProbability: 0.25,
  wSegment: 0.20,
  wRisk: 0.25,
};

export class RecoveryPriorityEngine {
  private static instance: RecoveryPriorityEngine;
  private eligibilityEngine: RecoveryEligibilityEngine;

  private constructor() {
    this.eligibilityEngine = RecoveryEligibilityEngine.getInstance();
  }

  public static getInstance(): RecoveryPriorityEngine {
    if (!RecoveryPriorityEngine.instance) {
      RecoveryPriorityEngine.instance = new RecoveryPriorityEngine();
    }
    return RecoveryPriorityEngine.instance;
  }

  /**
   * Evaluate normalized priority score for a recovery case
   */
  public evaluatePriority(
    finOpsCase: FinOpsCase,
    tx?: TransactionRecord,
    weights: PriorityWeights = DEFAULT_PRIORITY_WEIGHTS
  ): PriorityEvaluationResult {
    const recoverableAmountCents = finOpsCase.remainingRecoverableAmountCents ?? finOpsCase.amountAtRiskCents;
    const daysOverdue = tx?.daysOverdue ?? 10;
    const segment: CustomerSegment = tx?.customerSegment || 'SMB';
    const riskScore = finOpsCase.riskScore ?? 20;

    // 1. Component Normalization (0.0 to 1.0)
    const normalizedAmount = Math.min(1.0, recoverableAmountCents / 5000000); // Scale up to ₹50k
    const normalizedDaysOverdue = Math.min(1.0, daysOverdue / 90); // Scale up to 90 days
    const paymentProbability = this.eligibilityEngine.calculateRecoveryProbability(finOpsCase, tx);
    
    let segmentWeight = 0.5;
    if (segment === 'ENTERPRISE') segmentWeight = 1.0;
    else if (segment === 'MID_MARKET') segmentWeight = 0.8;
    else if (segment === 'SMB') segmentWeight = 0.6;
    else if (segment === 'CONSUMER') segmentWeight = 0.4;

    const riskPenalty = Math.min(1.0, riskScore / 100);

    // 2. Weighted Priority Formula
    const rawScore =
      weights.wAmount * normalizedAmount +
      weights.wAge * normalizedDaysOverdue +
      weights.wProbability * paymentProbability +
      weights.wSegment * segmentWeight -
      weights.wRisk * riskPenalty;

    const priorityScore = Math.max(0.0, Math.min(1.0, Number(rawScore.toFixed(3))));

    // 3. Dominant Factor Extraction
    const dominantFactors: string[] = [];
    if (normalizedAmount >= 0.7) dominantFactors.push(`High recoverable value (₹${(recoverableAmountCents / 100).toLocaleString('en-IN')})`);
    if (segment === 'ENTERPRISE') dominantFactors.push('Key Enterprise account');
    if (paymentProbability >= 0.8) dominantFactors.push(`High payment probability (${Math.round(paymentProbability * 100)}%)`);
    if (normalizedDaysOverdue >= 0.5) dominantFactors.push(`Aging receivable (${daysOverdue} days overdue)`);
    if (riskPenalty <= 0.25) dominantFactors.push('Clean risk profile');

    // 4. Priority Categorization
    let priority: RecoveryPriority = 'P3';
    if (priorityScore >= 0.65 || recoverableAmountCents >= 5000000 || (segment === 'ENTERPRISE' && riskScore < 30)) {
      priority = 'P0';
    } else if (priorityScore >= 0.45 || recoverableAmountCents >= 1000000 || segment === 'MID_MARKET') {
      priority = 'P1';
    } else if (priorityScore >= 0.25 || recoverableAmountCents >= 200000 || segment === 'SMB') {
      priority = 'P2';
    }

    const priorityReason = `${priority} Priority (Score: ${(priorityScore * 100).toFixed(0)}/100): ${dominantFactors.slice(0, 3).join(', ') || 'Standard operational recovery'}`;

    return {
      priority,
      priorityScore,
      priorityReason,
      normalizedComponents: {
        normalizedAmount,
        normalizedDaysOverdue,
        paymentProbability,
        segmentWeight,
        riskPenalty,
      },
      dominantFactors,
    };
  }
}
