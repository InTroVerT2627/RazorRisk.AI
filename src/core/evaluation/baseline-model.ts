import { PublicCaseData, ReconStatus, RiskClassification, RecoveryActionType } from '@/types';

export interface BaselineDecision {
  reconStatus: ReconStatus;
  riskClassification: RiskClassification;
  riskScore: number;
  recoveryAction: RecoveryActionType;
  recoveredAmountCents: number;
  blockedRisk: boolean;
}

/**
 * Deterministic naive baseline for benchmarking against RazorRisk.AI.
 * Uses rigid heuristics (e.g. amount thresholds, fixed retries, naive matching).
 */
export class NaiveBaselineModel {
  public static evaluate(publicCase: PublicCaseData): BaselineDecision {
    const tx = publicCase.transaction;
    const st = publicCase.settlement;
    const sig = publicCase.signals;

    // 1. Baseline Naive Reconciliation (Pure exact string match only)
    let reconStatus: ReconStatus = 'UNMATCHED_TRANSACTION';
    if (st && tx.externalRef === st.utrRrn && tx.amountCents === st.amountCents) {
      reconStatus = 'EXACT_MATCH';
    } else if (st && tx.amountCents !== st.amountCents) {
      reconStatus = 'AMOUNT_MISMATCH';
    } else if (tx.status === 'DISPUTED') {
      reconStatus = 'CHARGEBACK_SUSPECTED';
    }

    // 2. Baseline Naive Risk Heuristic (Rigid threshold: Amount > ₹50k or Velocity > 3 is blocked as fraud)
    // NOTE: This creates false-positive traps on legitimate high value outliers and legitimate velocity spikes!
    let riskScore = 15;
    let riskClassification: RiskClassification = 'OPS_SHAPED';
    let blockedRisk = false;

    if (tx.amountCents > 5000000) {
      // Amount > ₹50,000 -> Naive baseline blindly flags as risk
      riskScore = 85;
      riskClassification = 'RISK_SHAPED';
      blockedRisk = true;
    } else if (sig.customerVelocity24h > 3) {
      // Velocity > 3 -> Naive baseline blindly flags as risk
      riskScore = 80;
      riskClassification = 'RISK_SHAPED';
      blockedRisk = true;
    } else if (sig.chargebackHistoryRatio > 0.1) {
      riskScore = 75;
      riskClassification = 'RISK_SHAPED';
      blockedRisk = true;
    } else if (sig.deviceFingerprintRisk === 'HIGH') {
      riskScore = 70;
      riskClassification = 'RISK_SHAPED';
      blockedRisk = true;
    }

    // 3. Baseline Naive Recovery (Blindly retries everything not blocked, without dynamic channels or bounded discounts)
    let recoveryAction: RecoveryActionType = 'RETRY_PAYMENT';
    let recoveredAmountCents = 0;

    if (blockedRisk) {
      recoveryAction = 'STOP_RECOVERY';
    } else if (tx.status === 'FAILED') {
      recoveryAction = 'RETRY_PAYMENT';
      // Naive baseline assumes 40% flat recovery success if not blocked
      if (sig.deviceFingerprintRisk === 'LOW' && tx.errorCode !== 'INSUFFICIENT_FUNDS_51') {
        recoveredAmountCents = tx.amountCents;
      }
    }

    return {
      reconStatus,
      riskClassification,
      riskScore,
      recoveryAction,
      recoveredAmountCents,
      blockedRisk,
    };
  }
}
