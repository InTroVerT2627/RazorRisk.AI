import { AgentDecisionTelemetry } from './types';

export interface AgentMessage<T = any> {
  id: string;
  sourceAgent: 'FINANCE_CONTROLLER' | 'RISK_MANAGER' | 'REVENUE_RECOVERY' | 'FINOPS_ORCHESTRATOR' | 'POLICY_ENGINE';
  targetAgent?: 'FINANCE_CONTROLLER' | 'RISK_MANAGER' | 'REVENUE_RECOVERY' | 'FINOPS_ORCHESTRATOR' | 'POLICY_ENGINE';
  caseId: string;
  timestamp: string;
  schemaVersion: string;
  payload: T;
  telemetry?: AgentDecisionTelemetry;
}

export class AgentMessageEnvelope {
  public static create<T>(
    sourceAgent: AgentMessage['sourceAgent'],
    caseId: string,
    schemaVersion: string,
    payload: T,
    telemetry?: AgentDecisionTelemetry,
    targetAgent?: AgentMessage['targetAgent']
  ): AgentMessage<T> {
    return {
      id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      sourceAgent,
      targetAgent,
      caseId,
      timestamp: new Date().toISOString(),
      schemaVersion,
      payload,
      telemetry,
    };
  }
}
