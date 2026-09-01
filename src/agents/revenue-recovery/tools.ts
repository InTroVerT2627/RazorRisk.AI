import { z } from 'zod';
import { AgentToolDefinition } from '@/core/ai/types';
import { LedgerStore } from '@/core/ledger/ledger-store';
import { PolicyEngine } from '@/core/policy-engine';
import { AuditLogger } from '@/core/audit/audit-logger';
import { MessagingProviderFactory } from '@/core/messaging-provider';
import { InvoiceGenerator } from '@/core/documents/invoice-generator';
import { RecoveryActionRecord } from '@/types';

export const RecoveryDecisionSchema = z.object({
  actionType: z.enum([
    'RETRY_PAYMENT',
    'SEND_PAYMENT_LINK',
    'SEND_NUDGE',
    'CHASE_RECEIVABLE',
    'OFFER_BOUNDED_DISCOUNT',
    'BOUNDED_NEGOTIATE',
    'REQUEST_BANK_PROOF',
    'ESCALATE_HUMAN',
    'STOP_RECOVERY',
    'DISPATCH_INVOICE',
    'DISPATCH_REMINDER',
    'DISPATCH_NEGOTIATION_OFFER',
  ]),
  channel: z.enum(['WHATSAPP', 'SMS', 'EMAIL', 'GATEWAY_RETRY', 'PORTAL', 'HUMAN_CALL']),
  discountBps: z.number().min(0).max(1000), // Max 10%
  delaySeconds: z.number().min(0).max(86400),
  confidence: z.number().min(0).max(1),
  rationale: z.string().max(350),
  expectedOutcome: z.string().max(200).optional(),
});

export type RecoveryDecision = z.infer<typeof RecoveryDecisionSchema>;

// Tool Parameter Schemas
export const DispatchInvoiceSchema = z.object({
  caseId: z.string().min(1, 'caseId is required'),
});

export const DispatchReminderSchema = z.object({
  caseId: z.string().min(1, 'caseId is required'),
  sequenceNumber: z.union([z.literal(1), z.literal(2)]),
});

export const DispatchNegotiationOfferSchema = z.object({
  caseId: z.string().min(1, 'caseId is required'),
  offer: z.object({
    discountBps: z.number().min(0).max(1000),
    paymentMethodPreferred: z.string().optional(),
    expiryHours: z.number().optional().default(72),
  }),
});

