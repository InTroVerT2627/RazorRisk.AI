import { 
  TransactionRecord, 
  SettlementRecord, 
  FinOpsCase, 
  RiskAssessment, 
  RecoveryActionRecord,
  CaseStatus,
  RiskClassification,
  RecoveryCase,
  RecoveryEligibilityStatus,
  RecoveryPriority,
  RecoveryQueueStatus
} from '@/types';
import { AuditLogger } from '../audit/audit-logger';
import { FinOpsStateMachine } from '../state-machine';

export class LedgerStore {
  private static instance: LedgerStore;
  private transactions: Map<string, TransactionRecord> = new Map();
  private settlements: Map<string, SettlementRecord> = new Map();
  private cases: Map<string, FinOpsCase> = new Map();
  private riskAssessments: Map<string, RiskAssessment[]> = new Map();
  private recoveryActions: Map<string, RecoveryActionRecord[]> = new Map();
  private recoveryCases: Map<string, RecoveryCase> = new Map();

  private constructor() {}

  public static getInstance(): LedgerStore {
    if (!LedgerStore.instance) {
      LedgerStore.instance = new LedgerStore();
    }
    return LedgerStore.instance;
  }

  // Transactions
  public addTransaction(tx: TransactionRecord): void {
    this.transactions.set(tx.id, tx);
  }

  public getTransaction(id: string): TransactionRecord | undefined {
    return this.transactions.get(id);
  }

  public getAllTransactions(): TransactionRecord[] {
    return Array.from(this.transactions.values());
  }

  // Settlements
  public addSettlement(st: SettlementRecord): void {
    this.settlements.set(st.id, st);
  }

  public getSettlement(id: string): SettlementRecord | undefined {
    return this.settlements.get(id);
  }

  public getAllSettlements(): SettlementRecord[] {
    return Array.from(this.settlements.values());
  }

