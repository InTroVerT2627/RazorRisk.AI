import crypto from 'crypto';
import { WebhookPayload, WebhookVerificationResult } from './types';
import { PaymentStateMapper } from './state-mapping';
import { AuditLogger } from '@/core/audit/audit-logger';

export class RazorpayWebhookHandler {
  private static processedEventIds = new Set<string>();
  private static audit = AuditLogger.getInstance();

  /**
   * Verifies Razorpay Webhook signature (HMAC SHA-256) and processes event with strict idempotency.
   */
  public static verifyAndProcessEvent(
    rawBody: string,
    signature: string,
    webhookSecret: string
  ): WebhookVerificationResult {
    // 1. Verify HMAC SHA-256 Signature
    let validSignature = false;
    try {
      const expectedSignature = crypto
        .createHmac('sha256', webhookSecret)
        .update(rawBody)
        .digest('hex');
      validSignature = crypto.timingSafeEqual(
        Buffer.from(expectedSignature, 'utf-8'),
        Buffer.from(signature, 'utf-8')
      );
    } catch {
      validSignature = false;
    }

    if (!validSignature) {
      return {
        validSignature: false,
        isDuplicate: false,
        eventId: 'invalid',
        eventType: 'unknown',
        sentinelState: 'PAYMENT_FAILED',
        extractedPayload: {},
        reason: 'HMAC signature verification failed. Event discarded.',
      };
    }

    // 2. Parse Payload
    let payload: WebhookPayload;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return {
        validSignature: true,
        isDuplicate: false,
        eventId: 'malformed_json',
        eventType: 'unknown',
        sentinelState: 'PAYMENT_FAILED',
        extractedPayload: {},
        reason: 'Malformed webhook JSON payload.',
      };
    }

    const eventId = (payload as any).id || `${payload.event}_${payload.created_at}`;
    const eventType = payload.event;

    // 3. Idempotency Check (Deduplicate)
    if (this.processedEventIds.has(eventId)) {
      return {
        validSignature: true,
        isDuplicate: true,
        eventId,
        eventType,
        sentinelState: 'SETTLEMENT_PENDING',
        extractedPayload: payload.payload,
        reason: `Event '${eventId}' was already processed. Duplicate skipped idempotently.`,
      };
    }

    // Mark as processed
    this.processedEventIds.add(eventId);

    // 4. Map Event to Sentinel State
    let sentinelState = PaymentStateMapper.mapProviderToSentinelState('captured');
    if (eventType === 'payment.failed') {
      sentinelState = 'PAYMENT_FAILED';
    } else if (eventType === 'payment.authorized') {
      sentinelState = 'PAYMENT_SUCCESS';
    } else if (eventType === 'settlement.processed') {
      sentinelState = 'SETTLEMENT_CONFIRMED';
    }

    // 5. Record Cryptographic Audit Log
    this.audit.record({
      actorType: 'SYSTEM',
      actorId: 'RAZORPAY_WEBHOOK_HANDLER',
      action: `WEBHOOK_EVENT_${eventType.toUpperCase().replace('.', '_')}`,
      decision: `Webhook verified (${eventId}). Sentinel state mapped to: ${sentinelState}`,
      stateBefore: { eventId, status: 'RECEIVED' },
      stateAfter: { eventId, status: 'PROCESSED', sentinelState },
      confidence: 1.0,
      reasoningSummary: `Valid HMAC SHA-256 signature verified for event ${eventId}.`,
    });

    return {
      validSignature: true,
      isDuplicate: false,
      eventId,
      eventType,
      sentinelState,
      extractedPayload: payload.payload,
      reason: `Webhook processed successfully as ${sentinelState}`,
    };
  }

  public static clearDeduplicationCache(): void {
    this.processedEventIds.clear();
  }
}
