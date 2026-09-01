import { CaseStatus } from '@/types';

export interface StateTransitionResult {
  allowed: boolean;
  from: CaseStatus;
  to: CaseStatus;
  reason?: string;
}

export class FinOpsStateMachine {
  private static readonly VALID_TRANSITIONS: Record<CaseStatus, CaseStatus[]> = {
    NEW: ['RECONCILING', 'EXCEPTION_DETECTED'],
    RECONCILING: ['RECONCILED', 'EXCEPTION_DETECTED'],
    RECONCILED: ['VERIFYING'],
    EXCEPTION_DETECTED: ['RISK_TRIAGING', 'OPS_APPROVED', 'RECOVERY_ELIGIBLE', 'RISK_BLOCKED', 'HUMAN_REVIEW_REQUIRED', 'CLOSED_UNRESOLVED'],
    RISK_TRIAGING: ['OPS_APPROVED', 'RECOVERY_ELIGIBLE', 'RISK_BLOCKED', 'HUMAN_REVIEW_REQUIRED'],
    OPS_APPROVED: ['RECOVERY_ELIGIBLE', 'RECOVERING', 'RECOVERY_EXECUTED', 'HUMAN_REVIEW_REQUIRED', 'CLOSED_UNRESOLVED'],
    RECOVERY_ELIGIBLE: ['RECOVERING', 'RECOVERY_EXECUTED', 'HUMAN_REVIEW_REQUIRED', 'RISK_BLOCKED', 'CLOSED_UNRESOLVED'],
    RISK_BLOCKED: ['HUMAN_REVIEW_REQUIRED', 'CLOSED_WRITTEN_OFF'],
    HUMAN_REVIEW_REQUIRED: ['OPS_APPROVED', 'RECOVERY_ELIGIBLE', 'RISK_BLOCKED', 'RECOVERING', 'CLOSED_UNRESOLVED', 'CLOSED_WRITTEN_OFF'],
    RECOVERING: ['RECOVERY_EXECUTED', 'PARTIALLY_RECOVERED', 'RISK_BLOCKED', 'HUMAN_REVIEW_REQUIRED', 'CLOSED_UNRESOLVED'],
    RECOVERY_EXECUTED: ['VERIFYING', 'PARTIALLY_RECOVERED', 'SETTLED_VERIFIED', 'HUMAN_REVIEW_REQUIRED', 'CLOSED_UNRESOLVED'],
    VERIFYING: ['SETTLED_VERIFIED', 'PARTIALLY_RECOVERED', 'OPS_APPROVED', 'HUMAN_REVIEW_REQUIRED', 'CLOSED_UNRESOLVED'],
    PARTIALLY_RECOVERED: ['RECOVERING', 'RECOVERY_EXECUTED', 'VERIFYING', 'SETTLED_VERIFIED', 'HUMAN_REVIEW_REQUIRED', 'CLOSED_WRITTEN_OFF'],
    SETTLED_VERIFIED: [], // Terminal success
    CLOSED_UNRESOLVED: ['HUMAN_REVIEW_REQUIRED', 'OPS_APPROVED', 'RECOVERY_ELIGIBLE', 'RECOVERING', 'CLOSED_WRITTEN_OFF'],
    CLOSED_WRITTEN_OFF: [], // Terminal writeoff
  };

  public static canTransition(from: CaseStatus, to: CaseStatus): boolean {
    const allowedTargets = this.VALID_TRANSITIONS[from];
    return !!allowedTargets && allowedTargets.includes(to);
  }

  public static validateTransition(from: CaseStatus, to: CaseStatus): StateTransitionResult {
    const allowed = this.canTransition(from, to);
    if (!allowed) {
      return {
        allowed: false,
        from,
        to,
        reason: `Illegal state transition from '${from}' to '${to}'. Allowed target states are: [${(this.VALID_TRANSITIONS[from] || []).join(', ')}]`,
      };
    }
    return {
      allowed: true,
      from,
      to,
    };
  }

  public static isTerminal(status: CaseStatus): boolean {
    return status === 'SETTLED_VERIFIED' || status === 'CLOSED_WRITTEN_OFF';
  }
}
