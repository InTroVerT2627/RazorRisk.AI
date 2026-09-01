import { z } from 'zod';

export interface AgentToolDefinition<TArgs = any, TResult = any> {
  name: string;
  description: string;
  parameters: z.ZodType<TArgs>;
  execute: (args: TArgs) => Promise<TResult> | TResult;
}

export interface AgentToolCallRecord {
  toolName: string;
  args: Record<string, any>;
  result: any;
  durationMs: number;
}

export interface AgentDecisionTelemetry {
  promptVersion: string;
  modelIdentifier: string;
  toolsInvoked: AgentToolCallRecord[];
  latencyMs: number;
  tokensUsed?: {
    prompt: number;
    completion: number;
    total: number;
  };
  validatedSchema: boolean;
  fallbackTriggered: boolean;
}

export interface StructuredDecisionOptions<T> {
  promptVersion: string;
  systemPrompt: string;
  userPrompt: string;
  schema: z.ZodType<T>;
  fallbackDecision: T;
  modelIdentifier?: string;
  timeoutMs?: number;
  maxRetries?: number;
}

export interface ToolDecisionOptions<T> extends StructuredDecisionOptions<T> {
  tools: AgentToolDefinition[];
  maxToolSteps?: number;
}

export interface StructuredDecisionResult<T> {
  decision: T;
  telemetry: AgentDecisionTelemetry;
  rawResponse?: string;
}

export interface ToolDecisionResult<T> extends StructuredDecisionResult<T> {
  toolCallRecords: AgentToolCallRecord[];
}

export interface AIProviderStatus {
  providerName: string;
  model: string;
  healthy: boolean;
  totalInvocations: number;
  successfulInvocations: number;
  fallbackCount: number;
  avgLatencyMs: number;
}

export interface AIProvider {
  generateStructuredDecision<T>(options: StructuredDecisionOptions<T>): Promise<StructuredDecisionResult<T>>;
  generateToolDecision<T>(options: ToolDecisionOptions<T>): Promise<ToolDecisionResult<T>>;
  getStatus(): AIProviderStatus;
}
