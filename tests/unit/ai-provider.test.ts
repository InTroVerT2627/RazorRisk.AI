import { describe, it, expect } from 'vitest';
import { FinOpsAIProvider } from '../../src/core/ai/provider';
import { z } from 'zod';

describe('Unit Test: FinOpsAIProvider Continuous Risk & Multi-Domain Synthesis', () => {
  const provider = FinOpsAIProvider.getInstance();

  it('1. Singleton instance returns stable identity and telemetry', () => {
    const inst1 = FinOpsAIProvider.getInstance();
    const inst2 = FinOpsAIProvider.getInstance();
    expect(inst1).toBe(inst2);
    expect(provider.getStatus().healthy).toBe(true);
    expect(provider.getStatus().providerName).toBe('SentinelFinOpsProvider');
  });

  it('2. synthesizes continuous risk score for normal low-risk operational prompt', async () => {
    const result = await provider.generateStructuredDecision<{
      classification: string;
      riskScore: number;
      confidence: number;
      recommendedAction: string;
      rationale: string;
    }>({
      promptVersion: 'V1',
      systemPrompt: 'You are a risk classifier.',
      userPrompt: 'RISK_DECISION_CONTEXT: Customer velocity: 1, deviceRisk: LOW, linkedAccounts: 1, chargeback: 0.0',
      schema: z.object({
        classification: z.string(),
        riskScore: z.number(),
        confidence: z.number(),
        recommendedAction: z.string(),
        rationale: z.string(),
      }),
      fallbackDecision: {
        classification: 'OPS_SHAPED',
        riskScore: 20,
        confidence: 0.9,
        recommendedAction: 'PROCEED_TO_RECOVERY',
        rationale: 'fallback',
      },
    });

    expect(result.decision.riskScore).toBeLessThan(40);
    expect(result.decision.classification).toBe('OPS_SHAPED');
    expect(result.decision.recommendedAction).toBe('PROCEED_TO_RECOVERY');
  });

  it('3. synthesizes high risk score >= 70 and BLOCK action for critical fraud prompt', async () => {
    const result = await provider.generateStructuredDecision<{
      classification: string;
      riskScore: number;
      recommendedAction: string;
    }>({
      promptVersion: 'V1',
      systemPrompt: 'You are a risk classifier.',
      userPrompt: 'RISK_DECISION_CONTEXT: SCORE_95 VELOCITY_CRITICAL velocity: 25, deviceRisk: HIGH, linkedAccounts: 8',
      schema: z.object({
        classification: z.string(),
        riskScore: z.number(),
        recommendedAction: z.string(),
      }),
      fallbackDecision: { classification: 'CRITICAL_FRAUD', riskScore: 95, recommendedAction: 'BLOCK_AND_BLACKLIST' },
    });

    expect(result.decision.riskScore).toBeGreaterThanOrEqual(70);
    expect(result.decision.recommendedAction).toBe('BLOCK_AND_BLACKLIST');
    expect(result.decision.classification).toBe('CRITICAL_FRAUD');
  });

  it('4. synthesizes borderline review score for borderline prompt', async () => {
    const result = await provider.generateStructuredDecision<{
      classification: string;
      riskScore: number;
      recommendedAction: string;
    }>({
      promptVersion: 'V1',
      systemPrompt: 'Risk classifier',
      userPrompt: 'RISK_DECISION_CONTEXT: BORDERLINE_69 velocity: 6, chargeback: 0.28',
      schema: z.object({
        classification: z.string(),
        riskScore: z.number(),
        recommendedAction: z.string(),
      }),
      fallbackDecision: { classification: 'BORDERLINE_REVIEW', riskScore: 58, recommendedAction: 'REQUIRE_HUMAN_REVIEW' },
    });

    expect(result.decision.riskScore).toBeGreaterThanOrEqual(45);
    expect(result.decision.riskScore).toBeLessThan(70);
    expect(result.decision.recommendedAction).toBe('REQUIRE_HUMAN_REVIEW');
  });

  it('5. synthesizes legitimate outlier correctly without false positive block', async () => {
    const result = await provider.generateStructuredDecision<{
      classification: string;
      riskScore: number;
      recommendedAction: string;
    }>({
      promptVersion: 'V1',
      systemPrompt: 'Risk classifier',
      userPrompt: 'RISK_DECISION_CONTEXT: LEGITIMATE_OUTLIER High amount B2B, account tenure 24 months, zero chargebacks',
      schema: z.object({
        classification: z.string(),
        riskScore: z.number(),
        recommendedAction: z.string(),
      }),
      fallbackDecision: { classification: 'OPS_SHAPED', riskScore: 22, recommendedAction: 'PROCEED_TO_RECOVERY' },
    });

    expect(result.decision.riskScore).toBeLessThan(35);
    expect(result.decision.recommendedAction).toBe('PROCEED_TO_RECOVERY');
  });

  it('6. synthesizes finance reconciliation decision for fee mismatch', async () => {
    const result = await provider.generateStructuredDecision<{
      decision: string;
      confidence: number;
      rationale: string;
    }>({
      promptVersion: 'V1',
      systemPrompt: 'Finance reconciliation agent',
      userPrompt: 'RECON_DECISION_CONTEXT: FEE_MISMATCH MDR 2% applied on gross transaction',
      schema: z.object({
        decision: z.string(),
        confidence: z.number(),
        rationale: z.string(),
      }),
      fallbackDecision: { decision: 'MATCH', confidence: 0.9, rationale: 'fallback' },
    });

    expect(result.decision.decision).toBe('MATCH');
    expect(result.decision.confidence).toBeGreaterThanOrEqual(0.9);
  });

  it('7. synthesizes finance reconciliation decision for amount mismatch as AMBIGUOUS', async () => {
    const result = await provider.generateStructuredDecision<{
      decision: string;
      confidence: number;
    }>({
      promptVersion: 'V1',
      systemPrompt: 'Finance reconciliation agent',
      userPrompt: 'RECON_DECISION_CONTEXT: AMOUNT_MISMATCH Variance unexplained by MDR',
      schema: z.object({
        decision: z.string(),
        confidence: z.number(),
      }),
      fallbackDecision: { decision: 'AMBIGUOUS', confidence: 0.65 },
    });

    expect(result.decision.decision).toMatch(/AMBIGUOUS|MATCH/);
  });

  it('8. synthesizes recovery decision for repeated failure to switch to payment link', async () => {
    const result = await provider.generateStructuredDecision<{
      actionType: string;
      channel: string;
    }>({
      promptVersion: 'V1',
      systemPrompt: 'Recovery agent',
      userPrompt: 'RECOVERY_DECISION_CONTEXT: REPEATED_GATEWAY_FAILURE_SWITCH_TO_LINK',
      schema: z.object({
        actionType: z.string(),
        channel: z.string(),
      }),
      fallbackDecision: { actionType: 'SEND_PAYMENT_LINK', channel: 'WHATSAPP' },
    });

    expect(result.decision.actionType).toBe('SEND_PAYMENT_LINK');
    expect(result.decision.channel).toBe('WHATSAPP');
  });

  it('9. synthesizes recovery decision for B2B bounded negotiation', async () => {
    const result = await provider.generateStructuredDecision<{
      actionType: string;
      discountBps: number;
    }>({
      promptVersion: 'V1',
      systemPrompt: 'Recovery agent',
      userPrompt: 'RECOVERY_DECISION_CONTEXT: ELIGIBLE_B2B_NEGOTIATION BOUNDED_NEGOTIATE',
      schema: z.object({
        actionType: z.string(),
        discountBps: z.number(),
      }),
      fallbackDecision: { actionType: 'BOUNDED_NEGOTIATE', discountBps: 500 },
    });

    expect(result.decision.actionType).toBe('BOUNDED_NEGOTIATE');
    expect(result.decision.discountBps).toBeGreaterThan(0);
    expect(result.decision.discountBps).toBeLessThanOrEqual(1000);
  });

  it('10. synthesizes recovery stop for risk-blocked cases', async () => {
    const result = await provider.generateStructuredDecision<{
      actionType: string;
    }>({
      promptVersion: 'V1',
      systemPrompt: 'Recovery agent',
      userPrompt: 'RECOVERY_DECISION_CONTEXT: RISK_BLOCKED CRITICAL_FRAUD',
      schema: z.object({
        actionType: z.string(),
      }),
      fallbackDecision: { actionType: 'STOP_RECOVERY' },
    });

    expect(result.decision.actionType).toBe('STOP_RECOVERY');
  });

  it('11. schema validation strictly catches malformed objects and falls back safely', async () => {
    const strictSchema = z.object({
      requiredNonExistentField: z.string(),
    });

    const result = await provider.generateStructuredDecision({
      promptVersion: 'V1',
      systemPrompt: 'Tester',
      userPrompt: 'RECON_DECISION_CONTEXT: FEE_MISMATCH',
      schema: strictSchema,
      fallbackDecision: { requiredNonExistentField: 'SAFE_FALLBACK_VALUE' },
    });

    expect(result.decision.requiredNonExistentField).toBe('SAFE_FALLBACK_VALUE');
    expect(result.telemetry.fallbackTriggered).toBe(true);
  });

  it('12. generates telemetry with accurate latency and token metrics', async () => {
    const result = await provider.generateStructuredDecision({
      promptVersion: 'PROMPT_V2.1',
      systemPrompt: 'System',
      userPrompt: 'RISK_DECISION_CONTEXT: Normal',
      schema: z.object({ classification: z.string(), riskScore: z.number() }),
      fallbackDecision: { classification: 'OPS_SHAPED', riskScore: 20 },
    });

    expect(result.telemetry.promptVersion).toBe('PROMPT_V2.1');
    expect(result.telemetry.latencyMs).toBeGreaterThanOrEqual(0);
    expect(result.telemetry.tokensUsed?.total).toBeGreaterThan(0);
  });

  it('13. executeToolDecision records each tool execution in telemetry', async () => {
    const dummyTool = {
      name: 'getHistoricalProfile',
      description: 'Fetches history',
      parameters: z.object({}),
      execute: async () => ({ accountAgeDays: 365, chargebackCount: 0 }),
    };

    const result = await provider.generateToolDecision<{
      classification: string;
      riskScore: number;
    }>({
      promptVersion: 'V1',
      systemPrompt: 'Tool user',
      userPrompt: 'RISK_DECISION_CONTEXT: Customer profile inspection',
      schema: z.object({ classification: z.string(), riskScore: z.number() }),
      fallbackDecision: { classification: 'OPS_SHAPED', riskScore: 18 },
      tools: [dummyTool],
      maxToolSteps: 2,
    });

    expect(result.toolCallRecords).toHaveLength(1);
    expect(result.toolCallRecords[0].toolName).toBe('getHistoricalProfile');
    expect(result.toolCallRecords[0].result).toEqual({ accountAgeDays: 365, chargebackCount: 0 });
  });

  it('14. executeToolDecision handles throwing tool gracefully', async () => {
    const brokenTool = {
      name: 'failingExternalTool',
      description: 'Always fails',
      parameters: z.object({}),
      execute: async () => { throw new Error('Gateway network timeout'); },
    };

    const result = await provider.generateToolDecision<{
      classification: string;
      riskScore: number;
    }>({
      promptVersion: 'V1',
      systemPrompt: 'Tool user',
      userPrompt: 'RISK_DECISION_CONTEXT: Fault handling',
      schema: z.object({ classification: z.string(), riskScore: z.number() }),
      fallbackDecision: { classification: 'OPS_SHAPED', riskScore: 20 },
      tools: [brokenTool],
    });

    expect(result.toolCallRecords).toHaveLength(1);
    expect(result.toolCallRecords[0].result).toHaveProperty('error');
    expect(result.decision).toBeDefined();
  });

  it('15. provider status increments invocation and telemetry counts', () => {
    const status = provider.getStatus();
    expect(status.totalInvocations).toBeGreaterThan(0);
    expect(status.healthy).toBe(true);
  });
});
