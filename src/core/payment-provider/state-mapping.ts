import { RazorpayPaymentStatus, SentinelPaymentState } from './types';
import { CaseStatus } from '@/types';

export class PaymentStateMapper {
  /**
   * Explicit mapping from Provider State -> Sentinel Payment State
   */
  public static mapProviderToSentinelState(providerStatus: RazorpayPaymentStatus): SentinelPaymentState {
    switch (providerStatus) {
      case 'created':
        return 'REQUEST_ACCEPTED';
      case 'authorized':
        return 'PAYMENT_SUCCESS';
      case 'captured':
        return 'SETTLEMENT_PENDING';
      case 'failed':
        return 'PAYMENT_FAILED';
      case 'refunded':
        return 'PAYMENT_FAILED';
      default:
        return 'REQUEST_ACCEPTED';
    }
  }

  /**
   * Maps internal Sentinel Payment State to Ledger Case Status.
   * FINTECH LAW: PAYMENT_SUCCESS is NOT SETTLED_VERIFIED until bank settlement is corroborated.
   */
  public static mapSentinelToCaseStatus(sentinelState: SentinelPaymentState): CaseStatus {
    switch (sentinelState) {
      case 'REQUEST_ACCEPTED':
        return 'RECOVERY_EXECUTED';
      case 'PAYMENT_SUCCESS':
      case 'SETTLEMENT_PENDING':
        return 'VERIFYING';
      case 'SETTLEMENT_CONFIRMED':
        return 'SETTLED_VERIFIED';
      case 'PAYMENT_FAILED':
        return 'CLOSED_UNRESOLVED';
      default:
        return 'RECOVERING';
    }
  }
}
