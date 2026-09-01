import crypto from 'crypto';
import { AuditTrailEntry } from '@/types';

export class AuditLogger {
  private static instance: AuditLogger;
  private entries: AuditTrailEntry[] = [];
  private genesisHash = '0000000000000000000000000000000000000000000000000000000000000000';

  private constructor() {}

  public static getInstance(): AuditLogger {
    if (!AuditLogger.instance) {
      AuditLogger.instance = new AuditLogger();
    }
    return AuditLogger.instance;
  }

  public record(params: {
    caseId?: string;
    actorType: AuditTrailEntry['actorType'];
    actorId: string;
    action: string;
    decision: string;
    policyEvaluation?: AuditTrailEntry['policyEvaluation'];
    stateBefore: Record<string, any>;
    stateAfter: Record<string, any>;
    reasoningSummary?: string;
    confidence?: number;
  }): AuditTrailEntry {
    const prevHash = this.entries.length > 0 
      ? this.entries[this.entries.length - 1].currentHash 
      : this.genesisHash;

    const id = this.entries.length + 1;
    const timestamp = new Date().toISOString();

    const stateBefore = JSON.parse(JSON.stringify(params.stateBefore || {}));
    const stateAfter = JSON.parse(JSON.stringify(params.stateAfter || {}));
    const policyEvaluation = params.policyEvaluation ? JSON.parse(JSON.stringify(params.policyEvaluation)) : undefined;

    const payload = JSON.stringify({
      id,
      prevHash,
      caseId: params.caseId,
      actorType: params.actorType,
      actorId: params.actorId,
      action: params.action,
      decision: params.decision,
      policyEvaluation,
      stateBefore,
      stateAfter,
      reasoningSummary: params.reasoningSummary,
      confidence: params.confidence,
      timestamp,
    });

    const currentHash = crypto.createHash('sha256').update(payload).digest('hex');

    const entry: AuditTrailEntry = {
      id,
      prevHash,
      currentHash,
      caseId: params.caseId,
      actorType: params.actorType,
      actorId: params.actorId,
      action: params.action,
      decision: params.decision,
      policyEvaluation,
      stateBefore,
      stateAfter,
      reasoningSummary: params.reasoningSummary,
      confidence: params.confidence,
      timestamp,
    };

    this.entries.push(entry);
    return entry;
  }

  public getEntries(caseId?: string): AuditTrailEntry[] {
    if (caseId) {
      return this.entries.filter((e) => e.caseId === caseId);
    }
    return [...this.entries];
  }

  public getTrailForCase(caseId: string): AuditTrailEntry[] {
    return this.getEntries(caseId);
  }

  public verifyChainIntegrity(): { valid: boolean; corruptedIndex?: number; error?: string } {
    for (let i = 0; i < this.entries.length; i++) {
      const entry = this.entries[i];
      const expectedPrevHash = i === 0 ? this.genesisHash : this.entries[i - 1].currentHash;

      if (entry.prevHash !== expectedPrevHash) {
        return {
          valid: false,
          corruptedIndex: i,
          error: `Broken hash link at index ${i}. Expected prevHash ${expectedPrevHash}, got ${entry.prevHash}`,
        };
      }

      const payload = JSON.stringify({
        id: entry.id,
        prevHash: entry.prevHash,
        caseId: entry.caseId,
        actorType: entry.actorType,
        actorId: entry.actorId,
        action: entry.action,
        decision: entry.decision,
        policyEvaluation: entry.policyEvaluation,
        stateBefore: entry.stateBefore,
        stateAfter: entry.stateAfter,
        reasoningSummary: entry.reasoningSummary,
        confidence: entry.confidence,
        timestamp: entry.timestamp,
      });

      const computedHash = crypto.createHash('sha256').update(payload).digest('hex');
      if (computedHash !== entry.currentHash) {
        return {
          valid: false,
          corruptedIndex: i,
          error: `Hash mismatch at index ${i}. Computed ${computedHash}, stored ${entry.currentHash}`,
        };
      }
    }

    return { valid: true };
  }

  public clear(): void {
    this.entries = [];
  }
}