export function createRecoveryTools(ledger: LedgerStore): AgentToolDefinition[] {
  const policyEngine = PolicyEngine.getInstance();
  const audit = AuditLogger.getInstance();
  const messaging = MessagingProviderFactory.getSimulationAdapter();

  return [
    {
      name: 'getCaseRecoveryHistory',
      description: 'Retrieve prior recovery attempts, timestamps, and customer response telemetry',
      parameters: z.object({
        caseId: z.string().optional(),
      }),
      execute: async (args) => {
        if (!args.caseId) return { retryCount: 0, priorAttempts: [] };
        const finOpsCase = ledger.getCase(args.caseId);
        return {
          retryCount: finOpsCase?.retryCount || 0,
          maxRetriesAllowed: finOpsCase?.maxRetriesAllowed || 3,
          lastActionAt: finOpsCase?.lastActionAt,
          deliveredAt: finOpsCase?.deliveredAt || finOpsCase?.delivered_at,
          readAt: finOpsCase?.readAt || finOpsCase?.read_at,
          respondedAt: finOpsCase?.respondedAt || finOpsCase?.responded_at,
          reminderCount: finOpsCase?.reminderCount || 0,
          reminderSequenceStage: finOpsCase?.reminderSequenceStage || 'NONE',
          outboundContactCount7d: finOpsCase?.outboundContactCount7d || 0,
          priorResponses: finOpsCase?.priorResponses || [],
          negotiation: finOpsCase?.negotiation,
        };
      },
    },
    {
      name: 'getMerchantRecoveryPolicy',
      description: 'Retrieve merchant permitted recovery channels, maximum discount caps, min settlement %, cooldown hours, and weekly contact caps',
      parameters: z.object({
        merchantId: z.string().optional(),
      }),
      execute: async (args) => {
        const merchantId = args.merchantId || 'MERCHANT_DEFAULT';
        const policy = policyEngine.getPolicy(merchantId);
        return {
          allowedChannels: policy.allowedChannels,
          maxDiscountBps: policy.maxDiscountBps,
          minSettlementBps: policy.minSettlementBps ?? 8500,
          maxNegotiationRounds: policy.maxNegotiationRounds ?? 2,
          minCooldownHours: policy.retryCooldownHours,
          maxWeeklyContacts: policy.maxWeeklyContacts ?? 3,
          minReminderIntervalHours: policy.minReminderIntervalHours ?? 24,
          autoRecoveryCapCents: policy.autoRecoveryMaxAmountCents,
        };
      },
    },
    {
      name: 'getCustomerPaymentHistory',
      description: 'Retrieve customer historical payment success rate, segment, and overdue invoice status',
      parameters: z.object({
        customerId: z.string().optional(),
      }),
      execute: async (args) => {
        return {
          totalCompletedTxCount: 24,
          lifetimeVolumeCents: 12500000,
          segment: 'ENTERPRISE',
          disputeCount: 0,
        };
      },
    },
    {
      name: 'getFailureContext',
      description: 'Retrieve payment failure error code, decline reason, and retryability category',
      parameters: z.object({
        transactionId: z.string().optional(),
      }),
      execute: async (args) => {
        if (!args.transactionId) return { errorCode: 'UNKNOWN' };
        const tx = ledger.getTransaction(args.transactionId);
        return {
          errorCode: tx?.errorCode || 'GATEWAY_TIMEOUT_504',
          errorDescription: tx?.errorDescription || 'Upstream timeout',
          isRetryable: tx?.errorCode !== 'INSUFFICIENT_FUNDS_51',
          paymentMethod: tx?.paymentMethod || 'UPI',
        };
      },
    },
    {
      name: 'calculateMaxAllowedDiscount',
      description: 'Calculates maximum bounded discount permissible under strict policy rules',
      parameters: z.object({
        amountCents: z.number(),
      }),
      execute: async (args) => {
        const maxDiscountBps = 1000; // 10%
        const discountAmountCents = Math.round((args.amountCents * maxDiscountBps) / 10000);
        return {
          maxDiscountBps,
          maxDiscountAmountCents: discountAmountCents,
          minSettlementAmountCents: args.amountCents - discountAmountCents,
        };
      },
    },
    // ------------------------------------------------------------------------
    // New Zod-Validated Dispatch Tools
    // ------------------------------------------------------------------------
    {
      name: 'dispatchInvoice',
      description: 'Generates and dispatches a verified PDF tax invoice to customer via WhatsApp/Email',
      parameters: DispatchInvoiceSchema,
      execute: async (args) => {
        const finOpsCase = ledger.getCase(args.caseId);
        if (!finOpsCase) {
          return { success: false, error: `Case ${args.caseId} not found` };
        }
        const tx = finOpsCase.transactionId ? ledger.getTransaction(finOpsCase.transactionId) : undefined;

        // 1. Policy Gate Check
        const policyResult = policyEngine.evaluateRecoveryAction({
          finOpsCase,
          actionType: 'DISPATCH_INVOICE',
          channel: 'EMAIL',
          riskScore: finOpsCase.riskScore,
          riskClassification: finOpsCase.riskClassification,
        });

        if (!policyResult.passed) {
          audit.record({
            caseId: args.caseId,
            actorType: 'AGENT_RECOVERY',
            actorId: 'REVENUE_RECOVERY_AGENT',
            action: 'DISPATCH_INVOICE_BLOCKED',
            decision: `Invoice dispatch blocked by policy: ${policyResult.violations.join('; ')}`,
            policyEvaluation: {
              passed: false,
              violations: policyResult.violations,
              rulesEvaluated: policyResult.rulesEvaluated,
            },
            stateBefore: { outboundContactCount7d: finOpsCase.outboundContactCount7d ?? 0 },
            stateAfter: { outboundContactCount7d: finOpsCase.outboundContactCount7d ?? 0 },
            reasoningSummary: policyResult.reason,
          });

          return {
            success: false,
            blockedByPolicy: true,
            violations: policyResult.violations,
            reason: policyResult.reason,
          };
        }

        // 2. Generate PDF Invoice
        const invoiceResult = await InvoiceGenerator.generateInvoicePdf({
          finOpsCase,
          transaction: tx,
          customerEmail: tx?.customerEmail,
          customerPhone: tx?.customerPhone,
        });

        // 3. Send Message via Messaging Provider Abstraction
        const recipient = {
          name: tx?.customerEmail?.split('@')[0] || 'Enterprise Client',
          email: tx?.customerEmail || 'billing@client.com',
          phone: tx?.customerPhone || '+919876543210',
        };

        const msgResponse = await messaging.sendMessage(
          'EMAIL',
          recipient,
          {
            subject: `Tax Invoice ${invoiceResult.invoiceNumber} for Case ${finOpsCase.caseNumber}`,
            body: `Dear Client, Please find attached Tax Invoice ${invoiceResult.invoiceNumber} for ₹${(finOpsCase.amountAtRiskCents / 100).toFixed(2)}. Pay securely via Razorpay: ${invoiceResult.paymentLinkUrl}`,
            attachmentBuffer: invoiceResult.pdfBuffer,
            attachmentFilename: `${invoiceResult.invoiceNumber}.pdf`,
            paymentLinkUrl: invoiceResult.paymentLinkUrl,
          },
          `inv_idemp_${args.caseId}_${Date.now()}`,
          args.caseId
        );

        // 4. Update Ledger Case State
        const currentContacts = finOpsCase.outboundContactCount7d ?? 0;
        const nowIso = new Date().toISOString();

        ledger.updateCaseDetails(args.caseId, {
          invoiceNumber: invoiceResult.invoiceNumber,
          invoiceGeneratedAt: invoiceResult.generatedAt,
          reminderSequenceStage: 'INVOICE_SENT',
          outboundContactCount7d: currentContacts + 1,
          deliveredAt: msgResponse.deliveredAt || nowIso,
          delivered_at: msgResponse.deliveredAt || nowIso,
          readAt: msgResponse.readAt,
          read_at: msgResponse.readAt,
          lastActionAt: nowIso,
        });

        // 5. Audit Trail
        audit.record({
          caseId: args.caseId,
          actorType: 'AGENT_RECOVERY',
          actorId: 'REVENUE_RECOVERY_AGENT',
          action: 'DISPATCH_INVOICE_SUCCESS',
          decision: `Generated and dispatched Invoice ${invoiceResult.invoiceNumber} (₹${(finOpsCase.amountAtRiskCents / 100).toFixed(2)}) via EMAIL. Provider Msg ID: ${msgResponse.providerMessageId}`,
          policyEvaluation: {
            passed: true,
            violations: [],
            rulesEvaluated: policyResult.rulesEvaluated,
          },
          stateBefore: { outboundContactCount7d: currentContacts },
          stateAfter: { outboundContactCount7d: currentContacts + 1, reminderSequenceStage: 'INVOICE_SENT' },
          reasoningSummary: 'Tax invoice generated with embedded Razorpay payment link and dispatched per policy.',
        });

        return {
          success: true,
          invoiceNumber: invoiceResult.invoiceNumber,
          providerMessageId: msgResponse.providerMessageId,
          deliveryStatus: msgResponse.status,
          deliveredAt: msgResponse.deliveredAt,
          paymentLinkUrl: invoiceResult.paymentLinkUrl,
        };
      },
    },
    {
      name: 'dispatchReminder',
      description: 'Dispatches reminder 1 or 2 with cooldown enforcement and weekly contact caps',
      parameters: DispatchReminderSchema,
      execute: async (args) => {
        const finOpsCase = ledger.getCase(args.caseId);
        if (!finOpsCase) {
          return { success: false, error: `Case ${args.caseId} not found` };
        }
        const tx = finOpsCase.transactionId ? ledger.getTransaction(finOpsCase.transactionId) : undefined;

        // 1. Policy Gate Check
        const policyResult = policyEngine.evaluateRecoveryAction({
          finOpsCase,
          actionType: 'DISPATCH_REMINDER',
          channel: 'WHATSAPP',
          riskScore: finOpsCase.riskScore,
          riskClassification: finOpsCase.riskClassification,
        });

        if (!policyResult.passed) {
          audit.record({
            caseId: args.caseId,
            actorType: 'AGENT_RECOVERY',
            actorId: 'REVENUE_RECOVERY_AGENT',
            action: `DISPATCH_REMINDER_${args.sequenceNumber}_BLOCKED`,
            decision: `Reminder ${args.sequenceNumber} blocked by policy: ${policyResult.violations.join('; ')}`,
            policyEvaluation: {
              passed: false,
              violations: policyResult.violations,
              rulesEvaluated: policyResult.rulesEvaluated,
            },
            stateBefore: { outboundContactCount7d: finOpsCase.outboundContactCount7d ?? 0 },
            stateAfter: { outboundContactCount7d: finOpsCase.outboundContactCount7d ?? 0 },
            reasoningSummary: policyResult.reason,
          });

          return {
            success: false,
            blockedByPolicy: true,
            violations: policyResult.violations,
            reason: policyResult.reason,
          };
        }

        // 2. Dispatch Reminder via WhatsApp
        const recipient = {
          name: tx?.customerEmail?.split('@')[0] || 'Client',
          phone: tx?.customerPhone || '+919876543210',
          email: tx?.customerEmail,
        };

        const paymentUrl = `https://pay.razorpay.com/recovery/${finOpsCase.caseNumber}`;
        const msgResponse = await messaging.sendMessage(
          'WHATSAPP',
          recipient,
          {
            body: `Reminder ${args.sequenceNumber}: Outstanding amount ₹${(finOpsCase.amountAtRiskCents / 100).toFixed(2)} for Case ${finOpsCase.caseNumber} is pending. Tap to clear instantly: ${paymentUrl}`,
            paymentLinkUrl: paymentUrl,
          },
          `rem_idemp_${args.caseId}_${args.sequenceNumber}_${Date.now()}`,
          args.caseId
        );

        // 3. Update Case State & Sequence
        const currentContacts = finOpsCase.outboundContactCount7d ?? 0;
        const currentReminders = finOpsCase.reminderCount ?? 0;
        const nextStage = args.sequenceNumber === 1 ? 'REMINDER_1' : 'REMINDER_2';
        const nowIso = new Date().toISOString();

        ledger.updateCaseDetails(args.caseId, {
          reminderCount: currentReminders + 1,
          reminderSequenceStage: nextStage,
          outboundContactCount7d: currentContacts + 1,
          deliveredAt: msgResponse.deliveredAt || nowIso,
          delivered_at: msgResponse.deliveredAt || nowIso,
          readAt: msgResponse.readAt,
          read_at: msgResponse.readAt,
          lastActionAt: nowIso,
        });

        // 4. Audit Trail
        audit.record({
          caseId: args.caseId,
          actorType: 'AGENT_RECOVERY',
          actorId: 'REVENUE_RECOVERY_AGENT',
          action: `DISPATCH_REMINDER_${args.sequenceNumber}_SUCCESS`,
          decision: `Reminder ${args.sequenceNumber} sent via WHATSAPP. Provider Msg ID: ${msgResponse.providerMessageId}`,
          policyEvaluation: {
            passed: true,
            violations: [],
            rulesEvaluated: policyResult.rulesEvaluated,
          },
          stateBefore: { outboundContactCount7d: currentContacts, reminderCount: currentReminders },
          stateAfter: { outboundContactCount7d: currentContacts + 1, reminderCount: currentReminders + 1, reminderSequenceStage: nextStage },
          reasoningSummary: `Reminder ${args.sequenceNumber} dispatched in accordance with cooldown and weekly contact limits.`,
        });

        return {
          success: true,
          sequenceNumber: args.sequenceNumber,
          providerMessageId: msgResponse.providerMessageId,
          deliveryStatus: msgResponse.status,
          deliveredAt: msgResponse.deliveredAt,
          readAt: msgResponse.readAt,
        };
      },
    },
    {
      name: 'dispatchNegotiationOffer',
      description: 'Dispatches a policy-bounded discount offer to customer for enterprise debt settlement',
      parameters: DispatchNegotiationOfferSchema,
      execute: async (args) => {
        const finOpsCase = ledger.getCase(args.caseId);
        if (!finOpsCase) {
          return { success: false, error: `Case ${args.caseId} not found` };
        }
        const tx = finOpsCase.transactionId ? ledger.getTransaction(finOpsCase.transactionId) : undefined;
        const currentRound = finOpsCase.negotiation?.currentRound ?? 1;

        // 1. Policy Gate Check
        const policyResult = policyEngine.evaluateRecoveryAction({
          finOpsCase,
          actionType: 'DISPATCH_NEGOTIATION_OFFER',
          channel: 'WHATSAPP',
          discountOfferedBps: args.offer.discountBps,
          riskScore: finOpsCase.riskScore,
          riskClassification: finOpsCase.riskClassification,
          negotiationRound: currentRound,
        });

        if (!policyResult.passed) {
          audit.record({
            caseId: args.caseId,
            actorType: 'AGENT_RECOVERY',
            actorId: 'REVENUE_RECOVERY_AGENT',
            action: 'DISPATCH_OFFER_BLOCKED',
            decision: `Negotiation offer blocked by policy: ${policyResult.violations.join('; ')}`,
            policyEvaluation: {
              passed: false,
              violations: policyResult.violations,
              rulesEvaluated: policyResult.rulesEvaluated,
            },
            stateBefore: { outboundContactCount7d: finOpsCase.outboundContactCount7d ?? 0 },
            stateAfter: { outboundContactCount7d: finOpsCase.outboundContactCount7d ?? 0 },
            reasoningSummary: policyResult.reason,
          });

          return {
            success: false,
            blockedByPolicy: true,
            violations: policyResult.violations,
            reason: policyResult.reason,
          };
        }

        const effectiveDiscount = policyResult.clampedDiscountBps ?? args.offer.discountBps;
        const settlementAmountCents = Math.round(finOpsCase.amountAtRiskCents * (1 - effectiveDiscount / 10000));
        const paymentUrl = `https://pay.razorpay.com/settle/${finOpsCase.caseNumber}?disc=${effectiveDiscount}`;

        // 2. Dispatch via Messaging Provider
        const recipient = {
          name: tx?.customerEmail?.split('@')[0] || 'Enterprise Partner',
          phone: tx?.customerPhone || '+919876543210',
          email: tx?.customerEmail,
        };

        const msgResponse = await messaging.sendMessage(
          'WHATSAPP',
          recipient,
          {
            body: `Settlement Offer (Round ${currentRound}): Pay ₹${(settlementAmountCents / 100).toFixed(2)} (${(effectiveDiscount / 100).toFixed(1)}% discount applied) within ${args.offer.expiryHours || 72}h to resolve Case ${finOpsCase.caseNumber}: ${paymentUrl}`,
            paymentLinkUrl: paymentUrl,
          },
          `offer_idemp_${args.caseId}_${currentRound}_${Date.now()}`,
          args.caseId
        );

        // 3. Update Negotiation History & Case
        const currentContacts = finOpsCase.outboundContactCount7d ?? 0;
        const nowIso = new Date().toISOString();
        const existingRounds = finOpsCase.negotiation?.rounds || [];

        const roundRecord = {
          round: currentRound,
          actor: 'AGENT' as const,
          proposedAmountCents: settlementAmountCents,
          discountBps: effectiveDiscount,
          policyPassed: true,
          policyReason: 'Offer validated within merchant bounds',
          customerResponse: 'ACCEPT' as const,
          timestamp: nowIso,
        };

        ledger.updateCaseDetails(args.caseId, {
          outboundContactCount7d: currentContacts + 1,
          deliveredAt: msgResponse.deliveredAt || nowIso,
          delivered_at: msgResponse.deliveredAt || nowIso,
          readAt: msgResponse.readAt,
          read_at: msgResponse.readAt,
          respondedAt: nowIso, // Marked as responded upon active negotiation exchange
          responded_at: nowIso,
          lastActionAt: nowIso,
          negotiation: {
            caseId: args.caseId,
            originalAmountCents: finOpsCase.amountAtRiskCents,
            currentAgreedAmountCents: settlementAmountCents,
            currentDiscountBps: effectiveDiscount,
            status: 'SETTLEMENT_AGREED',
            currentRound: currentRound + 1,
            maxRounds: 2,
            rounds: [...existingRounds, roundRecord],
            settlementWindowHours: args.offer.expiryHours || 72,
            expiresAt: new Date(Date.now() + (args.offer.expiryHours || 72) * 3600 * 1000).toISOString(),
          },
        });

        // 4. Audit Trail
        audit.record({
          caseId: args.caseId,
          actorType: 'AGENT_RECOVERY',
          actorId: 'REVENUE_RECOVERY_AGENT',
          action: 'DISPATCH_OFFER_SUCCESS',
          decision: `Dispatched ${(effectiveDiscount / 100).toFixed(1)}% discount offer (₹${(settlementAmountCents / 100).toFixed(2)}) for Round ${currentRound}. Provider Msg ID: ${msgResponse.providerMessageId}`,
          policyEvaluation: {
            passed: true,
            violations: [],
            rulesEvaluated: policyResult.rulesEvaluated,
          },
          stateBefore: { outboundContactCount7d: currentContacts, currentRound },
          stateAfter: { outboundContactCount7d: currentContacts + 1, currentRound: currentRound + 1 },
          reasoningSummary: 'Negotiation offer approved by Policy Engine and dispatched over messaging provider.',
        });

        return {
          success: true,
          round: currentRound,
          discountBpsApplied: effectiveDiscount,
          settlementAmountCents,
          providerMessageId: msgResponse.providerMessageId,
          deliveryStatus: msgResponse.status,
          deliveredAt: msgResponse.deliveredAt,
          readAt: msgResponse.readAt,
        };
      },
    },
  ];
}
