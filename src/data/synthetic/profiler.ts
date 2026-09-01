import { SyntheticFinancialCase, DatasetProfile } from '@/types';

export class DatasetProfiler {
  public static profile(cases: SyntheticFinancialCase[], seed: number, merchantCount: number, customerCount: number, genTimeMs: number): DatasetProfile {
    const totalRecords = cases.length;
    const scenarioFamilyCounts: Record<string, number> = {};

    let normalCount = 0;
    let benignOpCount = 0;
    let recoverableCount = 0;
    let riskFraudCount = 0;
    let adversarialCount = 0;

    let legitimateOutliers = 0;
    let riskOutliers = 0;
    let operationalOutliers = 0;

    let missingFieldRows = 0;
    let corruptedNarrationRows = 0;
    let duplicateRows = 0;
    let timingJitterRows = 0;

    let maxAmount = 0;
    const amounts: number[] = [];

    const fraudRingMembers = new Map<string, number>();

    for (const c of cases) {
      const truth = c.hiddenGroundTruth;
      const pub = c.publicData;
      const scen = truth.scenarioType;

      scenarioFamilyCounts[scen] = (scenarioFamilyCounts[scen] || 0) + 1;

      // Grouping
      if (scen === 'NORMAL_SETTLED' || scen === 'NORMAL_BURST') {
        normalCount++;
      } else if (
        scen === 'SETTLEMENT_DELAY' ||
        scen === 'PARTIAL_SETTLEMENT' ||
        scen === 'AMOUNT_MISMATCH' ||
        scen === 'UNKNOWN_BANK_ENTRY' ||
        scen === 'NEAR_DUPLICATE_LEGITIMATE' ||
        scen === 'MULTI_TRANSACTION_SINGLE_SETTLEMENT' ||
        scen === 'SINGLE_TRANSACTION_SPLIT_SETTLEMENT' ||
        scen === 'UNKNOWN_BANK_CREDIT_LEGITIMATE' ||
        scen === 'DATA_CORRUPTION_NOISE'
      ) {
        benignOpCount++;
      } else if (
        scen === 'FAILED_PAYMENT_RETRYABLE' ||
        scen === 'FAILED_PAYMENT_NON_RETRYABLE' ||
        scen === 'ABANDONED_CHECKOUT' ||
        scen === 'FAILED_RECURRING_SUBSCRIPTION' ||
        scen === 'RECOVERY_FALSE_SUCCESS' ||
        scen === 'RECOVERY_DELAYED_SUCCESS' ||
        scen === 'RECOVERY_PARTIAL_SUCCESS' ||
        scen === 'CUSTOMER_RESPONDS_TO_NUDGE' ||
        scen === 'CUSTOMER_IGNORES_RECOVERY' ||
        scen === 'CUSTOMER_REQUESTS_NEGOTIATION' ||
        scen === 'MISSING_SETTLEMENT'
      ) {
        recoverableCount++;
      } else if (
        truth.isFraud ||
        scen === 'CHARGEBACK_DISPUTE' ||
        scen === 'ORGANIZED_FRAUD_BURST' ||
        scen === 'LOW_VALUE_FRAUD' ||
        scen === 'SLOW_FRAUD' ||
        scen === 'FRAUD_WITH_NORMAL_HISTORY' ||
        scen === 'ORGANIZED_MULTI_ACCOUNT_FRAUD' ||
        scen === 'SHARED_DEVICE_MULTI_ACCOUNT' ||
        scen === 'SHARED_PAYMENT_INSTRUMENT' ||
        scen === 'UNKNOWN_BANK_CREDIT_FRAUD'
      ) {
        riskFraudCount++;
      } else {
        adversarialCount++;
      }

      // Outliers
      if (truth.outlierType === 'LEGITIMATE_OUTLIER') legitimateOutliers++;
      else if (truth.outlierType === 'RISK_OUTLIER') riskOutliers++;
      else if (truth.outlierType === 'OPERATIONAL_OUTLIER') operationalOutliers++;

      // Noise metrics
      if (!pub.transaction.customerPhone || !pub.transaction.customerEmail) missingFieldRows++;
      if (pub.settlement?.rawDescription && pub.settlement.rawDescription.includes('   ')) corruptedNarrationRows++;
      if (scen === 'DUPLICATE_TRANSACTION' || scen === 'DUPLICATE_WITH_DIFFERENT_AMOUNT') duplicateRows++;
      if (pub.signals.bankTimingAnomalyHours > 24) timingJitterRows++;

      // Amounts
      const amt = pub.transaction.amountCents;
      if (amt > maxAmount) maxAmount = amt;
      amounts.push(amt);

      // Fraud rings
      if (truth.fraudRingId) {
        fraudRingMembers.set(truth.fraudRingId, (fraudRingMembers.get(truth.fraudRingId) || 0) + 1);
      }
    }

    amounts.sort((a, b) => a - b);
    const medianAmountCents = amounts.length > 0 ? amounts[Math.floor(amounts.length / 2)] : 0;

    const ringSizes = Array.from(fraudRingMembers.values());
    const largestRingSize = ringSizes.length > 0 ? Math.max(...ringSizes) : 0;
    const totalRingMembers = ringSizes.reduce((s, c) => s + c, 0);

    return {
      totalRecords,
      generationTimeMs: genTimeMs,
      seed,
      merchantCount,
      customerCount,
      classDistribution: {
        normalSettled: {
          count: normalCount,
          percentage: parseFloat(((normalCount / totalRecords) * 100).toFixed(2)),
        },
        benignOperational: {
          count: benignOpCount,
          percentage: parseFloat(((benignOpCount / totalRecords) * 100).toFixed(2)),
        },
        recoverableFailures: {
          count: recoverableCount,
          percentage: parseFloat(((recoverableCount / totalRecords) * 100).toFixed(2)),
        },
        riskAndFraud: {
          count: riskFraudCount,
          percentage: parseFloat(((riskFraudCount / totalRecords) * 100).toFixed(2)),
        },
        adversarialEdges: {
          count: adversarialCount,
          percentage: parseFloat(((adversarialCount / totalRecords) * 100).toFixed(2)),
        },
      },
      outlierStats: {
        totalOutliers: legitimateOutliers + riskOutliers + operationalOutliers,
        legitimateOutliers,
        riskOutliers,
        operationalOutliers,
      },
      noiseStats: {
        corruptedNarrationRows,
        missingFieldRows,
        timingJitterRows,
      },
      fraudRingStats: {
        totalRings: fraudRingMembers.size,
        totalRingMembers,
        largestRingSize,
      },
      amounts: {
        minCents: amounts.length > 0 ? amounts[0] : 0,
        maxCents: maxAmount,
        medianCents: medianAmountCents,
        meanCents: amounts.length > 0 ? Math.round(amounts.reduce((a, b) => a + b, 0) / amounts.length) : 0,
      },
    };
  }
}
