import { 
  PaymentExecutionProvider,
  PaymentStatusProvider,
  SettlementProvider,
  WebhookEventProvider,
  PaymentOrderRequest,
  PaymentOrderResponse,
  PaymentLinkRequest,
  PaymentLinkResponse,
  PaymentStatusResult,
  SettlementBatchPayload,
  WebhookVerificationResult,
  FaultInjectionConfig,
  PaymentProviderMode
} from './types';
import { SettlementRecord } from '@/types';
import { PaymentStateMapper } from './state-mapping';

export class SimulationPaymentAdapter
  implements PaymentExecutionProvider, PaymentStatusProvider, SettlementProvider, WebhookEventProvider {
  
  private idempotencyStore = new Map<string, any>();
  private processedWebhookEvents = new Set<string>();
  private faultConfig: FaultInjectionConfig = {};
  public readonly providerMode: PaymentProviderMode = 'SIMULATION';

  constructor(faults?: FaultInjectionConfig) {
    if (faults) this.faultConfig = faults;
  }

  public setFaultConfig(config: FaultInjectionConfig): void {
    this.faultConfig = config;
  }

  public async createOrder(req: PaymentOrderRequest): Promise<PaymentOrderResponse> {
    // 1. Idempotency Check
    if (this.idempotencyStore.has(req.idempotencyKey)) {
      return this.idempotencyStore.get(req.idempotencyKey);
    }

    // 2. Fault Injection Check
    if (this.faultConfig.simulateTimeout) {
      throw new Error('PROVIDER_TIMEOUT_504: Gateway connection timed out');
    }
    if (this.faultConfig.simulate5xxError) {
      throw new Error('PROVIDER_500: Internal upstream payment gateway server error');
    }

    const orderId = `order_sim_${Math.random().toString(36).substring(2, 9)}`;
    const response: PaymentOrderResponse = {
      success: true,
      orderId,
      amountCents: req.amountCents,
      currency: req.currency,
      status: 'created',
      providerMode: this.providerMode,
      createdAt: new Date().toISOString(),
    };

    this.idempotencyStore.set(req.idempotencyKey, response);
    return response;
  }

  public async createPaymentLink(req: PaymentLinkRequest): Promise<PaymentLinkResponse> {
    if (this.idempotencyStore.has(req.idempotencyKey)) {
      return this.idempotencyStore.get(req.idempotencyKey);
    }

    if (this.faultConfig.simulateTimeout) {
      throw new Error('PROVIDER_TIMEOUT_504: Payment link API timed out');
    }

    const linkId = `plink_sim_${Math.random().toString(36).substring(2, 9)}`;
    const discount = req.discountBps ?? 0;
    const finalAmount = Math.round((req.amountCents * (10000 - discount)) / 10000);

    const response: PaymentLinkResponse = {
      success: true,
      paymentLinkId: linkId,
      shortUrl: `https://rzp.io/i/${linkId}`,
      amountCents: finalAmount,
      discountBpsApplied: discount,
      status: 'created',
      providerMode: this.providerMode,
      createdAt: new Date().toISOString(),
    };

    this.idempotencyStore.set(req.idempotencyKey, response);
    return response;
  }

  public async retryPayment(paymentId: string, idempotencyKey: string): Promise<PaymentOrderResponse> {
    if (this.idempotencyStore.has(idempotencyKey)) {
      return this.idempotencyStore.get(idempotencyKey);
    }

    if (this.faultConfig.simulateTimeout) {
      throw new Error('PROVIDER_TIMEOUT_504: Retry gateway attempt timed out');
    }

    const response: PaymentOrderResponse = {
      success: true,
      orderId: `order_retry_${paymentId}`,
      amountCents: 500000,
      currency: 'INR',
      status: 'authorized',
      providerMode: this.providerMode,
      createdAt: new Date().toISOString(),
    };

    this.idempotencyStore.set(idempotencyKey, response);
    return response;
  }

  public async getPaymentStatus(paymentId: string): Promise<PaymentStatusResult> {
    const isCaptured = !this.faultConfig.simulate5xxError;
    const status = isCaptured ? 'captured' : 'failed';

    return {
      paymentId,
      amountCents: 500000,
      currency: 'INR',
      status,
      sentinelState: PaymentStateMapper.mapProviderToSentinelState(status),
      method: 'upi',
      bankUtr: `UTR_${Math.floor(100000 + Math.random() * 900000)}`,
      feeCents: 1000,
      taxCents: 180,
      capturedAt: new Date().toISOString(),
    };
  }

  public async fetchSettlementBatch(batchId: string): Promise<SettlementBatchPayload> {
    const gross = 1000000;
    const fee = 2000;
    const tax = 360;
    let net = gross - fee - tax;

    if (this.faultConfig.simulatePartialSettlement) {
      net = Math.round(net * 0.6); // 60% partial settlement
    } else if (this.faultConfig.simulateSettlementMismatch) {
      net = net - 5000; // Unreconciled mismatch
    }

    const item: SettlementRecord = {
      id: `st_${batchId}_01`,
      batchId,
      utrRrn: `UTR_BATCH_${batchId}`,
      amountCents: net,
      feeCents: fee,
      taxCents: tax,
      netAmountCents: net,
      currency: 'INR',
      bankTimestamp: new Date().toISOString(),
      rawDescription: `SETTLEMENT-BATCH-${batchId}`,
      createdAt: new Date().toISOString(),
    };

    return {
      batchId,
      totalCount: 1,
      totalGrossCents: gross,
      totalFeeCents: fee,
      totalTaxCents: tax,
      totalNetCents: net,
      settlements: [item],
    };
  }

  public async processWebhook(
    rawBody: string,
    signature: string,
    secret: string
  ): Promise<WebhookVerificationResult> {
    let parsed: any = {};
    try {
      parsed = JSON.parse(rawBody);
    } catch {
      return {
        validSignature: false,
        isDuplicate: false,
        eventId: 'unknown',
        eventType: 'invalid_json',
        sentinelState: 'PAYMENT_FAILED',
        extractedPayload: {},
        reason: 'Malformed webhook JSON payload',
      };
    }

    const eventId = parsed.id || `evt_${Math.random().toString(36).substring(2, 8)}`;
    const eventType = parsed.event || 'payment.captured';

    // Check duplicate
    if (this.processedWebhookEvents.has(eventId)) {
      return {
        validSignature: true,
        isDuplicate: true,
        eventId,
        eventType,
        sentinelState: 'SETTLEMENT_PENDING',
        extractedPayload: parsed,
        reason: `Duplicate webhook event '${eventId}' discarded idempotently`,
      };
    }

    // Mark processed
    this.processedWebhookEvents.add(eventId);

    // Signature verification check (Simulated HMAC check)
    const validSignature = signature.length >= 10 && !signature.includes('INVALID');

    return {
      validSignature,
      isDuplicate: false,
      eventId,
      eventType,
      sentinelState: validSignature ? 'SETTLEMENT_PENDING' : 'PAYMENT_FAILED',
      extractedPayload: parsed,
      reason: validSignature ? 'Webhook verified and processed' : 'Invalid webhook HMAC signature',
    };
  }
}
