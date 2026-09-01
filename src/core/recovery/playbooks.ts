import { 
  RecoveryPlaybookType, 
  RecoveryActionType, 
  RecoveryChannel, 
  FinOpsCase, 
  TransactionRecord,
  CustomerSegment
} from '@/types';

export interface PlaybookStep {
  stepNumber: number;
  name: string;
  actionType: RecoveryActionType;
  channel: RecoveryChannel;
  delayHours: number;
  discountCapBps?: number;
  conditionDescription: string;
}

export interface RecoveryPlaybook {
  id: RecoveryPlaybookType;
  name: string;
  description: string;
  targetSegments: CustomerSegment[];
  maxRounds: number;
  steps: PlaybookStep[];
}

export const RECOVERY_PLAYBOOKS: Record<RecoveryPlaybookType, RecoveryPlaybook> = {
  FAILED_PAYMENT_PLAYBOOK: {
    id: 'FAILED_PAYMENT_PLAYBOOK',
    name: 'Transient & Gateway Failure Playbook',
    description: 'Autonomous recovery for gateway timeouts, network dropouts, and failed checkouts.',
    targetSegments: ['CONSUMER', 'SMB', 'MID_MARKET'],
    maxRounds: 3,
    steps: [
      {
        stepNumber: 1,
        name: 'Instant Smart Retry',
        actionType: 'RETRY_PAYMENT',
        channel: 'GATEWAY_RETRY',
        delayHours: 0,
        conditionDescription: 'Execute on secondary banking switch within 15 minutes of failure',
      },
      {
        stepNumber: 2,
        name: 'WhatsApp 1-Click Payment Link',
        actionType: 'SEND_PAYMENT_LINK',
        channel: 'WHATSAPP',
        delayHours: 2,
        conditionDescription: 'If retry fails or drops, dispatch direct Razorpay UPI payment link',
      },
      {
        stepNumber: 3,
        name: 'SMS Fallback Nudge',
        actionType: 'SEND_NUDGE',
        channel: 'SMS',
        delayHours: 24,
        conditionDescription: 'If WhatsApp unopened after 24h, dispatch SMS reminder',
      },
    ],
  },

  CHECKOUT_RECOVERY_PLAYBOOK: {
    id: 'CHECKOUT_RECOVERY_PLAYBOOK',
    name: 'Abandoned Checkout & Cart Recovery Playbook',
    description: 'High-conversion interactive cart recovery via WhatsApp & SMS.',
    targetSegments: ['CONSUMER', 'SMB'],
    maxRounds: 2,
    steps: [
      {
        stepNumber: 1,
        name: 'Instant Cart Link via WhatsApp',
        actionType: 'SEND_PAYMENT_LINK',
        channel: 'WHATSAPP',
        delayHours: 1,
        conditionDescription: 'Send cart restoration link 1h post abandonment',
      },
      {
        stepNumber: 2,
        name: 'Email Value Nudge',
        actionType: 'SEND_NUDGE',
        channel: 'EMAIL',
        delayHours: 24,
        conditionDescription: 'Send item availability reminder with checkout link',
      },
    ],
  },

  B2B_OVERDUE_PLAYBOOK: {
    id: 'B2B_OVERDUE_PLAYBOOK',
    name: 'Enterprise & B2B Overdue Invoice Playbook',
    description: 'Structured enterprise receivable recovery with GST tax invoices and bounded negotiation.',
    targetSegments: ['ENTERPRISE', 'MID_MARKET'],
    maxRounds: 4,
    steps: [
      {
        stepNumber: 1,
        name: 'Dispatch PDF GST Tax Invoice',
        actionType: 'DISPATCH_INVOICE',
        channel: 'EMAIL',
        delayHours: 0,
        conditionDescription: 'Generate itemized PDF invoice with SAC codes and payment link',
      },
      {
        stepNumber: 2,
        name: 'T+24h Polite WhatsApp Reminder',
        actionType: 'DISPATCH_REMINDER',
        channel: 'WHATSAPP',
        delayHours: 24,
        conditionDescription: 'Coordinated follow-up with finance point of contact',
      },
      {
        stepNumber: 3,
        name: 'Bounded Settlement Offer',
        actionType: 'BOUNDED_NEGOTIATE',
        channel: 'EMAIL',
        delayHours: 72,
        discountCapBps: 1000,
        conditionDescription: 'If unpaid > 30 days, offer bounded early payment incentive (max 10%)',
      },
      {
        stepNumber: 4,
        name: 'Operator Escalation',
        actionType: 'ESCALATE_HUMAN',
        channel: 'PORTAL',
        delayHours: 120,
        conditionDescription: 'Escalate to FinOps lead if unresponsive after 4 attempts',
      },
    ],
  },

  SUBSCRIPTION_DUNNING_PLAYBOOK: {
    id: 'SUBSCRIPTION_DUNNING_PLAYBOOK',
    name: 'Recurring Subscription Dunning Playbook',
    description: 'Automated recurring billing drops and mandate retries.',
    targetSegments: ['CONSUMER', 'SMB', 'MID_MARKET'],
    maxRounds: 3,
    steps: [
      {
        stepNumber: 1,
        name: 'Smart Mandate Retry',
        actionType: 'RETRY_MANDATE',
        channel: 'GATEWAY_RETRY',
        delayHours: 12,
        conditionDescription: 'Re-trigger mandate at optimal bank processing window (06:00 UTC)',
      },
      {
        stepNumber: 2,
        name: 'Payment Instrument Update Link',
        actionType: 'SEND_PAYMENT_LINK',
        channel: 'WHATSAPP',
        delayHours: 36,
        conditionDescription: 'Send 1-click card/mandate update link to customer',
      },
      {
        stepNumber: 3,
        name: 'Service Suspension Warning',
        actionType: 'SEND_NUDGE',
        channel: 'EMAIL',
        delayHours: 72,
        conditionDescription: 'Final dunning notice before plan pause',
      },
    ],
  },

  MANDATE_FAILURE_PLAYBOOK: {
    id: 'MANDATE_FAILURE_PLAYBOOK',
    name: 'UPI AutoPay & e-Mandate Recovery Playbook',
    description: 'Rapid mandate re-authorization for subscription and EMI schedules.',
    targetSegments: ['CONSUMER', 'SMB'],
    maxRounds: 2,
    steps: [
      {
        stepNumber: 1,
        name: 'UPI Collect & Re-auth',
        actionType: 'SEND_PAYMENT_LINK',
        channel: 'WHATSAPP',
        delayHours: 4,
        conditionDescription: 'Dispatch NPCI-compliant UPI AutoPay re-authorization prompt',
      },
      {
        stepNumber: 2,
        name: 'Alternate Payment Fallback',
        actionType: 'SEND_PAYMENT_LINK',
        channel: 'SMS',
        delayHours: 24,
        conditionDescription: 'Send debit card / netbanking alternate checkout link',
      },
    ],
  },

  NEGOTIATION_PLAYBOOK: {
    id: 'NEGOTIATION_PLAYBOOK',
    name: 'Bounded B2B Negotiation Playbook',
    description: '2-Round bounded negotiation protocol strictly enforced by policy.',
    targetSegments: ['ENTERPRISE', 'MID_MARKET'],
    maxRounds: 2,
    steps: [
      {
        stepNumber: 1,
        name: 'Initial Agent Offer (Round 1)',
        actionType: 'OFFER_BOUNDED_DISCOUNT',
        channel: 'EMAIL',
        delayHours: 0,
        discountCapBps: 500, // 5.0%
        conditionDescription: 'Agent proposes 5.0% early settlement discount',
      },
      {
        stepNumber: 2,
        name: 'Final Bounded Counter (Round 2)',
        actionType: 'BOUNDED_NEGOTIATE',
        channel: 'WHATSAPP',
        delayHours: 48,
        discountCapBps: 1000, // 10.0% max
        conditionDescription: 'Customer counter validated; maximum 10% discount or minimum 85% floor',
      },
    ],
  },

  PROMISE_TO_PAY_PLAYBOOK: {
    id: 'PROMISE_TO_PAY_PLAYBOOK',
    name: 'Promise to Pay Grace & Verification Playbook',
    description: 'Grace period lock and scheduled payment verification.',
    targetSegments: ['ENTERPRISE', 'MID_MARKET', 'SMB', 'CONSUMER'],
    maxRounds: 2,
    steps: [
      {
        stepNumber: 1,
        name: 'Register Commitment & Lock Grace Period',
        actionType: 'REGISTER_PROMISE_TO_PAY',
        channel: 'PORTAL',
        delayHours: 0,
        conditionDescription: 'Lock outbound communications until commitment due date',
      },
      {
        stepNumber: 2,
        name: 'Due Date Verification & Follow-up',
        actionType: 'CHECK_PAYMENT_STATUS',
        channel: 'GATEWAY',
        delayHours: 0,
        conditionDescription: 'On promise date, verify bank settlement; resume recovery if broken',
      },
    ],
  },
};

