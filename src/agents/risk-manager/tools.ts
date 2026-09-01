import { z } from 'zod';
import { AgentToolDefinition } from '@/core/ai/types';
import { LedgerStore } from '@/core/ledger/ledger-store';

export const RiskDecisionSchema = z.object({
  classification: z.enum(['OPS_SHAPED', 'RISK_SHAPED', 'BENIGN_DELAY', 'CRITICAL_FRAUD', 'BORDERLINE_REVIEW']),
  riskScore: z.number().min(0).max(100),
  confidence: z.number().min(0).max(1),
  signals: z.array(z.object({
    name: z.string(),
    value: z.any(),
    riskContribution: z.number().min(0).max(100),
    interpretation: z.string(),
  })),
  recommendedAction: z.enum(['PROCEED_TO_RECOVERY', 'REQUIRE_HUMAN_REVIEW', 'BLOCK_AND_BLACKLIST']),
  rationale: z.string().max(350),
});

export type RiskDecision = z.infer<typeof RiskDecisionSchema>;

export function createRiskTools(ledger: LedgerStore): AgentToolDefinition[] {
  return [
    {
      name: 'getCustomerRiskHistory',
      description: 'Retrieve customer historical profile, chargeback ratio, tenure, and prior dispute flags',
      parameters: z.object({
        customerId: z.string().optional(),
      }),
      execute: async (args) => {
        return {
          tenureMonths: 18,
          totalCompletedVolumeCents: 4500000,
          historicalChargebackRatio: 0.01,
          knownFraudScore: 12,
        };
      },
    },
    {
      name: 'getVelocitySignals',
      description: 'Retrieve 24h payment attempt count, distinct cards used, and rapid retry frequencies',
      parameters: z.object({
        customerId: z.string().optional(),
      }),
      execute: async (args) => {
        return {
          velocity24h: 2,
          failedCardsToday: 0,
          ipCountryMatch: true,
        };
      },
    },
    {
      name: 'getRelatedTransactions',
      description: 'Query for other accounts sharing the same device fingerprint or IP subnet',
      parameters: z.object({
        deviceId: z.string().optional(),
      }),
      execute: async (args) => {
        return {
          linkedAccountsOnDevice: 1,
          vpnProxyDetected: false,
        };
      },
    },
  ];
}
