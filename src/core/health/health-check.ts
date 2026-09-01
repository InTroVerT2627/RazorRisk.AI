import { AuditLogger } from '../audit/audit-logger';
import { PolicyEngine } from '../policy-engine';
import { FinOpsAIProvider } from '../ai/provider';
import { LedgerStore } from '../ledger/ledger-store';

export interface SubsystemHealth {
  name: string;
  healthy: boolean;
  status: 'OPERATIONAL' | 'DEGRADED' | 'UNAVAILABLE';
  latencyMs?: number;
  details?: Record<string, any>;
}

export interface SystemHealthReport {
  status: 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY';
  version: string;
  uptimeSeconds: number;
  timestamp: string;
  subsystems: SubsystemHealth[];
  auditChainValid: boolean;
}

const START_TIME = Date.now();

export class HealthCheckService {
  public static async runHealthCheck(): Promise<SystemHealthReport> {
    const subsystems: SubsystemHealth[] = [];

    // 1. Audit Chain Integrity Subsystem
    const auditStart = performance.now();
    const audit = AuditLogger.getInstance();
    const chainVerification = audit.verifyChainIntegrity();
    subsystems.push({
      name: 'CryptographicAuditChain',
      healthy: chainVerification.valid,
      status: chainVerification.valid ? 'OPERATIONAL' : 'DEGRADED',
      latencyMs: Math.round(performance.now() - auditStart),
      details: { totalBlocks: audit.getEntries().length, valid: chainVerification.valid },
    });

    // 2. Policy Engine Subsystem
    const policyStart = performance.now();
    const policyEngine = PolicyEngine.getInstance();
    const defaultPolicy = policyEngine.getPolicy('MERCHANT_DEFAULT');
    subsystems.push({
      name: 'DeterministicPolicyEngine',
      healthy: defaultPolicy.isActive,
      status: defaultPolicy.isActive ? 'OPERATIONAL' : 'DEGRADED',
      latencyMs: Math.round(performance.now() - policyStart),
      details: { maxDiscount: defaultPolicy.maxDiscountBps, blockThreshold: defaultPolicy.riskScoreBlockThreshold },
    });

    // 3. AI Inference Provider Subsystem
    const aiProvider = FinOpsAIProvider.getInstance();
    const aiStatus = aiProvider.getStatus();
    subsystems.push({
      name: 'AIModelInferenceProvider',
      healthy: aiStatus.healthy,
      status: aiStatus.healthy ? 'OPERATIONAL' : 'DEGRADED',
      details: { model: aiStatus.model, fallbackCount: aiStatus.fallbackCount, invocations: aiStatus.totalInvocations },
    });

    // 4. In-Memory Ledger Store
    const ledger = LedgerStore.getInstance();
    subsystems.push({
      name: 'LedgerStoreState',
      healthy: true,
      status: 'OPERATIONAL',
      details: {
        transactionsCount: ledger.getAllTransactions().length,
        casesCount: ledger.getAllCases().length,
      },
    });

    const isAllHealthy = subsystems.every((s) => s.healthy);
    const uptimeSeconds = Math.floor((Date.now() - START_TIME) / 1000);

    return {
      status: isAllHealthy ? 'HEALTHY' : 'DEGRADED',
      version: '1.0.0-finops-buildathon',
      uptimeSeconds,
      timestamp: new Date().toISOString(),
      subsystems,
      auditChainValid: chainVerification.valid,
    };
  }
}