  // Cases
  public createCase(params: {
    transactionId?: string;
    settlementId?: string;
    merchantId: string;
    amountAtRiskCents: number;
    reconStatus: FinOpsCase['reconStatus'];
    status?: CaseStatus;
    riskClassification?: RiskClassification;
    riskScore?: number;
    scenarioType?: string;
  }): FinOpsCase {
    const caseId = `case_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const caseNumber = `CASE-${Math.floor(100000 + Math.random() * 900000)}`;

    const newCase: FinOpsCase = {
      id: caseId,
      caseNumber,
      transactionId: params.transactionId,
      settlementId: params.settlementId,
      merchantId: params.merchantId,
      amountAtRiskCents: params.amountAtRiskCents,
      recoveredAmountCents: 0,
      status: params.status || 'EXCEPTION_DETECTED',
      reconStatus: params.reconStatus,
      riskClassification: params.riskClassification,
      riskScore: params.riskScore,
      retryCount: 0,
      maxRetriesAllowed: 3,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      scenarioType: params.scenarioType,
    };

    this.cases.set(caseId, newCase);

    AuditLogger.getInstance().record({
      caseId,
      actorType: 'SYSTEM',
      actorId: 'EXCEPTION_INGESTION_ENGINE',
      action: 'CREATE_FINOPS_CASE',
      decision: `Case created with status '${newCase.status}' for exception '${params.reconStatus}' with amount ₹${(params.amountAtRiskCents / 100).toFixed(2)}`,
      stateBefore: {},
      stateAfter: { ...newCase },
      confidence: 1.0,
    });

    return newCase;
  }

  public addCase(finOpsCase: FinOpsCase): void {
    this.cases.set(finOpsCase.id, finOpsCase);
  }

  public getCase(id: string): FinOpsCase | undefined {
    return this.cases.get(id);
  }

  public getAllCases(): FinOpsCase[] {
    return Array.from(this.cases.values());
  }

  public getCasesByStatus(status: CaseStatus): FinOpsCase[] {
    const result: FinOpsCase[] = [];
    for (const c of this.cases.values()) {
      if (c.status === status) {
        result.push(c);
      }
    }
    return result;
  }

  public updateCaseStatus(caseId: string, newStatus: CaseStatus, actorId: string, reason?: string): boolean {
    const targetCase = this.cases.get(caseId);
    if (!targetCase) return false;

    if (targetCase.status === newStatus) return true;

    const validation = FinOpsStateMachine.validateTransition(targetCase.status, newStatus);
    if (!validation.allowed) {
      console.warn(`[LedgerStore] State transition rejected: ${validation.reason}`);
      return false;
    }

    const stateBefore = { ...targetCase };
    targetCase.status = newStatus;
    targetCase.updatedAt = new Date().toISOString();
    if (reason) targetCase.escalationReason = reason;

    AuditLogger.getInstance().record({
      caseId,
      actorType: actorId.startsWith('HUMAN') ? 'HUMAN' : actorId.startsWith('AGENT_') ? (actorId as any) : 'SYSTEM',
      actorId,
      action: 'TRANSITION_CASE_STATUS',
      decision: `Case status changed from ${stateBefore.status} to ${newStatus}`,
      stateBefore,
      stateAfter: { ...targetCase },
      reasoningSummary: reason,
    });

    return true;
  }

  public updateCaseDetails(caseId: string, updates: Partial<FinOpsCase>): FinOpsCase | undefined {
    const targetCase = this.cases.get(caseId);
    if (!targetCase) return undefined;

    Object.assign(targetCase, updates, { updatedAt: new Date().toISOString() });
    return targetCase;
  }

  // Risk Assessments
  public addRiskAssessment(assessment: RiskAssessment): void {
    const list = this.riskAssessments.get(assessment.caseId) || [];
    list.push(assessment);
    this.riskAssessments.set(assessment.caseId, list);
  }

  public getRiskAssessments(caseId: string): RiskAssessment[] {
    return this.riskAssessments.get(caseId) || [];
  }

  // Recovery Actions
  public addRecoveryAction(action: RecoveryActionRecord): void {
    const list = this.recoveryActions.get(action.caseId) || [];
    list.push(action);
    this.recoveryActions.set(action.caseId, list);
  }

  public getRecoveryActions(caseId: string): RecoveryActionRecord[] {
    return this.recoveryActions.get(caseId) || [];
  }

  // Recovery Cases
  public calculateRecoveryPriority(params: {
    amountAtRiskCents: number;
    customerSegment?: 'ENTERPRISE' | 'MID_MARKET' | 'SMB' | 'CONSUMER';
    riskScore?: number;
    retryCount?: number;
  }): { priority: RecoveryPriority; priorityReason: string } {
    const { amountAtRiskCents, customerSegment = 'CONSUMER', riskScore = 20 } = params;
    if (amountAtRiskCents >= 5000000 || (customerSegment === 'ENTERPRISE' && riskScore < 30)) {
      return {
        priority: 'P0',
        priorityReason: `High-value exposure (₹${(amountAtRiskCents / 100).toLocaleString('en-IN')}) in ${customerSegment} segment with clean risk (${riskScore})`,
      };
    }
    if (amountAtRiskCents >= 1000000 || customerSegment === 'MID_MARKET') {
      return {
        priority: 'P1',
        priorityReason: `Mid-market receivable (₹${(amountAtRiskCents / 100).toLocaleString('en-IN')}) with high recovery probability`,
      };
    }
    if (amountAtRiskCents >= 200000 || customerSegment === 'SMB') {
      return {
        priority: 'P2',
        priorityReason: `Standard SMB receivable (₹${(amountAtRiskCents / 100).toLocaleString('en-IN')})`,
      };
    }
    return {
      priority: 'P3',
      priorityReason: `Low-ticket micro exception (₹${(amountAtRiskCents / 100).toLocaleString('en-IN')})`,
    };
  }

  public saveRecoveryCase(recCase: RecoveryCase): void {
    this.recoveryCases.set(recCase.caseId, recCase);
    const targetCase = this.cases.get(recCase.caseId);
    if (targetCase) {
      targetCase.recoveryEligible = recCase.eligibilityStatus === 'ELIGIBLE' || recCase.eligibilityStatus === 'VERIFIED';
      targetCase.recoveryEligibilityStatus = recCase.eligibilityStatus;
      targetCase.recoveryEligibilityReason = recCase.eligibilityReason;
      targetCase.recoveryPriority = recCase.priority;
      targetCase.campaignId = recCase.campaignId;
      targetCase.promiseToPay = recCase.promiseToPay;
      targetCase.partialCollection = recCase.partialCollection;
      targetCase.recoveryTrace = recCase.recoveryTrace;
      if (recCase.verifiedCollectedCents !== undefined) {
        targetCase.verifiedCollectedAmountCents = recCase.verifiedCollectedCents;
      }
      if (recCase.remainingAmountCents !== undefined) {
        targetCase.remainingRecoverableAmountCents = recCase.remainingAmountCents;
      }
      targetCase.recoveryCase = recCase;
    }
  }

  public getRecoveryCase(caseId: string): RecoveryCase | undefined {
    return this.recoveryCases.get(caseId);
  }

  public getAllRecoveryCases(): RecoveryCase[] {
    return Array.from(this.recoveryCases.values());
  }

  public evaluateAndSetRecoveryEligibility(
    caseId: string,
    isEligible: boolean,
    status: RecoveryEligibilityStatus,
    reason: string
  ): FinOpsCase | undefined {
    const targetCase = this.cases.get(caseId);
    if (!targetCase) return undefined;

    targetCase.recoveryEligible = isEligible;
    targetCase.recoveryEligibilityStatus = status;
    targetCase.recoveryEligibilityReason = reason;

    if (isEligible) {
      const tx = targetCase.transactionId ? this.getTransaction(targetCase.transactionId) : undefined;
      const { priority, priorityReason } = this.calculateRecoveryPriority({
        amountAtRiskCents: targetCase.amountAtRiskCents,
        customerSegment: tx?.customerSegment,
        riskScore: targetCase.riskScore,
        retryCount: targetCase.retryCount,
      });
      targetCase.recoveryPriority = priority;

      const existingRec = this.recoveryCases.get(caseId);
      const recCase: RecoveryCase = existingRec || {
        id: `rec_${targetCase.caseNumber.toLowerCase()}`,
        caseId,
        caseNumber: targetCase.caseNumber,
        transactionId: targetCase.transactionId,
        customerName: tx?.customerName || tx?.customerEmail?.split('@')[0] || 'Client',
        customerEmail: tx?.customerEmail,
        customerPhone: tx?.customerPhone,
        customerSegment: tx?.customerSegment || 'SMB',
        scenarioType: targetCase.scenarioType,
        amountAtRiskCents: targetCase.amountAtRiskCents,
        recoverableAmountCents: targetCase.amountAtRiskCents,
        riskScore: targetCase.riskScore ?? 20,
        riskClassification: targetCase.riskClassification || 'OPS_SHAPED',
        eligibilityStatus: status,
        eligibilityReason: reason,
        priority,
        priorityReason,
        strategy: targetCase.amountAtRiskCents >= 5000000 ? 'BOUNDED_NEGOTIATE' : 'RETRY_PAYMENT',
        channel: 'WHATSAPP',
        status: 'READY_FOR_RECOVERY',
        attempts: targetCase.retryCount || 0,
        maxAttempts: targetCase.maxRetriesAllowed || 3,
        nextRecommendedAction: targetCase.amountAtRiskCents >= 5000000 ? 'Dispatch B2B Discount Offer' : 'Trigger Smart Retry',
        policyStatus: 'APPROVED',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      recCase.eligibilityStatus = status;
      recCase.eligibilityReason = reason;
      recCase.updatedAt = new Date().toISOString();
      this.saveRecoveryCase(recCase);
    } else {
      const existingRec = this.recoveryCases.get(caseId);
      if (existingRec) {
        existingRec.eligibilityStatus = status;
        existingRec.eligibilityReason = reason;
        if (status === 'BLOCKED') existingRec.status = 'STOPPED';
        if (status === 'HUMAN_REVIEW') existingRec.status = 'ESCALATED';
        if (status === 'VERIFIED') existingRec.status = 'VERIFIED';
        existingRec.updatedAt = new Date().toISOString();
        this.saveRecoveryCase(existingRec);
      }
    }

    return targetCase;
  }

  public clear(): void {
    this.transactions.clear();
    this.settlements.clear();
    this.cases.clear();
    this.riskAssessments.clear();
    this.recoveryActions.clear();
    this.recoveryCases.clear();
    AuditLogger.getInstance().clear();
  }
}