/**
 * Determine optimal recovery playbook for a FinOps case
 */
export function selectPlaybookForCase(
  finOpsCase: FinOpsCase,
  tx?: TransactionRecord
): RecoveryPlaybookType {
  if (finOpsCase.promiseToPay && finOpsCase.promiseToPay.status === 'PENDING') {
    return 'PROMISE_TO_PAY_PLAYBOOK';
  }

  if (finOpsCase.negotiation || (tx?.customerSegment === 'ENTERPRISE' && (tx.daysOverdue ?? 0) > 30)) {
    return 'NEGOTIATION_PLAYBOOK';
  }

  if (tx?.customerSegment === 'ENTERPRISE' || tx?.customerSegment === 'MID_MARKET' || finOpsCase.amountAtRiskCents >= 2000000) {
    return 'B2B_OVERDUE_PLAYBOOK';
  }

  if (tx?.paymentMethod === 'AUTOPAY' || finOpsCase.scenarioType?.includes('SUBSCRIPTION')) {
    return 'SUBSCRIPTION_DUNNING_PLAYBOOK';
  }

  if (tx?.errorCode === 'MANDATE_EXPIRED' || tx?.errorCode === 'VPA_NOT_FOUND') {
    return 'MANDATE_FAILURE_PLAYBOOK';
  }

  if (finOpsCase.scenarioType === 'ABANDONED_CHECKOUT') {
    return 'CHECKOUT_RECOVERY_PLAYBOOK';
  }

  return 'FAILED_PAYMENT_PLAYBOOK';
}
