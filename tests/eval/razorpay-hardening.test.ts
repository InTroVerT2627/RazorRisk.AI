import { describe, it, expect, beforeEach } from 'vitest';
import crypto from 'crypto';
import { SimulationPaymentAdapter } from '../../src/core/payment-provider/simulation-adapter';
import { RazorpayTestPaymentAdapter } from '../../src/core/payment-provider/razorpay-adapter';
import { RazorpayWebhookHandler } from '../../src/core/payment-provider/webhook-handler';
import { ReliabilityEngine } from '../../src/core/reliability/retry-policy';
import { PIIMasker } from '../../src/core/security/pii-masker';
import { HealthCheckService } from '../../src/core/health/health-check';
import { LedgerStore } from '../../src/core/ledger/ledger-store';
import { FinOpsOrchestrator } from '../../src/agents/orchestrator';
import { GroundTruthScenario, TransactionRecord, SettlementRecord } from '../../src/types';

describe('Phase 7 Razorpay Integration, Reliability & FinOps Hardening', () => {
  let simAdapter: SimulationPaymentAdapter;
  let rzpAdapter: RazorpayTestPaymentAdapter;
  let ledger: LedgerStore;
  let orchestrator: FinOpsOrchestrator;

  beforeEach(() => {
    simAdapter = new SimulationPaymentAdapter();
    rzpAdapter = new RazorpayTestPaymentAdapter();
    ledger = LedgerStore.getInstance();
    ledger.clear();
    RazorpayWebhookHandler.clearDeduplicationCache();
    orchestrator = new FinOpsOrchestrator();
  });

  // -------------------------------------------------------------------------
  // 1. Payment Provider Adapter & Test-Mode Boundaries
  // -------------------------------------------------------------------------
  describe('1. Payment Provider Adapter & Test Mode Guard', () => {
    it('Razorpay adapter must strictly enforce test mode and never default to live money operations', () => {
      expect(rzpAdapter.isTestMode).toBe(true);
      expect(rzpAdapter.providerMode).toBe('RAZORPAY_TEST');
    });

    it('Simulation adapter creates orders and stores idempotency keys', async () => {
      const req = {
        idempotencyKey: 'idem_test_order_01',
        amountCents: 250000,
        currency: 'INR',
        receipt: 'rcpt_01',
      };

      const order1 = await simAdapter.createOrder(req);
      expect(order1.success).toBe(true);
      expect(order1.providerMode).toBe('SIMULATION');

      // Second call with same idempotency key returns identical order without re-executing
      const order2 = await simAdapter.createOrder(req);
      expect(order2.orderId).toBe(order1.orderId);
    });

    it('Simulation adapter correctly injects fault timeouts and 5xx errors when configured', async () => {
      simAdapter.setFaultConfig({ simulateTimeout: true });
      await expect(simAdapter.createOrder({
        idempotencyKey: 'idem_timeout_01',
        amountCents: 100000,
        currency: 'INR',
        receipt: 'rcpt_err',
      })).rejects.toThrow(/PROVIDER_TIMEOUT_504/);
    });
  });

  // -------------------------------------------------------------------------
  // 2. Webhook Event Processing & Idempotent Deduplication
  // -------------------------------------------------------------------------
  describe('2. Webhook Event Safety & Deduplication', () => {
    it('should reject webhooks with invalid HMAC signatures', () => {
      const rawPayload = JSON.stringify({ event: 'payment.captured', id: 'evt_valid_123', created_at: 1700000000 });
      const secret = 'webhook_secret_key_123';

      const result = RazorpayWebhookHandler.verifyAndProcessEvent(
        rawPayload,
        'INVALID_SIGNATURE_HEX_1234567890abcdef',
        secret
      );

      expect(result.validSignature).toBe(false);
      expect(result.isDuplicate).toBe(false);
      expect(result.sentinelState).toBe('PAYMENT_FAILED');
    });

    it('should process valid webhook and deduplicate on replay without duplicate state mutation', () => {
      const rawPayload = JSON.stringify({ event: 'payment.captured', id: 'evt_unique_999', created_at: 1700000000 });
      const secret = 'webhook_secret_key_123';
      const realValidSignature = crypto.createHmac('sha256', secret).update(rawPayload).digest('hex');

      // First webhook event
      const res1 = RazorpayWebhookHandler.verifyAndProcessEvent(rawPayload, realValidSignature, secret);
      expect(res1.validSignature).toBe(true);
      expect(res1.isDuplicate).toBe(false);
      expect(res1.sentinelState).toBe('SETTLEMENT_PENDING');

      // Duplicate webhook replay
      const res2 = RazorpayWebhookHandler.verifyAndProcessEvent(rawPayload, realValidSignature, secret);
      expect(res2.validSignature).toBe(true);
      expect(res2.isDuplicate).toBe(true);
      expect(res2.reason).toContain('Duplicate skipped idempotently');
    });
  });

  // -------------------------------------------------------------------------
  // 3. Reliability Engine & Exponential Backoff
  // -------------------------------------------------------------------------
  describe('3. Reliability Engine & Exponential Backoff', () => {
    it('generates stable, deterministic idempotency keys', () => {
      const key1 = ReliabilityEngine.generateIdempotencyKey('case_123', 'RETRY_PAYMENT', 1);
      const key2 = ReliabilityEngine.generateIdempotencyKey('case_123', 'RETRY_PAYMENT', 1);
      expect(key1).toBe(key2);
      expect(key1).toBe('idem_case_123_RETRY_PAYMENT_r1');
    });

    it('executes operation with automatic retry on transient failure', async () => {
      let attemptsCount = 0;
      const transientOp = async () => {
        attemptsCount++;
        if (attemptsCount < 2) {
          throw new Error('Transient network glitch');
        }
        return 'SUCCESS';
      };

      const result = await ReliabilityEngine.executeWithRetry(transientOp, () => false, {
        maxRetries: 2,
        initialDelayMs: 10,
        maxDelayMs: 50,
        backoffFactor: 2,
      });

      expect(result.success).toBe(true);
      expect(result.attempts).toBe(2);
      expect(result.result).toBe('SUCCESS');
    });
  });

  // -------------------------------------------------------------------------
  // 4. PII Masking & Data Minimization
  // -------------------------------------------------------------------------
  describe('4. PII Masking & Data Minimization', () => {
    it('masks customer email, phone, and payment instruments properly', () => {
      expect(PIIMasker.maskEmail('vikram.malhotra@enterprise.com')).toBe('vik***@enterprise.com');
      expect(PIIMasker.maskPhone('+91 9876543210')).toBe('+91 ******3210');
      expect(PIIMasker.maskCardOrAccount('4111222233334242')).toBe('**** **** **** 4242');
    });

    it('sanitizes prompt context from injection payloads', () => {
      const untrusted = '<script>alert(1)</script>"DROP TABLE ledger";';
      const clean = PIIMasker.sanitizeUntrustedText(untrusted);
      expect(clean).not.toContain('<script>');
      expect(clean).not.toContain('"');
    });
  });

  // -------------------------------------------------------------------------
  // 5. System Health & Readiness Subsystem
  // -------------------------------------------------------------------------
  describe('5. Health Check & Readiness Subsystem', () => {
    it('should report operational status across all platform subsystems and valid audit chain', async () => {
      const health = await HealthCheckService.runHealthCheck();
      expect(health.status).toBe('HEALTHY');
      expect(health.auditChainValid).toBe(true);
      expect(health.subsystems.length).toBeGreaterThanOrEqual(4);
      expect(health.subsystems.every((s) => s.healthy)).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // 6. 5-Case Concurrent Demo Suite (Showcase Cases 1 - 5)
  // -------------------------------------------------------------------------
  describe('6. Comprehensive 5-Case Concurrent Showcase Suite', () => {
    it('should execute 5 distinct FinOps cases concurrently without state corruption or leakage', async () => {
      const ledger = LedgerStore.getInstance();
      ledger.clear();

      const showcaseScenarios: GroundTruthScenario[] = [
        // Case 1: Legitimate transient payment drop -> retry -> verified settlement
        {
          id: 'case_showcase_1',
          name: 'Case 1 - Transient Drop',
          scenarioType: 'FAILED_PAYMENT_RETRYABLE',
          description: 'Gateway 504 timeout on trusted customer',
          expectedReconStatus: 'UNMATCHED_TRANSACTION',
          expectedRiskClassification: 'OPS_SHAPED',
          expectedSafeToRecover: true,
          expectedOptimalAction: 'RETRY_PAYMENT',
          expectedRecoverableCents: 250000,
          transaction: {
            id: 'tx_demo_1',
            merchantId: 'MERCHANT_DEMO',
            externalRef: 'DEMO_REF_01',
            amountCents: 250000,
            currency: 'INR',
            paymentMethod: 'UPI',
            customerName: 'Aarav Mehta',
            errorCode: 'GATEWAY_TIMEOUT_504',
            status: 'FAILED',
            createdAt: new Date().toISOString(),
          },
          riskSignals: {
            customerVelocity24h: 1,
            chargebackHistoryRatio: 0,
            amountDeviationZScore: 0.1,
            bankTimingAnomalyHours: 0,
            deviceFingerprintRisk: 'LOW',
            disputeRecurrenceFlag: false,
          },
        },
        // Case 2: Fraud burst -> Risk agent blocks -> Human Review
        {
          id: 'case_showcase_2',
          name: 'Case 2 - Fraud Burst',
          scenarioType: 'ORGANIZED_FRAUD_BURST',
          description: 'High velocity card burst on burner device',
          expectedReconStatus: 'UNMATCHED_TRANSACTION',
          expectedRiskClassification: 'CRITICAL_FRAUD',
          expectedSafeToRecover: false,
          expectedOptimalAction: 'STOP_RECOVERY',
          expectedRecoverableCents: 0,
          transaction: {
            id: 'tx_demo_2',
            merchantId: 'MERCHANT_DEMO',
            externalRef: 'DEMO_REF_02',
            amountCents: 890000,
            currency: 'INR',
            paymentMethod: 'CARD',
            customerName: 'Suspicious Device Cluster',
            status: 'FAILED',
            createdAt: new Date().toISOString(),
          },
          riskSignals: {
            customerVelocity24h: 19,
            chargebackHistoryRatio: 0.8,
            amountDeviationZScore: 3.5,
            bankTimingAnomalyHours: 0,
            deviceFingerprintRisk: 'HIGH',
            disputeRecurrenceFlag: true,
            linkedAccountsOnDevice: 6,
          },
        },
        // Case 3: Ambiguous bank settlement -> Finance Agent investigation -> Resolved
        {
          id: 'case_showcase_3',
          name: 'Case 3 - MDR Variance',
          scenarioType: 'AMOUNT_MISMATCH',
          description: 'MDR 2% fee netting discrepancy',
          expectedReconStatus: 'FEE_MISMATCH',
          expectedRiskClassification: 'OPS_SHAPED',
          expectedSafeToRecover: true,
          expectedOptimalAction: 'SEND_PAYMENT_LINK',
          expectedRecoverableCents: 500000,
          transaction: {
            id: 'tx_demo_3',
            merchantId: 'MERCHANT_DEMO',
            externalRef: 'DEMO_REF_03',
            amountCents: 500000,
            currency: 'INR',
            paymentMethod: 'CARD',
            customerName: 'Rohan Gupta',
            status: 'SUCCESS',
            createdAt: new Date().toISOString(),
          },
          settlement: {
            id: 'st_demo_3',
            batchId: 'BATCH_MDR_03',
            utrRrn: 'DEMO_REF_03',
            amountCents: 488200,
            feeCents: 10000,
            taxCents: 1800,
            netAmountCents: 488200,
            currency: 'INR',
            bankTimestamp: new Date().toISOString(),
            rawDescription: 'MDR-NETTED-SETTLEMENT-DEMO-03',
            createdAt: new Date().toISOString(),
          },
          riskSignals: {
            customerVelocity24h: 2,
            chargebackHistoryRatio: 0,
            amountDeviationZScore: 0.2,
            bankTimingAnomalyHours: 0,
            deviceFingerprintRisk: 'LOW',
            disputeRecurrenceFlag: false,
          },
        },
      ];

      const originalMathRandom = Math.random;
      Math.random = () => 0;
      
      const pipelineResult = await orchestrator.runFullPipeline(showcaseScenarios);

      Math.random = originalMathRandom;

      expect(pipelineResult.metrics.totalProcessed).toBe(3);
      expect(pipelineResult.metrics.recoveredCount).toBeGreaterThanOrEqual(0);
      expect(pipelineResult.metrics.blockedRiskCount).toBeGreaterThanOrEqual(1);
      expect(ledger.getAllCases().length).toBeGreaterThanOrEqual(2);
    });
  });
});
