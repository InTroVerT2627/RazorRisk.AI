import { SyntheticFinancialCase, PublicCaseData, HiddenGroundTruth } from '@/types';

export class GroundTruthIsolation {
  private static readonly FORBIDDEN_LEAKAGE_KEYS = [
    'hiddenGroundTruth',
    'hiddenTruth',
    'isFraud',
    'isLegitimate',
    'expectedReconStatus',
    'expectedRiskClassification',
    'expectedSafeToRecover',
    'expectedOptimalAction',
    'expectedRecoverableCents',
    'expectedSettlementOutcome',
    'expectedCustomerResponse',
    'outlierType',
    'fraudRingId',
  ];

  /**
   * Sanitizes a synthetic case into strictly public case data for agents and production APIs.
   */
  public static extractPublicData(financialCase: SyntheticFinancialCase): PublicCaseData {
    return {
      caseId: financialCase.publicData.caseId,
      transaction: { ...financialCase.publicData.transaction },
      settlement: financialCase.publicData.settlement ? { ...financialCase.publicData.settlement } : undefined,
      allSettlementCandidates: financialCase.publicData.allSettlementCandidates
        ? [...financialCase.publicData.allSettlementCandidates]
        : undefined,
      signals: { ...financialCase.publicData.signals },
      customerMetadata: financialCase.publicData.customerMetadata
        ? { ...financialCase.publicData.customerMetadata }
        : undefined,
    };
  }

  /**
   * Asserts that an object passed to an agent or public context has ZERO ground-truth leakage.
   * Throws an error immediately if any ground truth keys are discovered.
   */
  public static assertNoGroundTruthLeakage(target: any, contextName = 'Agent Context'): void {
    if (!target || typeof target !== 'object') return;

    const jsonStr = JSON.stringify(target);
    for (const key of this.FORBIDDEN_LEAKAGE_KEYS) {
      if (jsonStr.includes(`"${key}"`)) {
        throw new Error(
          `[CRITICAL DATA LEAKAGE DETECTED in ${contextName}]: Ground-truth field '${key}' found in public agent payload!`
        );
      }
    }
  }
}
