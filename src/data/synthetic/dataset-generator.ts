import { 
  DatasetConfig, 
  SyntheticFinancialCase, 
  DatasetProfile, 
  ScenarioFamily,
  CustomerProfile 
} from '@/types';
import { SeededPRNG } from './prng';
import { EntityGraphGenerator } from './entity-generator';
import { ScenarioFactory } from './scenario-definitions';
import { DatasetProfiler } from './profiler';

export interface GeneratedDataset {
  config: DatasetConfig;
  profile: DatasetProfile;
  cases: SyntheticFinancialCase[];
  splits: {
    train: SyntheticFinancialCase[];
    val: SyntheticFinancialCase[];
    test: SyntheticFinancialCase[];
  };
}

export class DatasetGenerator {
  public static readonly DEFAULT_STANDARD_CONFIG: DatasetConfig = {
    size: 10000,
    seed: 42,
    merchantCount: 16,
    customerCount: 3500,
    mode: 'STANDARD',
    scenarioMix: {
      normalRatio: 0.40,
      benignAnomalyRatio: 0.25,
      recoverableFailureRatio: 0.20,
      riskFraudRatio: 0.15,
    },
    trainSplitRatio: 0.70,
    valSplitRatio: 0.15,
    testSplitRatio: 0.15,
  };

  public static readonly DEFAULT_ADVERSARIAL_CONFIG: DatasetConfig = {
    size: 10000,
    seed: 1337,
    merchantCount: 24,
    customerCount: 4000,
    mode: 'ADVERSARIAL',
    scenarioMix: {
      normalRatio: 0.50,
      benignAnomalyRatio: 0.20,
      recoverableFailureRatio: 0.15,
      riskFraudRatio: 0.15,
    },
    trainSplitRatio: 0.70,
    valSplitRatio: 0.15,
    testSplitRatio: 0.15,
  };

  private static datasetCache = new Map<string, GeneratedDataset>();

  public static clearCache(): void {
    this.datasetCache.clear();
  }

