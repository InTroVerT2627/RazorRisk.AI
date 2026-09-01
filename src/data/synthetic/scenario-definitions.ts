import { 
  ScenarioFamily, 
  SyntheticFinancialCase, 
  MerchantRecord, 
  CustomerProfile, 
  DeviceSessionSignal,
  OutlierType,
  ReconStatus,
  RiskClassification,
  RecoveryActionType
} from '@/types';
import { SeededPRNG } from './prng';
import { FinancialNoiseEngine } from './noise-engine';

export class ScenarioFactory {
  /**
   * Generates a single synthetic financial case for a specific scenario family
   */
  public static createCase(
    index: number,
    scenarioType: ScenarioFamily,
    merchant: MerchantRecord,
    customer: CustomerProfile,
    device: DeviceSessionSignal,
    prng: SeededPRNG,
    baseTimestamp: number
  ): SyntheticFinancialCase {
    const caseId = `case_${(index + 1).toString().padStart(7, '0')}`;
    const txId = `tx_${(index + 1).toString().padStart(7, '0')}`;
    const externalRef = `RZP_ORD_${(100000 + index).toString()}`;
    const txTime = new Date(baseTimestamp - prng.rangeInt(1, 168) * 3600 * 1000).toISOString();

    // Default amounts
    let amountCents = prng.rangeInt(10000, 5000000); // ₹100 to ₹50,000 (wider default range)
    let outlierType: OutlierType = 'NONE';
    let isFraud = customer.isKnownFraudster;
    let isLegitimate = !isFraud;
    let expectedReconStatus: ReconStatus = 'EXACT_MATCH';
    let expectedRiskClassification: RiskClassification = 'OPS_SHAPED';
    let expectedSafeToRecover = true;
    let expectedOptimalAction: RecoveryActionType = 'SEND_PAYMENT_LINK';
    let expectedRecoverableCents = 0;
    let expectedSettlementOutcome: 'SETTLES_FULL' | 'SETTLES_PARTIAL' | 'SETTLES_DELAYED' | 'NEVER_SETTLES' = 'SETTLES_FULL';
    let expectedCustomerResponse: 'PAYS_INSTANT' | 'PAYS_AFTER_NUDGE' | 'ACCEPTS_DISCOUNT' | 'IGNORES' | 'DISPUTES' = 'PAYS_INSTANT';

    let txStatus: 'SUCCESS' | 'FAILED' | 'DISPUTED' | 'PENDING' = 'SUCCESS';
    let errorCode: string | undefined;
    let errorDesc: string | undefined;
    let paymentMethod: string = prng.pick(['UPI', 'CREDIT_CARD', 'DEBIT_CARD', 'NET_BANKING', 'WALLET', 'EMI', 'CARDLESS_EMI']);
    let gatewayCode = prng.pick(['HDFC_PG', 'ICICI_UPI', 'AXIS_CARD', 'SBI_NETBANKING', 'NPCI_SWITCH', 'RAZORPAY_SMART_ROUTER', 'PAYU_PG', 'CASHFREE_UPI']);

    // Payment methods and gateways with broader diversity
    const allPaymentMethods = ['UPI', 'CREDIT_CARD', 'DEBIT_CARD', 'NET_BANKING', 'WALLET', 'EMI', 'CARDLESS_EMI'] as const;
    const allGateways = ['HDFC_PG', 'ICICI_UPI', 'AXIS_CARD', 'SBI_NETBANKING', 'NPCI_SWITCH', 'RAZORPAY_SMART_ROUTER', 'PAYU_PG', 'CASHFREE_UPI'] as const;

    // Velocity & Signals
    let velocity24h = prng.rangeInt(1, 3);
    let chargebackRatio = customer.historicalDisputeRatio;
    let amountZScore = 0.2;
    let bankTimingAnomalyHours = 1;
    let deviceRisk: 'LOW' | 'MEDIUM' | 'HIGH' = device.vpnProxyDetected ? 'HIGH' : 'LOW';
    let disputeRecurrence = customer.historicalChargebackCount > 0;
    let failedCardAttemptsToday = 0;
    let linkedAccountsOnDevice = device.linkedAccountCount;

    // Customer segment distribution: ENTERPRISE 10%, MID_MARKET 25%, SMB 40%, CONSUMER 25%
    const customerSegment = prng.sampleWeighted(
      ['ENTERPRISE', 'MID_MARKET', 'SMB', 'CONSUMER'] as const,
      [0.10, 0.25, 0.40, 0.25]
    ) as 'ENTERPRISE' | 'MID_MARKET' | 'SMB' | 'CONSUMER';

    let hasSettlement = true;
    let settlementUtr = externalRef;
    let settlementAmountCents = amountCents;
    let feeCents = 0;
    let taxCents = 0;
    let netAmountCents = amountCents;
    let rawNarration = `UPI-CR-${externalRef}-${customer.name.toUpperCase()}-${merchant.name.substring(0, 10).toUpperCase()}`;

    // -------------------------------------------------------------
    // SCENARIO-SPECIFIC GENERATION (ALL 48 FAMILIES)
    // -------------------------------------------------------------
    switch (scenarioType) {
      // 1. NORMAL_SETTLED
      case 'NORMAL_SETTLED':
        expectedReconStatus = 'EXACT_MATCH';
        expectedRiskClassification = 'OPS_SHAPED';
        expectedSafeToRecover = false;
        expectedOptimalAction = 'STOP_RECOVERY';
        break;

      // 2. SETTLEMENT_DELAY
      case 'SETTLEMENT_DELAY':
        expectedReconStatus = 'TIMING_DELAY';
        expectedRiskClassification = 'BENIGN_DELAY';
        expectedSafeToRecover = false;
        expectedOptimalAction = 'STOP_RECOVERY';
        bankTimingAnomalyHours = prng.rangeInt(48, 72);
        outlierType = 'OPERATIONAL_OUTLIER';
        break;

      // 3. PARTIAL_SETTLEMENT
      case 'PARTIAL_SETTLEMENT': {
        expectedReconStatus = 'FEE_MISMATCH';
        expectedRiskClassification = 'OPS_SHAPED';
        expectedSafeToRecover = false;
        expectedOptimalAction = 'STOP_RECOVERY';
        const feeDeduction = FinancialNoiseEngine.applyFeeDeductions(amountCents, merchant.mdrBps, merchant.gstBps);
        feeCents = feeDeduction.feeCents;
        taxCents = feeDeduction.taxCents;
        netAmountCents = feeDeduction.netAmountCents;
        settlementAmountCents = netAmountCents;
        rawNarration = `MDR-NET-${externalRef}-FEES-DEDUCTED`;
        break;
      }

      // 4. AMOUNT_MISMATCH
      case 'AMOUNT_MISMATCH':
        expectedReconStatus = 'AMOUNT_MISMATCH';
        expectedRiskClassification = 'OPS_SHAPED';
        expectedSafeToRecover = true;
        expectedOptimalAction = 'REQUEST_BANK_PROOF';
        settlementAmountCents = amountCents - prng.rangeInt(5000, 20000); // ₹50 to ₹200 off
        netAmountCents = settlementAmountCents;
        expectedRecoverableCents = amountCents - settlementAmountCents;
        outlierType = 'OPERATIONAL_OUTLIER';
        break;

      // 5. FAILED_PAYMENT_RETRYABLE
      case 'FAILED_PAYMENT_RETRYABLE':
        txStatus = 'FAILED';
        hasSettlement = false;
        errorCode = 'GATEWAY_TIMEOUT_504';
        errorDesc = 'Bank network timeout at payment switch';
        expectedReconStatus = 'UNMATCHED_TRANSACTION';
        expectedRiskClassification = 'OPS_SHAPED';
        expectedSafeToRecover = true;
        expectedOptimalAction = 'RETRY_PAYMENT';
        expectedRecoverableCents = amountCents;
        expectedCustomerResponse = 'PAYS_INSTANT';
        break;

      // 6. FAILED_PAYMENT_NON_RETRYABLE
      case 'FAILED_PAYMENT_NON_RETRYABLE':
        txStatus = 'FAILED';
        hasSettlement = false;
        errorCode = 'INSUFFICIENT_FUNDS_51';
        errorDesc = 'Card balance exceeded or limit exhausted';
        expectedReconStatus = 'UNMATCHED_TRANSACTION';
        expectedRiskClassification = 'OPS_SHAPED';
        expectedSafeToRecover = true;
        expectedOptimalAction = 'SEND_PAYMENT_LINK';
        expectedRecoverableCents = amountCents;
        expectedCustomerResponse = 'PAYS_AFTER_NUDGE';
        break;

      // 7. DUPLICATE_TRANSACTION
      case 'DUPLICATE_TRANSACTION':
        expectedReconStatus = 'DUPLICATE_SUSPECTED';
        expectedRiskClassification = 'OPS_SHAPED';
        expectedSafeToRecover = false;
        expectedOptimalAction = 'ESCALATE_HUMAN';
        expectedRecoverableCents = amountCents;
        outlierType = 'OPERATIONAL_OUTLIER';
        break;

      // 8. UNKNOWN_BANK_ENTRY
      case 'UNKNOWN_BANK_ENTRY':
        hasSettlement = true;
        txStatus = 'PENDING';
        settlementUtr = `NEFT_${prng.rangeInt(1000, 9999)}`;
        rawNarration = `NEFT-CR-RAZORPAY-${customer.name.toUpperCase()}-${customer.phone.slice(-4)}`;
        expectedReconStatus = 'FUZZY_MATCH_HIGH';
        expectedRiskClassification = 'OPS_SHAPED';
        expectedSafeToRecover = false;
        expectedOptimalAction = 'STOP_RECOVERY';
        break;

      // 9. CHARGEBACK_DISPUTE
      case 'CHARGEBACK_DISPUTE':
        txStatus = 'DISPUTED';
        errorCode = 'CHARGEBACK_FRAUD_4837';
        isFraud = true;
        isLegitimate = false;
        chargebackRatio = prng.range(0.4, 0.8);
        disputeRecurrence = true;
        expectedReconStatus = 'CHARGEBACK_SUSPECTED';
        expectedRiskClassification = 'RISK_SHAPED';
        expectedSafeToRecover = false;
        expectedOptimalAction = 'STOP_RECOVERY';
        outlierType = 'RISK_OUTLIER';
        break;

      // 10. ABANDONED_CHECKOUT
      case 'ABANDONED_CHECKOUT':
        txStatus = 'FAILED';
        hasSettlement = false;
        errorCode = 'OTP_EXPIRED_DROP';
        amountCents = prng.rangeInt(200000, 500000); // ₹2,000 - ₹5,000
        expectedReconStatus = 'UNMATCHED_TRANSACTION';
        expectedRiskClassification = 'OPS_SHAPED';
        expectedSafeToRecover = true;
        expectedOptimalAction = 'OFFER_BOUNDED_DISCOUNT';
        expectedRecoverableCents = amountCents;
        expectedCustomerResponse = 'ACCEPTS_DISCOUNT';
        break;

      // 11. FAILED_RECURRING_SUBSCRIPTION
      case 'FAILED_RECURRING_SUBSCRIPTION':
        txStatus = 'FAILED';
        hasSettlement = false;
        paymentMethod = 'AUTOPAY';
        errorCode = 'MANDATE_EXPIRED';
        amountCents = prng.rangeInt(9900, 499900); // ₹99 - ₹4,999
        expectedReconStatus = 'UNMATCHED_TRANSACTION';
        expectedRiskClassification = 'OPS_SHAPED';
        expectedSafeToRecover = true;
        expectedOptimalAction = 'SEND_PAYMENT_LINK';
        expectedRecoverableCents = amountCents;
        break;

      // 12. ORGANIZED_FRAUD_BURST
      case 'ORGANIZED_FRAUD_BURST':
        txStatus = 'FAILED';
        hasSettlement = false;
        isFraud = true;
        isLegitimate = false;
        velocity24h = prng.rangeInt(15, 45);
        failedCardAttemptsToday = prng.rangeInt(6, 12);
        deviceRisk = 'HIGH';
        amountCents = prng.rangeInt(100000, 1500000); // ₹1,000 - ₹15,000
        expectedReconStatus = 'UNMATCHED_TRANSACTION';
        expectedRiskClassification = 'CRITICAL_FRAUD';
        expectedSafeToRecover = false;
        expectedOptimalAction = 'STOP_RECOVERY';
        outlierType = 'RISK_OUTLIER';
        break;

      // 13. LEGITIMATE_HIGH_VALUE_OUTLIER (False Positive Trap)
      case 'LEGITIMATE_HIGH_VALUE_OUTLIER':
        amountCents = prng.rangeInt(5000000, 25000000); // ₹50,000 - ₹2,50,000 (Very High)
        settlementAmountCents = amountCents;
        netAmountCents = amountCents;
        amountZScore = 4.5; // High numerical outlier, but customer is verified B2B
        isFraud = false;
        isLegitimate = true;
        outlierType = 'LEGITIMATE_OUTLIER';
        expectedReconStatus = 'EXACT_MATCH';
        expectedRiskClassification = 'OPS_SHAPED';
        expectedSafeToRecover = false;
        expectedOptimalAction = 'STOP_RECOVERY';
        break;

      // 14. LEGITIMATE_VELOCITY_SPIKE (False Positive Trap)
      case 'LEGITIMATE_VELOCITY_SPIKE':
        velocity24h = prng.rangeInt(8, 14); // High velocity, but legitimate flash shopper
        isFraud = false;
        isLegitimate = true;
        chargebackRatio = 0;
        deviceRisk = 'LOW';
        outlierType = 'LEGITIMATE_OUTLIER';
        expectedReconStatus = 'EXACT_MATCH';
        expectedRiskClassification = 'OPS_SHAPED';
        expectedSafeToRecover = false;
        expectedOptimalAction = 'STOP_RECOVERY';
        break;

      // 15. LOW_VALUE_FRAUD
      case 'LOW_VALUE_FRAUD':
        amountCents = prng.rangeInt(1000, 5000); // ₹10 - ₹50 card probing
        isFraud = true;
        isLegitimate = false;
        failedCardAttemptsToday = prng.rangeInt(5, 10);
        expectedReconStatus = 'UNMATCHED_TRANSACTION';
        expectedRiskClassification = 'CRITICAL_FRAUD';
        expectedSafeToRecover = false;
        expectedOptimalAction = 'STOP_RECOVERY';
        outlierType = 'RISK_OUTLIER';
        break;

      // 16. SLOW_FRAUD
      case 'SLOW_FRAUD':
        isFraud = true;
        isLegitimate = false;
        velocity24h = 1; // Slow to evade 24h filter
        chargebackRatio = 0.5;
        disputeRecurrence = true;
        amountCents = prng.rangeInt(30000, 200000); // ₹300 - ₹2,000
        expectedReconStatus = 'CHARGEBACK_SUSPECTED';
        expectedRiskClassification = 'RISK_SHAPED';
        expectedSafeToRecover = false;
        expectedOptimalAction = 'STOP_RECOVERY';
        break;

      // 17. FRAUD_WITH_NORMAL_HISTORY
      case 'FRAUD_WITH_NORMAL_HISTORY':
        isFraud = true;
        isLegitimate = false;
        deviceRisk = 'HIGH'; // Compromised account / session hijack
        failedCardAttemptsToday = 4;
        amountCents = prng.rangeInt(200000, 2000000); // ₹2,000 - ₹20,000
        expectedReconStatus = 'UNMATCHED_TRANSACTION';
        expectedRiskClassification = 'RISK_SHAPED';
        expectedSafeToRecover = false;
        expectedOptimalAction = 'STOP_RECOVERY';
        break;

      // 18. HIGH_RISK_CUSTOMER_LEGITIMATE_TRANSACTION (False Positive Trap)
      case 'HIGH_RISK_CUSTOMER_LEGITIMATE_TRANSACTION':
        chargebackRatio = 0.35; // Old dispute on record, but this TX is verified
        isFraud = false;
        isLegitimate = true;
        outlierType = 'LEGITIMATE_OUTLIER';
        expectedReconStatus = 'EXACT_MATCH';
        expectedRiskClassification = 'OPS_SHAPED';
        expectedSafeToRecover = false;
        expectedOptimalAction = 'STOP_RECOVERY';
        break;

      // 19. NEAR_DUPLICATE_LEGITIMATE
      case 'NEAR_DUPLICATE_LEGITIMATE':
        isFraud = false;
        isLegitimate = true;
        expectedReconStatus = 'EXACT_MATCH';
        expectedRiskClassification = 'OPS_SHAPED';
        expectedSafeToRecover = false;
        expectedOptimalAction = 'STOP_RECOVERY';
        break;

      // 20. DUPLICATE_WITH_DIFFERENT_AMOUNT
      case 'DUPLICATE_WITH_DIFFERENT_AMOUNT':
        expectedReconStatus = 'DUPLICATE_SUSPECTED';
        expectedRiskClassification = 'OPS_SHAPED';
        expectedSafeToRecover = false;
        expectedOptimalAction = 'ESCALATE_HUMAN';
        break;

      // 21. MULTI_TRANSACTION_SINGLE_SETTLEMENT
      case 'MULTI_TRANSACTION_SINGLE_SETTLEMENT':
        expectedReconStatus = 'MULTI_TRANSACTION_BATCH';
        expectedRiskClassification = 'OPS_SHAPED';
        expectedSafeToRecover = false;
        expectedOptimalAction = 'STOP_RECOVERY';
        break;

      // 22. SINGLE_TRANSACTION_SPLIT_SETTLEMENT
      case 'SINGLE_TRANSACTION_SPLIT_SETTLEMENT':
        expectedReconStatus = 'SPLIT_SETTLEMENT';
        expectedRiskClassification = 'OPS_SHAPED';
        expectedSafeToRecover = false;
        expectedOptimalAction = 'STOP_RECOVERY';
        settlementAmountCents = Math.round(amountCents / 2);
        netAmountCents = settlementAmountCents;
        break;

      // 23. MISSING_SETTLEMENT
      case 'MISSING_SETTLEMENT':
        hasSettlement = false;
        txStatus = 'SUCCESS'; // Succeeded on gateway, missing in bank
        amountCents = prng.rangeInt(100000, 3000000); // ₹1,000 - ₹30,000
        expectedReconStatus = 'MISSING_SETTLEMENT';
        expectedRiskClassification = 'OPS_SHAPED';
        expectedSafeToRecover = true;
        expectedOptimalAction = 'REQUEST_BANK_PROOF';
        expectedRecoverableCents = amountCents;
        break;

      // 24. UNKNOWN_BANK_CREDIT_LEGITIMATE
      case 'UNKNOWN_BANK_CREDIT_LEGITIMATE':
        hasSettlement = true;
        txStatus = 'PENDING';
        settlementUtr = `NEFT_CORRUPT_${prng.rangeInt(100, 999)}`;
        rawNarration = FinancialNoiseEngine.corruptNarration(`NEFT-CR-RAZORPAY-${customer.name}`, prng);
        expectedReconStatus = 'FUZZY_MATCH_LOW';
        expectedRiskClassification = 'OPS_SHAPED';
        expectedSafeToRecover = false;
        expectedOptimalAction = 'STOP_RECOVERY';
        break;

      // 25. UNKNOWN_BANK_CREDIT_FRAUD
      case 'UNKNOWN_BANK_CREDIT_FRAUD':
        hasSettlement = true;
        isFraud = true;
        isLegitimate = false;
        settlementUtr = `PHISH_${prng.rangeInt(1000, 9999)}`;
        rawNarration = `UNAUTHORIZED-CREDIT-UNKNOWN-ORIGIN`;
        expectedReconStatus = 'UNMATCHED_SETTLEMENT';
        expectedRiskClassification = 'CRITICAL_FRAUD';
        expectedSafeToRecover = false;
        expectedOptimalAction = 'STOP_RECOVERY';
        outlierType = 'RISK_OUTLIER';
        break;

      // 26. BORDERLINE_RISK_44 (Just below human threshold 45)
      case 'BORDERLINE_RISK_44':
        velocity24h = 4;
        chargebackRatio = 0.15;
        txStatus = 'FAILED';
        hasSettlement = false;
        errorCode = 'ACCOUNT_CLOSED_14';
        errorDesc = 'Customer account closed at issuing bank';
        expectedReconStatus = 'UNMATCHED_TRANSACTION';
        expectedRiskClassification = 'OPS_SHAPED';
        expectedSafeToRecover = true;
        expectedOptimalAction = 'SEND_PAYMENT_LINK';
        expectedRecoverableCents = amountCents;
        break;

      // 27. BORDERLINE_RISK_45 (Exactly at human threshold)
      case 'BORDERLINE_RISK_45':
        velocity24h = 4;
        chargebackRatio = 0.20;
        txStatus = 'FAILED';
        hasSettlement = false;
        errorCode = 'VPA_NOT_FOUND';
        errorDesc = 'Virtual payment address not found on UPI network';
        expectedReconStatus = 'UNMATCHED_TRANSACTION';
        expectedRiskClassification = 'BORDERLINE_REVIEW';
        expectedSafeToRecover = true;
        expectedOptimalAction = 'ESCALATE_HUMAN';
        expectedRecoverableCents = amountCents;
        break;

      // 28. BORDERLINE_RISK_69 (Just below block threshold 70)
      case 'BORDERLINE_RISK_69':
        velocity24h = 6;
        chargebackRatio = 0.28;
        amountCents = prng.rangeInt(500000, 3000000); // ₹5,000 - ₹30,000
        expectedReconStatus = 'UNMATCHED_TRANSACTION';
        expectedRiskClassification = 'BORDERLINE_REVIEW';
        expectedSafeToRecover = false;
        expectedOptimalAction = 'ESCALATE_HUMAN';
        break;

      // 29. BORDERLINE_RISK_70 (Exactly at block threshold)
      case 'BORDERLINE_RISK_70':
        velocity24h = 7;
        chargebackRatio = 0.35;
        isFraud = true;
        amountCents = prng.rangeInt(300000, 2000000); // ₹3,000 - ₹20,000
        expectedReconStatus = 'UNMATCHED_TRANSACTION';
        expectedRiskClassification = 'RISK_SHAPED';
        expectedSafeToRecover = false;
        expectedOptimalAction = 'STOP_RECOVERY';
        break;

      // 30. BORDERLINE_RISK_71 (Just above block threshold)
      case 'BORDERLINE_RISK_71':
        velocity24h = 8;
        chargebackRatio = 0.38;
        isFraud = true;
        amountCents = prng.rangeInt(200000, 1500000); // ₹2,000 - ₹15,000
        expectedReconStatus = 'UNMATCHED_TRANSACTION';
        expectedRiskClassification = 'RISK_SHAPED';
        expectedSafeToRecover = false;
        expectedOptimalAction = 'STOP_RECOVERY';
        break;

      // 31. RETRY_LIMIT_EDGE
      case 'RETRY_LIMIT_EDGE':
        txStatus = 'FAILED';
        hasSettlement = false;
        errorCode = 'BANK_DECLINED_05';
        errorDesc = 'General bank decline after multiple retries';
        expectedReconStatus = 'UNMATCHED_TRANSACTION';
        expectedRiskClassification = 'OPS_SHAPED';
        expectedSafeToRecover = false;
        expectedOptimalAction = 'ESCALATE_HUMAN';
        break;

      // 32. COOLDOWN_EDGE
      case 'COOLDOWN_EDGE':
        txStatus = 'FAILED';
        hasSettlement = false;
        errorCode = '3DS_TIMEOUT';
        errorDesc = '3D Secure authentication window expired';
        expectedReconStatus = 'UNMATCHED_TRANSACTION';
        expectedRiskClassification = 'OPS_SHAPED';
        expectedSafeToRecover = true;
        expectedOptimalAction = 'SEND_NUDGE';
        expectedRecoverableCents = amountCents;
        break;

      // 33. DISCOUNT_BOUNDARY
      case 'DISCOUNT_BOUNDARY':
        txStatus = 'FAILED';
        hasSettlement = false;
        errorCode = 'CVV_MISMATCH_N7';
        errorDesc = 'Card verification value mismatch';
        expectedReconStatus = 'UNMATCHED_TRANSACTION';
        expectedRiskClassification = 'OPS_SHAPED';
        expectedSafeToRecover = true;
        expectedOptimalAction = 'OFFER_BOUNDED_DISCOUNT';
        expectedRecoverableCents = amountCents;
        break;

      // 34. DISCOUNT_OVER_LIMIT
      case 'DISCOUNT_OVER_LIMIT':
        txStatus = 'FAILED';
        hasSettlement = false;
        errorCode = 'DAILY_LIMIT_EXCEEDED_65';
        errorDesc = 'Daily spending limit exceeded on card';
        expectedReconStatus = 'UNMATCHED_TRANSACTION';
        expectedRiskClassification = 'OPS_SHAPED';
        expectedSafeToRecover = true;
        expectedOptimalAction = 'OFFER_BOUNDED_DISCOUNT';
        expectedRecoverableCents = amountCents;
        break;

      // 35. RECOVERY_FALSE_SUCCESS
      case 'RECOVERY_FALSE_SUCCESS':
        txStatus = 'FAILED';
        hasSettlement = false;
        errorCode = 'SUSPECTED_FRAUD_59';
        errorDesc = 'Transaction flagged by issuer fraud detection';
        expectedReconStatus = 'UNMATCHED_TRANSACTION';
        expectedRiskClassification = 'OPS_SHAPED';
        expectedSafeToRecover = true;
        expectedOptimalAction = 'SEND_PAYMENT_LINK';
        expectedRecoverableCents = amountCents;
        expectedSettlementOutcome = 'NEVER_SETTLES';
        break;

      // 36. RECOVERY_DELAYED_SUCCESS
      case 'RECOVERY_DELAYED_SUCCESS':
        txStatus = 'FAILED';
        hasSettlement = false;
        errorCode = 'ISSUER_UNAVAILABLE_91';
        errorDesc = 'Issuing bank temporarily unavailable';
        expectedReconStatus = 'UNMATCHED_TRANSACTION';
        expectedRiskClassification = 'OPS_SHAPED';
        expectedSafeToRecover = true;
        expectedOptimalAction = 'SEND_PAYMENT_LINK';
        expectedRecoverableCents = amountCents;
        expectedSettlementOutcome = 'SETTLES_DELAYED';
        break;

      // 37. RECOVERY_PARTIAL_SUCCESS
      case 'RECOVERY_PARTIAL_SUCCESS':
        txStatus = 'FAILED';
        hasSettlement = false;
        errorCode = 'INVALID_AMOUNT_13';
        errorDesc = 'Transaction amount exceeds partial authorization limit';
        expectedReconStatus = 'UNMATCHED_TRANSACTION';
        expectedRiskClassification = 'OPS_SHAPED';
        expectedSafeToRecover = true;
        expectedOptimalAction = 'SEND_PAYMENT_LINK';
        expectedRecoverableCents = Math.round(amountCents * 0.6); // Only 60% recovered
        expectedSettlementOutcome = 'SETTLES_PARTIAL';
        break;

      // 38. CUSTOMER_RESPONDS_TO_NUDGE
      case 'CUSTOMER_RESPONDS_TO_NUDGE':
        txStatus = 'FAILED';
        hasSettlement = false;
        errorCode = 'UPI_TIMEOUT';
        errorDesc = 'UPI collect request expired without response';
        expectedReconStatus = 'UNMATCHED_TRANSACTION';
        expectedRiskClassification = 'OPS_SHAPED';
        expectedSafeToRecover = true;
        expectedOptimalAction = 'SEND_NUDGE';
        expectedRecoverableCents = amountCents;
        expectedCustomerResponse = 'PAYS_AFTER_NUDGE';
        break;

      // 39. CUSTOMER_IGNORES_RECOVERY
      case 'CUSTOMER_IGNORES_RECOVERY':
        txStatus = 'FAILED';
        hasSettlement = false;
        errorCode = 'DO_NOT_HONOR_57';
        errorDesc = 'Issuer declined without specific reason';
        expectedReconStatus = 'UNMATCHED_TRANSACTION';
        expectedRiskClassification = 'OPS_SHAPED';
        expectedSafeToRecover = true;
        expectedOptimalAction = 'SEND_NUDGE';
        expectedRecoverableCents = amountCents;
        expectedCustomerResponse = 'IGNORES';
        expectedSettlementOutcome = 'NEVER_SETTLES';
        break;

      // 40. CUSTOMER_REQUESTS_NEGOTIATION
      case 'CUSTOMER_REQUESTS_NEGOTIATION':
        txStatus = 'FAILED';
        hasSettlement = false;
        errorCode = 'CARD_EXPIRED_54';
        errorDesc = 'Payment card expired, customer notified for update';
        amountCents = prng.rangeInt(5000000, 10000000); // ₹50,000 - ₹1,00,000 (B2B)
        expectedReconStatus = 'UNMATCHED_TRANSACTION';
        expectedRiskClassification = 'OPS_SHAPED';
        expectedSafeToRecover = true;
        expectedOptimalAction = 'BOUNDED_NEGOTIATE';
        expectedRecoverableCents = Math.round(amountCents * 0.9);
        break;

      // 41. ORGANIZED_MULTI_ACCOUNT_FRAUD
      case 'ORGANIZED_MULTI_ACCOUNT_FRAUD':
        isFraud = true;
        isLegitimate = false;
        linkedAccountsOnDevice = prng.rangeInt(5, 12);
        deviceRisk = 'HIGH';
        expectedReconStatus = 'UNMATCHED_TRANSACTION';
        expectedRiskClassification = 'CRITICAL_FRAUD';
        expectedSafeToRecover = false;
        expectedOptimalAction = 'STOP_RECOVERY';
        outlierType = 'RISK_OUTLIER';
        break;

      // 42. SHARED_DEVICE_MULTI_ACCOUNT
      case 'SHARED_DEVICE_MULTI_ACCOUNT':
        isFraud = true;
        isLegitimate = false;
        linkedAccountsOnDevice = prng.rangeInt(4, 9);
        deviceRisk = 'HIGH';
        expectedReconStatus = 'UNMATCHED_TRANSACTION';
        expectedRiskClassification = 'CRITICAL_FRAUD';
        expectedSafeToRecover = false;
        expectedOptimalAction = 'STOP_RECOVERY';
        break;

      // 43. SHARED_PAYMENT_INSTRUMENT
      case 'SHARED_PAYMENT_INSTRUMENT':
        isFraud = true;
        isLegitimate = false;
        failedCardAttemptsToday = prng.rangeInt(4, 8);
        amountCents = prng.rangeInt(5000, 50000); // ₹50 - ₹500 (probing)
        expectedReconStatus = 'UNMATCHED_TRANSACTION';
        expectedRiskClassification = 'CRITICAL_FRAUD';
        expectedSafeToRecover = false;
        expectedOptimalAction = 'STOP_RECOVERY';
        break;

      // 44. NORMAL_BURST (Diwali sale volume burst - legitimate)
      case 'NORMAL_BURST':
        velocity24h = prng.rangeInt(5, 10);
        isFraud = false;
        isLegitimate = true;
        expectedReconStatus = 'EXACT_MATCH';
        expectedRiskClassification = 'OPS_SHAPED';
        expectedSafeToRecover = false;
        expectedOptimalAction = 'STOP_RECOVERY';
        break;

      // 45. DATA_CORRUPTION_NOISE
      case 'DATA_CORRUPTION_NOISE':
        isFraud = false;
        isLegitimate = true;
        expectedReconStatus = 'CORRUPTED_RECORD';
        expectedRiskClassification = 'OPS_SHAPED';
        expectedSafeToRecover = false;
        expectedOptimalAction = 'REQUEST_BANK_PROOF';
        rawNarration = FinancialNoiseEngine.corruptNarration(rawNarration, prng);
        outlierType = 'OPERATIONAL_OUTLIER';
        break;

      // 46. CONFLICTING_SIGNALS (High amount + 0 velocity + clean history)
      case 'CONFLICTING_SIGNALS':
        amountCents = prng.rangeInt(8000000, 15000000); // High amount
        velocity24h = 1;
        chargebackRatio = 0;
        isFraud = false;
        isLegitimate = true;
        outlierType = 'LEGITIMATE_OUTLIER';
        expectedReconStatus = 'EXACT_MATCH';
        expectedRiskClassification = 'OPS_SHAPED';
        expectedSafeToRecover = false;
        expectedOptimalAction = 'STOP_RECOVERY';
        break;

      // 47. MULTIPLE_CANDIDATE_RECONCILIATION
      case 'MULTIPLE_CANDIDATE_RECONCILIATION':
        expectedReconStatus = 'AMBIGUOUS_MULTI_CANDIDATE';
        expectedRiskClassification = 'OPS_SHAPED';
        expectedSafeToRecover = false;
        expectedOptimalAction = 'ESCALATE_HUMAN';
        break;

      // 48. ADVERSARIAL_BANK_NARRATION
      case 'ADVERSARIAL_BANK_NARRATION':
        rawNarration = `SPOOFED-CR-${externalRef.replace(/ORD/, 'FAKE')}-LEGIT-LOOKING`;
        expectedReconStatus = 'FUZZY_MATCH_LOW';
        expectedRiskClassification = 'OPS_SHAPED';
        expectedSafeToRecover = false;
        expectedOptimalAction = 'REQUEST_BANK_PROOF';
        break;
    }

    // Assemble Public Transaction Record
    const transaction = {
      id: txId,
      merchantId: merchant.id,
      externalRef,
      amountCents,
      currency: 'INR',
      status: txStatus,
      customerId: customer.id,
      customerName: customer.name,
      customerEmail: customer.email,
      customerPhone: customer.phone,
      paymentMethod,
      gatewayCode,
      errorCode,
      errorDescription: errorDesc,
      createdAt: txTime,
      deviceId: device.deviceId,
      customerSegment,
    };

    // Assemble Public Settlement Record
    const settlement = hasSettlement
      ? {
          id: `st_${(index + 1).toString().padStart(7, '0')}`,
          batchId: `BATCH_${txTime.substring(0, 10).replace(/-/g, '')}`,
          utrRrn: settlementUtr,
          amountCents: settlementAmountCents,
          feeCents,
          taxCents,
          netAmountCents,
          currency: 'INR',
          bankTimestamp: FinancialNoiseEngine.applyTimestampJitter(txTime, bankTimingAnomalyHours, prng),
          rawDescription: rawNarration,
          reconciledStatus: expectedReconStatus,
          createdAt: txTime,
        }
      : undefined;

    // Public Signals
    const signals = {
      customerVelocity24h: velocity24h,
      chargebackHistoryRatio: chargebackRatio,
      amountDeviationZScore: amountZScore,
      bankTimingAnomalyHours,
      deviceFingerprintRisk: deviceRisk,
      disputeRecurrenceFlag: disputeRecurrence,
      failedCardAttemptsToday,
      linkedAccountsOnDevice,
    };

    // Strict Public Data (NO ground truth labels)
    const publicData = {
      caseId,
      transaction,
      settlement,
      signals,
      customerMetadata: {
        accountAgeDays: customer.accountAgeDays,
        historicalTransactionsCount: customer.historicalTransactionsCount,
        isHighLtv: customer.isHighLtv,
      },
    };

    // Hidden Ground Truth (Evaluation only)
    const hiddenGroundTruth = {
      scenarioId: `${scenarioType.toLowerCase()}_${index + 1}`,
      scenarioType,
      isLegitimate,
      isFraud,
      outlierType,
      expectedReconStatus,
      expectedRiskClassification,
      expectedSafeToRecover,
      expectedOptimalAction,
      expectedRecoverableCents,
      expectedSettlementOutcome,
      expectedCustomerResponse,
      fraudRingId: customer.fraudRingId,
    };

    return {
      id: caseId,
      publicData,
      hiddenGroundTruth,
    };
  }
}
