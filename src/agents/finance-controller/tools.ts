import { z } from 'zod';
import { AgentToolDefinition } from '@/core/ai/types';
import { LedgerStore } from '@/core/ledger/ledger-store';

export const FinanceDecisionSchema = z.object({
  decision: z.enum(['MATCH', 'AMBIGUOUS', 'UNMATCHED']),
  candidateTransactionId: z.string().optional(),
  candidateSettlementId: z.string().optional(),
  confidence: z.number().min(0).max(1),
  evidence: z.array(z.object({
    signal: z.string(),
    value: z.string(),
    weight: z.number(),
  })),
  rationale: z.string().max(300),
  requiresVerification: z.boolean(),
});

export type FinanceDecision = z.infer<typeof FinanceDecisionSchema>;

export function createFinanceTools(ledger: LedgerStore): AgentToolDefinition[] {
  return [
    {
      name: 'getBankStatementDetails',
      description: 'Retrieve raw bank settlement batch narration, timing, and fee breakdown for a settlement record',
      parameters: z.object({
        settlementId: z.string().optional(),
      }),
      execute: async (args) => {
        if (!args.settlementId) return { error: 'No settlementId provided' };
        const st = ledger.getSettlement(args.settlementId);
        if (!st) return { found: false };
        return {
          found: true,
          utrRrn: st.utrRrn,
          amountCents: st.amountCents,
          feeCents: st.feeCents,
          taxCents: st.taxCents,
          rawDescription: st.rawDescription,
          bankTimestamp: st.bankTimestamp,
        };
      },
    },
    {
      name: 'searchTransactions',
      description: 'Search ledger for candidate transactions matching an amount or customer reference',
      parameters: z.object({
        query: z.string().optional(),
        minAmountCents: z.number().optional(),
        maxAmountCents: z.number().optional(),
      }),
      execute: async (args) => {
        const allTx = ledger.getAllTransactions();
        return allTx.filter((t) => {
          if (args.minAmountCents && t.amountCents < args.minAmountCents) return false;
          if (args.maxAmountCents && t.amountCents > args.maxAmountCents) return false;
          if (args.query && !t.customerName.toLowerCase().includes(args.query.toLowerCase()) && !t.externalRef.includes(args.query)) {
            return false;
          }
          return true;
        }).slice(0, 5).map((t) => ({
          id: t.id,
          amountCents: t.amountCents,
          customerName: t.customerName,
          externalRef: t.externalRef,
          status: t.status,
        }));
      },
    },
    {
      name: 'searchCandidateSettlements',
      description: 'Search unmatched settlement batches for possible partial or net matches',
      parameters: z.object({
        amountCents: z.number().optional(),
      }),
      execute: async (args) => {
        const allSt = ledger.getAllSettlements();
        return allSt.filter((s) => !s.reconciledStatus || s.reconciledStatus === 'UNMATCHED_SETTLEMENT').slice(0, 5).map((s) => ({
          id: s.id,
          amountCents: s.amountCents,
          utrRrn: s.utrRrn,
          rawDescription: s.rawDescription,
        }));
      },
    },
  ];
}
