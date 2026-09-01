import { RecoveryChannel, ReconStatus, SettlementRecord, TransactionRecord } from '@/types';

export type PaymentProviderMode = 'SIMULATION' | 'RAZORPAY_TEST';

export type RazorpayPaymentStatus =
  | 'created'
  | 'authorized'
  | 'captured'
  | 'refunded'
  | 'failed';

export type SentinelPaymentState =
  | 'REQUEST_ACCEPTED'
  | 'PAYMENT_SUCCESS'
  | 'PAYMENT_FAILED'
  | 'SETTLEMENT_PENDING'
  | 'SETTLEMENT_CONFIRMED';

export interface PaymentOrderRequest {
  idempotencyKey: string;
  amountCents: number;
  currency: string;
  receipt: string;
  notes?: Record<string, string>;
  customerEmail?: string;
  customerPhone?: string;
}

export interface PaymentOrderResponse {
  success: boolean;
  orderId: string;
  amountCents: number;
  currency: string;
  status: RazorpayPaymentStatus;
  providerMode: PaymentProviderMode;
  createdAt: string;
}

export interface PaymentLinkRequest {
  idempotencyKey: string;
  amountCents: number;
  currency: string;
  description: string;
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  channel: RecoveryChannel;
  discountBps?: number;
  expireByTimestamp?: number;
}

export interface PaymentLinkResponse {
  success: boolean;
  paymentLinkId: string;
  shortUrl: string;
  amountCents: number;
  discountBpsApplied: number;
  status: 'created' | 'partially_paid' | 'paid' | 'expired' | 'cancelled';
  providerMode: PaymentProviderMode;
  createdAt: string;
}

export interface PaymentStatusResult {
  paymentId: string;
  orderId?: string;
  amountCents: number;
  currency: string;
  status: RazorpayPaymentStatus;
  sentinelState: SentinelPaymentState;
  method: string;
  bankUtr?: string;
  errorCode?: string;
  errorDescription?: string;
  feeCents: number;
  taxCents: number;
  capturedAt?: string;
}

export interface SettlementBatchPayload {
  batchId: string;
  totalCount: number;
  totalGrossCents: number;
  totalFeeCents: number;
  totalTaxCents: number;
  totalNetCents: number;
  settlements: SettlementRecord[];
}

export interface WebhookPayload {
  entity: string;
  account_id: string;
  event: string;
  contains: string[];
  payload: {
    payment?: { entity: any };
    order?: { entity: any };
    settlement?: { entity: any };
    payment_link?: { entity: any };
  };
  created_at: number;
}

export interface WebhookVerificationResult {
  validSignature: boolean;
  isDuplicate: boolean;
  eventId: string;
  eventType: string;
  sentinelState: SentinelPaymentState;
  extractedPayload: Record<string, any>;
  reason: string;
}

export interface FaultInjectionConfig {
  simulateTimeout?: boolean;
  simulate5xxError?: boolean;
  simulateDuplicateWebhook?: boolean;
  simulateDelayedSettlement?: boolean;
  simulatePartialSettlement?: boolean;
  simulateSettlementMismatch?: boolean;
}

export interface PaymentExecutionProvider {
  createOrder(req: PaymentOrderRequest): Promise<PaymentOrderResponse>;
  createPaymentLink(req: PaymentLinkRequest): Promise<PaymentLinkResponse>;
  retryPayment(paymentId: string, idempotencyKey: string): Promise<PaymentOrderResponse>;
}

export interface PaymentStatusProvider {
  getPaymentStatus(paymentId: string): Promise<PaymentStatusResult>;
}

export interface SettlementProvider {
  fetchSettlementBatch(batchId: string): Promise<SettlementBatchPayload>;
}

export interface WebhookEventProvider {
  processWebhook(
    rawBody: string,
    signature: string,
    secret: string
  ): Promise<WebhookVerificationResult>;
}