  /**
   * Generates a realistic, large-scale financial dataset with relational integrity
   */
  public static generateDataset(customConfig?: Partial<DatasetConfig>): GeneratedDataset {
    const startTime = performance.now();
    const isAdversarial = customConfig?.mode === 'ADVERSARIAL';
    const baseConfig = isAdversarial ? this.DEFAULT_ADVERSARIAL_CONFIG : this.DEFAULT_STANDARD_CONFIG;

    const config: DatasetConfig = {
      ...baseConfig,
      ...customConfig,
      scenarioMix: {
        ...baseConfig.scenarioMix!,
        ...customConfig?.scenarioMix,
      },
    };

    const cacheKey = JSON.stringify(config);
    const cached = this.datasetCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const prng = new SeededPRNG(config.seed);

    // 1. Generate Merchant Network & Customer Population with Fraud Rings
    const merchants = EntityGraphGenerator.generateMerchants(config.merchantCount, prng);
    const fraudRingCount = Math.max(2, Math.floor(config.customerCount * 0.01)); // ~1% fraud rings
    const population = EntityGraphGenerator.generateCustomerPopulation(
      config.customerCount,
      fraudRingCount,
      prng
    );

    // 2. Scenario Pools by Category
    const normalScenarios: ScenarioFamily[] = ['NORMAL_SETTLED', 'NORMAL_BURST'];
    const benignScenarios: ScenarioFamily[] = [
      'SETTLEMENT_DELAY', 'PARTIAL_SETTLEMENT', 'AMOUNT_MISMATCH', 'UNKNOWN_BANK_ENTRY',
      'NEAR_DUPLICATE_LEGITIMATE', 'MULTI_TRANSACTION_SINGLE_SETTLEMENT',
      'SINGLE_TRANSACTION_SPLIT_SETTLEMENT', 'UNKNOWN_BANK_CREDIT_LEGITIMATE',
      'DATA_CORRUPTION_NOISE', 'LEGITIMATE_HIGH_VALUE_OUTLIER', 'LEGITIMATE_VELOCITY_SPIKE',
      'HIGH_RISK_CUSTOMER_LEGITIMATE_TRANSACTION', 'CONFLICTING_SIGNALS', 'MULTIPLE_CANDIDATE_RECONCILIATION',
      'ADVERSARIAL_BANK_NARRATION', 'DUPLICATE_TRANSACTION', 'DUPLICATE_WITH_DIFFERENT_AMOUNT'
    ];
    const recoverableScenarios: ScenarioFamily[] = [
      'FAILED_PAYMENT_RETRYABLE', 'FAILED_PAYMENT_NON_RETRYABLE', 'ABANDONED_CHECKOUT',
      'FAILED_RECURRING_SUBSCRIPTION', 'MISSING_SETTLEMENT', 'RECOVERY_FALSE_SUCCESS',
      'RECOVERY_DELAYED_SUCCESS', 'RECOVERY_PARTIAL_SUCCESS', 'CUSTOMER_RESPONDS_TO_NUDGE',
      'CUSTOMER_IGNORES_RECOVERY', 'CUSTOMER_REQUESTS_NEGOTIATION', 'RETRY_LIMIT_EDGE',
      'COOLDOWN_EDGE', 'DISCOUNT_BOUNDARY', 'DISCOUNT_OVER_LIMIT', 'BORDERLINE_RISK_44',
      'BORDERLINE_RISK_45'
    ];
    const riskScenarios: ScenarioFamily[] = [
      'CHARGEBACK_DISPUTE', 'ORGANIZED_FRAUD_BURST', 'LOW_VALUE_FRAUD', 'SLOW_FRAUD',
      'FRAUD_WITH_NORMAL_HISTORY', 'ORGANIZED_MULTI_ACCOUNT_FRAUD',
      'SHARED_DEVICE_MULTI_ACCOUNT', 'SHARED_PAYMENT_INSTRUMENT', 'UNKNOWN_BANK_CREDIT_FRAUD',
      'BORDERLINE_RISK_69', 'BORDERLINE_RISK_70', 'BORDERLINE_RISK_71'
    ];

    const mix = config.scenarioMix!;
    const categoryWeights = [
      mix.normalRatio,
      mix.benignAnomalyRatio,
      mix.recoverableFailureRatio,
      mix.riskFraudRatio,
    ];
    const categories: Array<'NORMAL' | 'BENIGN' | 'RECOVERABLE' | 'RISK'> = [
      'NORMAL', 'BENIGN', 'RECOVERABLE', 'RISK'
    ];

    const baseTimestamp = Date.now();
    const cases: SyntheticFinancialCase[] = [];

    // 3. Batch Case Generation
    for (let i = 0; i < config.size; i++) {
      const chosenCategory = prng.sampleWeighted(categories, categoryWeights);
      let chosenScenario: ScenarioFamily;

      if (chosenCategory === 'NORMAL') {
        chosenScenario = prng.pick(normalScenarios);
      } else if (chosenCategory === 'BENIGN') {
        chosenScenario = prng.pick(benignScenarios);
      } else if (chosenCategory === 'RECOVERABLE') {
        chosenScenario = prng.pick(recoverableScenarios);
      } else {
        chosenScenario = prng.pick(riskScenarios);
      }

      const merchant = prng.pick(merchants);
      let customer: CustomerProfile;
      if (chosenCategory === 'RISK' && prng.chance(0.6)) {
        const ringCustomers = population.customers.filter((c) => c.isKnownFraudster);
        customer = ringCustomers.length > 0 ? prng.pick(ringCustomers) : prng.pick(population.customers);
      } else {
        customer = prng.pick(population.customers);
      }

      const device = population.devices.get(customer.primaryDeviceId) || {
        deviceId: `dev_${customer.id}`,
        ipAddress: `49.36.${prng.rangeInt(1, 250)}.${prng.rangeInt(1, 250)}`,
        userAgent: 'Mozilla/5.0 Chrome/122.0.0.0',
        geoCountry: 'IN',
        vpnProxyDetected: false,
        fingerprintVelocity24h: 1,
        linkedAccountCount: 1,
      };

      const financialCase = ScenarioFactory.createCase(
        i,
        chosenScenario,
        merchant,
        customer,
        device,
        prng,
        baseTimestamp
      );

      cases.push(financialCase);
    }

    const genTimeMs = Math.round(performance.now() - startTime);

    // 4. Stratified Train / Val / Test Splits
    const trainCount = Math.floor(config.size * (config.trainSplitRatio || 0.70));
    const valCount = Math.floor(config.size * (config.valSplitRatio || 0.15));

    const train = cases.slice(0, trainCount);
    const val = cases.slice(trainCount, trainCount + valCount);
    const test = cases.slice(trainCount + valCount);

    const profile = DatasetProfiler.profile(
      cases,
      config.seed,
      config.merchantCount,
      config.customerCount,
      genTimeMs
    );

    const result: GeneratedDataset = {
      config,
      profile,
      cases,
      splits: { train, val, test },
    };

    this.datasetCache.set(cacheKey, result);
    return result;
  }
}
