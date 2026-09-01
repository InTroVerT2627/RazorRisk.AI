export type ReconStatus =
  | 'EXACT_MATCH'
  | 'FUZZY_MATCH_HIGH'
  | 'FUZZY_MATCH_LOW'
  | 'AMOUNT_MISMATCH'
  | 'FEE_MISMATCH'
  | 'TIMING_DELAY'
  | 'UNMATCHED_TRANSACTION'
  | 'UNMATCHED_SETTLEMENT'
  | 'MISSING_SETTLEMENT'
  | 'DUPLICATE_SUSPECTED'
  | 'CHARGEBACK_SUSPECTED'
  | 'MULTI_TRANSACTION_BATCH'
  | 'SPLIT_SETTLEMENT'
  | 'CORRUPTED_RECORD'
  | 'AMBIGUOUS_MULTI_CANDIDATE';

export type RiskClassification =
  | 'OPS_SHAPED'
  | 'RISK_SHAPED'
  | 'BENIGN_DELAY'
  | 'CRITICAL_FRAUD'
  | 'BORDERLINE_REVIEW';

export type CaseStatus =
  | 'NEW'
  | 'RECONCILING'
  | 'RECONCILED'
  | 'EXCEPTION_DETECTED'
  | 'RISK_TRIAGING'
  | 'OPS_APPROVED'
  | 'RECOVERY_ELIGIBLE'
  | 'RISK_BLOCKED'
  | 'HUMAN_REVIEW_REQUIRED'
  | 'RECOVERING'
  | 'RECOVERY_EXECUTED'
  | 'VERIFYING'
  | 'PARTIALLY_RECOVERED'
  | 'SETTLED_VERIFIED'
  | 'CLOSED_UNRESOLVED'
  | 'CLOSED_WRITTEN_OFF';

export type RecoveryEligibilityStatus =
  | 'NOT_APPLICABLE'
  | 'PENDING_RISK'
  | 'ELIGIBLE'
  | 'BLOCKED'
  | 'HUMAN_REVIEW'
  | 'EXHAUSTED'
  | 'VERIFIED';

export type RecoveryQueueStatus =
  | 'READY_FOR_RECOVERY'
  | 'ACTIVE'
  | 'WAITING_FOR_CUSTOMER'
  | 'NEGOTIATING'
  | 'PAYMENT_PENDING'
  | 'VERIFICATION_PENDING'
  | 'PARTIALLY_RECOVERED'
  | 'VERIFIED'
  | 'FAILED'
  | 'ESCALATED'
  | 'STOPPED';

export type RecoveryPriority = 'P0' | 'P1' | 'P2' | 'P3';

export type CustomerSegment = 'ENTERPRISE' | 'MID_MARKET' | 'SMB' | 'CONSUMER';

export type CustomerBehaviorSegment =
  | 'STABLE_HIGH_VALUE'
  | 'RESPONSIVE'
  | 'UNRESPONSIVE'
  | 'PRICE_SENSITIVE'
  | 'LONG_TERM'
  | 'NEW_CUSTOMER'
  | 'HIGH_RISK';

export type SpecialistAgentType =
  | 'RECOVERY_SUPERVISOR'
  | 'COLLECTIONS_AGENT'
  | 'PAYMENT_AGENT'
  | 'INVOICE_AGENT'
  | 'NEGOTIATION_AGENT'
  | 'SUBSCRIPTION_RECOVERY_AGENT'
  | 'MANDATE_RECOVERY_AGENT'
  | 'VOICE_RECOVERY_AGENT';

export type RecoveryPlaybookType =
  | 'FAILED_PAYMENT_PLAYBOOK'
  | 'CHECKOUT_RECOVERY_PLAYBOOK'
  | 'B2B_OVERDUE_PLAYBOOK'
  | 'SUBSCRIPTION_DUNNING_PLAYBOOK'
  | 'MANDATE_FAILURE_PLAYBOOK'
  | 'NEGOTIATION_PLAYBOOK'
  | 'PROMISE_TO_PAY_PLAYBOOK';

export interface ChannelPerformanceStats {
  channel: RecoveryChannel;
  messagesSent: number;
  messagesDelivered: number;
  responses: number;
  paymentsAfterContact: number;
  deliveryRate: number; // 0.0 - 1.0
  responseRate: number; // 0.0 - 1.0
  conversionRate: number; // 0.0 - 1.0
}

export interface PromiseToPayRecord {
  id: string;
  caseId: string;
  promisedAmountCents: number;
  promisedDate: string;
  status: 'PENDING' | 'HONORED' | 'BROKEN';
  createdAt: string;
  evaluatedAt?: string;
}

export interface PartialCollectionRecord {
  id: string;
  caseId: string;
  originalRecoverableCents: number;
  verifiedCollectedCents: number;
  remainingAmountCents: number;
  utrRrn?: string;
  collectedAt: string;
}

export interface RecoveryTrace {
  opportunity: string;
  context: string;
  agentDecision: string;
  policyResult: string;
  expectedOutcome: string;
  nextCondition: string;
}

export interface RecoveryOpportunityScore {
  caseId: string;
  expectedNetRecoveryCents: number;
  recoverableAmountCents: number;
  recoveryProbability: number;
  expectedDiscountCostCents: number;
  expectedCommunicationCostCents: number;
  confidenceScore: number;
}

export interface RecoveryCampaignMetrics {
  portfolioAmountCents: number;
  targetedAmountCents: number;
  attemptedAmountCents: number;
  grossRecoveredCents: number;
  discountCostCents: number;
  communicationCostCents: number;
  netRecoveredCents: number;
  verifiedRecoveredCents: number;
  recoveryRate: string;
  responseRate: string;
  negotiationSuccessRate: string;
  humanInterventionRate: string;
  costPerRecoveredRupee: string;
}

export interface RecoveryCampaign {
  id: string;
  name: string;
  merchantId: string;
  targetSegments: CustomerSegment[];
  minDaysOverdue: number;
  maxDaysOverdue: number;
  maxRiskScore: number;
  maxDiscountBps: number;
  maxContacts: number;
  cooldownHours: number;
  allowedChannels: RecoveryChannel[];
  maxCampaignAmountCents: number;
  status: 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'CANCELLED';
  targetCaseIds: string[];
  activeCaseIds: string[];
  metrics: RecoveryCampaignMetrics;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
}

export interface RecoveryCase {
  id: string;
  caseId: string;
  caseNumber: string;
  transactionId?: string;
  invoiceId?: string;
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  customerSegment: CustomerSegment;
  behaviorSegment?: CustomerBehaviorSegment;
  scenarioType?: string;
  amountAtRiskCents: number;
  recoverableAmountCents: number;
  verifiedCollectedCents?: number;
  remainingAmountCents?: number;
  riskScore: number;
  riskClassification: RiskClassification;
  eligibilityStatus: RecoveryEligibilityStatus;
  eligibilityReason: string;
  priority: RecoveryPriority;
  priorityReason: string;
  opportunityScore?: RecoveryOpportunityScore;
  strategy: RecoveryActionType;
  channel: RecoveryChannel;
  specialistAgent?: SpecialistAgentType;
  playbook?: RecoveryPlaybookType;
  campaignId?: string;
  status: RecoveryQueueStatus;
  attempts: number;
  maxAttempts: number;
  lastAction?: string;
  nextRecommendedAction: string;
  policyStatus: 'APPROVED' | 'PENDING_HUMAN' | 'BLOCKED';
  paymentLinkUrl?: string;
  invoiceNumber?: string;
  promiseToPay?: PromiseToPayRecord;
  partialCollection?: PartialCollectionRecord;
  recoveryTrace?: RecoveryTrace;
  deliveredAt?: string;
  readAt?: string;
  respondedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export type RecoverySourceType = 
  | 'FAILED_PAYMENT' 
  | 'ABANDONED_CHECKOUT' 
  | 'OVERDUE_INVOICE' 
  | 'SUBSCRIPTION_FAILURE' 
  | 'MANDATE_FAILURE' 
  | 'UNPAID_RECEIVABLE' 
  | 'PARTIAL_COLLECTION';

export interface RecoveryActionPlan {
  currentAction: string;
  nextAction: string;
  fallbackAction: string;
  stopCondition: string;
  nextActionAt?: string;
}

export interface RecoveryOpportunity {
  id: string;
  merchantId: string;
  caseId: string;
  caseNumber: string;
  customerId?: string;
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  customerSegment: CustomerSegment;
  behaviorSegment?: CustomerBehaviorSegment;
  invoiceId?: string;
  transactionId?: string;
  sourceType: RecoverySourceType;
  rootCauseReason?: string;
  amountAtRiskCents: number;
  recoverableAmountCents: number;
  remainingAmountCents: number;
  verifiedCollectedCents?: number;
  daysOverdue: number;
  riskScore: number;
  riskClassification: RiskClassification;
  eligibilityStatus: RecoveryEligibilityStatus;
  eligibilityReason: string;
  priority: RecoveryPriority;
  opportunityScore?: RecoveryOpportunityScore;
  recommendedStrategy: RecoveryActionType;
  currentStrategy: RecoveryActionType;
  channel: RecoveryChannel;
  recoveryState: RecoveryQueueStatus;
  attemptCount: number;
  contactCount: number;
  lastAction?: string;
  lastActionAt?: string;
  nextAction?: string;
  nextActionAt?: string;
  actionPlan: RecoveryActionPlan;
  campaignId?: string;
  assignedSpecialist: SpecialistAgentType;
  promiseToPay?: PromiseToPayRecord;
  partialCollection?: PartialCollectionRecord;
  recoveryTrace?: RecoveryTrace[];
  policyStatus: 'APPROVED' | 'PENDING_HUMAN' | 'BLOCKED';
  createdAt: string;
  updatedAt: string;
}

export interface OperatingCentersSummary {
  promisesDueTodayCount: number;
  promisesUpcomingCount: number;
  promisesHonoredCount: number;
  promisesBrokenCount: number;
  totalPartialCollectedCents: number;
  totalPartialRemainingCents: number;
  partialCasesCount: number;
  invoicesCount: number;
  invoicesOverdueCents: number;
  paymentLinksActiveCount: number;
  paymentLinksPaidCount: number;
  b2bAging: {
    bracket15_30dCents: number;
    bracket31_60dCents: number;
    bracket61_90dCents: number;
    bracket90PlusCents: number;
  };
  subscriptionFailuresCount: number;
  mandateFailuresCount: number;
  checkoutDropOffsCount: number;
  voiceSimulationsCount: number;
  activeNegotiationsCount: number;
}

export type RecoveryActionType =
  | 'RETRY_PAYMENT'
  | 'SEND_PAYMENT_LINK'
  | 'CREATE_PAYMENT_LINK'
  | 'CHECK_PAYMENT_STATUS'
  | 'SEND_NUDGE'
  | 'CHASE_RECEIVABLE'
  | 'OFFER_BOUNDED_DISCOUNT'
  | 'BOUNDED_NEGOTIATE'
  | 'REQUEST_BANK_PROOF'
  | 'ESCALATE_HUMAN'
  | 'STOP_RECOVERY'
  | 'CREATE_INVOICE'
  | 'SEND_INVOICE'
  | 'SEND_INVOICE_REMINDER'
  | 'CHECK_INVOICE_STATUS'
  | 'DISPATCH_INVOICE'
  | 'DISPATCH_REMINDER'
  | 'DISPATCH_NEGOTIATION_OFFER'
  | 'RETRY_MANDATE'
  | 'REGISTER_PROMISE_TO_PAY'
  | 'RECORD_PARTIAL_PAYMENT';

export type RecoveryChannel =
  | 'WHATSAPP'
  | 'EMAIL'
  | 'SMS'
  | 'GATEWAY'
  | 'GATEWAY_RETRY'
  | 'PORTAL'
  | 'HUMAN_CALL'
  | 'VOICE_BOT';

export type ActorType =
  | 'SYSTEM'
  | 'AGENT_FINANCE'
  | 'AGENT_RISK'
  | 'AGENT_RECOVERY'
  | 'RECOVERY_SUPERVISOR'
  | 'COLLECTIONS_AGENT'
  | 'PAYMENT_AGENT'
  | 'INVOICE_AGENT'
  | 'NEGOTIATION_AGENT'
  | 'SUBSCRIPTION_RECOVERY_AGENT'
  | 'MANDATE_RECOVERY_AGENT'
  | 'VOICE_RECOVERY_AGENT'
  | 'CUSTOMER'
  | 'HUMAN';

export type CustomerResponseType =
  | 'ACCEPT'
  | 'REJECT'
  | 'ACCEPTED'
  | 'REJECTED'
  | 'COUNTER_OFFER'
  | 'NO_RESPONSE'
  | 'REQUEST_HUMAN'
  | 'PAY_FULL'
  | 'PAY_PARTIAL'
  | 'PAID'
  | 'PARTIAL_PAYMENT'
  | 'PAYS_INSTANT'
  | 'PAYS_AFTER_NUDGE'
  | 'ACCEPTS_DISCOUNT'
  | 'PROMISE_TO_PAY'
  | 'WRONG_CONTACT'
  | 'IGNORES';

export type NegotiationState =
  | 'NEGOTIATION_ELIGIBILITY_CHECK'
  | 'NEGOTIATION_PROPOSED'
  | 'NEGOTIATION_POLICY_CHECK'
  | 'NEGOTIATION_SENT'
  | 'CUSTOMER_COUNTERED'
  | 'NEGOTIATION_REEVALUATION'
  | 'SETTLEMENT_AGREED'
  | 'NEGOTIATION_EXPIRED'
  | 'NEGOTIATION_ESCALATED';

export interface NegotiationRoundRecord {
  round: number;
  actor: 'AGENT' | 'CUSTOMER' | 'POLICY_ENGINE' | 'HUMAN';
  proposedAmountCents: number;
  discountBps: number;
  policyPassed: boolean;
  policyReason: string;
  customerResponse?: CustomerResponseType;
  counterAmountCents?: number;
  notes?: string;
  timestamp: string;
}

export interface CaseNegotiationHistory {
  caseId: string;
  originalAmountCents: number;
  currentAgreedAmountCents?: number;
  currentDiscountBps: number;
  status: NegotiationState;
  currentRound: number;
  maxRounds: number;
  rounds: NegotiationRoundRecord[];
  settlementWindowHours: number;
  expiresAt: string;
  verifiedSettlementId?: string;
}

export interface TransactionRecord {
  id: string;
  merchantId: string;
  externalRef: string; // Razorpay Order/Payment ID or UTR
  amountCents: number;
  currency: string;
  paymentMethod: string;
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  customerSegment?: 'ENTERPRISE' | 'MID_MARKET' | 'SMB' | 'CONSUMER';
  gatewayCode?: string;
  errorCode?: string;
  errorDescription?: string;
  daysOverdue?: number;
  status: 'CAPTURED' | 'FAILED' | 'REFUNDED' | 'DISPUTED' | 'SUCCESS' | 'PENDING';
  metadata?: Record<string, any>;
  createdAt: string;
}

export interface SettlementRecord {
  id: string;
  batchId: string;
  utrRrn: string; // Bank UTR or RRN
  amountCents: number;
  feeCents: number;
  taxCents: number;
  netAmountCents: number;
  currency: string;
  bankTimestamp: string;
  rawDescription: string;
  reconciledStatus?: ReconStatus;
  createdAt: string;
}

export interface FinOpsCase {
  id: string;
  caseNumber: string;
  transactionId?: string;
  settlementId?: string;
  merchantId: string;
  status: CaseStatus;
  amountAtRiskCents: number;
  recoveredAmountCents: number;
  reconStatus: ReconStatus;
  riskClassification?: RiskClassification;
  riskScore?: number; // 0 - 100
  confidenceScore?: number; // 0.0 - 1.0
  escalationReason?: string;
  retryCount: number;
  maxRetriesAllowed: number;
  lastActionAt?: string;
  scenarioType?: string;
  negotiation?: CaseNegotiationHistory;
  priorResponses?: CustomerResponseType[];
  deliveredAt?: string;
  delivered_at?: string;
  readAt?: string;
  read_at?: string;
  respondedAt?: string;
  responded_at?: string;
  invoiceNumber?: string;
  invoiceGeneratedAt?: string;
  invoicePdfPath?: string;
  reminderCount?: number;
  reminderSequenceStage?: 'NONE' | 'INVOICE_SENT' | 'REMINDER_1' | 'REMINDER_2' | 'NEGOTIATION_ELIGIBLE';
  outboundContactCount7d?: number;
  recoveryEligible?: boolean;
  recoveryEligibilityStatus?: RecoveryEligibilityStatus;
  recoveryEligibilityReason?: string;
  recoveryPriority?: RecoveryPriority;
  recoveryCase?: RecoveryCase;
  campaignId?: string;
  promiseToPay?: PromiseToPayRecord;
  partialCollection?: PartialCollectionRecord;
  recoveryTrace?: RecoveryTrace;
  verifiedCollectedAmountCents?: number;
  remainingRecoverableAmountCents?: number;
  notes?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface RiskAssessment {
  id: string;
  caseId: string;
  agentModel: string;
  classification: RiskClassification;
  riskScore: number; // 0 - 100
  signalsEvaluated: {
    customerVelocity24h: number;
    chargebackHistoryRatio: number;
    amountDeviationZScore: number;
    bankTimingAnomalyHours: number;
    deviceFingerprintRisk: 'LOW' | 'MEDIUM' | 'HIGH';
    disputeRecurrenceFlag: boolean;
    ipGeodistanceKm?: number;
    failedCardAttemptsToday?: number;
    linkedAccountsOnDevice?: number;
  };
  featuresExtracted: Record<string, any>;
  reasoningSummary: string;
  recommendedAction: 'PROCEED_TO_RECOVERY' | 'REQUIRE_HUMAN_REVIEW' | 'BLOCK_AND_BLACKLIST';
  confidence: number;
  createdAt: string;
}

export interface RecoveryActionRecord {
  id: string;
  caseId: string;
  actionType: RecoveryActionType;
  channel: RecoveryChannel;
  actionPayload: Record<string, any>;
  policyPassed: boolean;
  policyViolations: string[];
  executionStatus: 'PENDING_POLICY' | 'BLOCKED_POLICY' | 'EXECUTED' | 'FAILED_EXECUTION';
  executionResult?: {
    gatewayResponseCode?: string;
    notificationId?: string;
    paymentUrl?: string;
    discountBpsApplied?: number;
    simulatedSettlementUtr?: string;
    customerResponseSimulated?: CustomerResponseType;
    counterAmountCents?: number;
    message?: string;
  };
  discountOfferedBps?: number;
  expectedOutcome?: string;
  createdAt: string;
}

export interface AuditTrailEntry {
  id: number;
  timestamp: string;
  caseId?: string;
  actorType: ActorType;
  actorId: string;
  action: string;
  decision: string;
  policyEvaluation?: {
    passed: boolean;
    violations: string[];
    rulesEvaluated: string[];
  };
  stateBefore: Record<string, any>;
  stateAfter: Record<string, any>;
  reasoningSummary?: string;
  confidence?: number;
  prevHash: string;
  currentHash: string;
}

export interface MerchantPolicy {
  merchantId: string;
  merchantName: string;
  maxRetryAttempts: number;
  retryCooldownHours: number;
  maxDiscountBps: number; // e.g. 1000 = 10%
  minSettlementBps?: number; // e.g. 8500 = 85%
  maxNegotiationRounds?: number; // e.g. 2
  eligibleSegments?: string[]; // e.g. ['ENTERPRISE', 'MID_MARKET']
  minNegotiationInvoiceAmountCents?: number; // e.g. 1000000 = ₹10,000
  settlementWindowHours?: number; // e.g. 72h
  autoRecoveryMaxAmountCents: number; // In cents (e.g. 5000000 = ₹50,000)
  riskScoreBlockThreshold: number; // e.g. 70
  riskScoreHumanThreshold: number; // e.g. 45
  allowedChannels: RecoveryChannel[];
  maxWeeklyContacts?: number; // e.g. 3 outbound contacts per 7-day window
  minReminderIntervalHours?: number; // e.g. 24h between reminders
  maxCampaignIncentiveBudgetCents?: number; // e.g. ₹5,00,000 max incentive spend per campaign
  maxCommunicationBudgetCents?: number; // e.g. ₹50,000 max communication delivery cost
  maxTargetedAmountCents?: number; // e.g. ₹1,00,00,000 max targeted exposure
  maxConcurrentCases?: number; // e.g. 50 cases simultaneously
  isActive: boolean;
  mandatoryHumanCategories?: string[];
}

export interface GroundTruthScenario {
  id: string;
  name: string;
  scenarioType: string;
  description: string;
  expectedReconStatus: ReconStatus;
  expectedRiskClassification: RiskClassification;
  expectedSafeToRecover: boolean;
  expectedOptimalAction: RecoveryActionType;
  expectedRecoverableCents: number;
  expectedCustomerResponse?: CustomerResponseType;
  transaction: TransactionRecord;
  settlement?: SettlementRecord;
  riskSignals: Record<string, any>;
}

// ---------------------------------------------------------------------------
// Phase 2, 5 & 6 Ground Truth Isolation & Synthetic World Types
// ---------------------------------------------------------------------------

export type ScenarioFamily =
  | 'NORMAL_SETTLED'
  | 'SETTLEMENT_DELAY'
  | 'PARTIAL_SETTLEMENT'
  | 'AMOUNT_MISMATCH'
  | 'FAILED_PAYMENT_RETRYABLE'
  | 'FAILED_PAYMENT_NON_RETRYABLE'
  | 'DUPLICATE_TRANSACTION'
  | 'UNKNOWN_BANK_ENTRY'
  | 'CHARGEBACK_DISPUTE'
  | 'ABANDONED_CHECKOUT'
  | 'FAILED_RECURRING_SUBSCRIPTION'
  | 'ORGANIZED_FRAUD_BURST'
  | 'LEGITIMATE_HIGH_VALUE_OUTLIER'
  | 'LEGITIMATE_VELOCITY_SPIKE'
  | 'LOW_VALUE_FRAUD'
  | 'SLOW_FRAUD'
  | 'FRAUD_WITH_NORMAL_HISTORY'
  | 'HIGH_RISK_CUSTOMER_LEGITIMATE_TRANSACTION'
  | 'NEAR_DUPLICATE_LEGITIMATE'
  | 'DUPLICATE_WITH_DIFFERENT_AMOUNT'
  | 'MULTI_TRANSACTION_SINGLE_SETTLEMENT'
  | 'SINGLE_TRANSACTION_SPLIT_SETTLEMENT'
  | 'MISSING_SETTLEMENT'
  | 'UNKNOWN_BANK_CREDIT_LEGITIMATE'
  | 'ORGANIZED_MULTI_ACCOUNT_FRAUD'
  | 'BORDERLINE_RISK_44'
  | 'BORDERLINE_RISK_45'
  | 'BORDERLINE_RISK_69'
  | 'BORDERLINE_RISK_70'
  | 'BORDERLINE_RISK_71'
  | 'RETRY_LIMIT_EDGE'
  | 'COOLDOWN_EDGE'
  | 'DISCOUNT_BOUNDARY'
  | 'DISCOUNT_OVER_LIMIT'
  | 'RECOVERY_FALSE_SUCCESS'
  | 'RECOVERY_DELAYED_SUCCESS'
  | 'RECOVERY_PARTIAL_SUCCESS'
  | 'CUSTOMER_RESPONDS_TO_NUDGE'
  | 'CUSTOMER_IGNORES_RECOVERY'
  | 'CUSTOMER_REQUESTS_NEGOTIATION'
  | 'SHARED_DEVICE_MULTI_ACCOUNT'
  | 'SHARED_PAYMENT_INSTRUMENT'
  | 'UNKNOWN_BANK_CREDIT_FRAUD'
  | 'NORMAL_BURST'
  | 'DATA_CORRUPTION_NOISE'
  | 'CONFLICTING_SIGNALS'
  | 'MULTIPLE_CANDIDATE_RECONCILIATION'
  | 'ADVERSARIAL_BANK_NARRATION';

export type OutlierType = 'NONE' | 'LEGITIMATE_OUTLIER' | 'RISK_OUTLIER' | 'OPERATIONAL_OUTLIER';

export interface CustomerProfile {
  id: string;
  name: string;
  email: string;
  phone: string;
  historicalTransactionsCount: number;
  historicalChargebackCount: number;
  historicalDisputeRatio: number;
  accountAgeDays: number;
  isHighLtv: boolean;
  isKnownFraudster: boolean;
  fraudRingId?: string;
  primaryDeviceId: string;
  ipSubnet: string;
}

export interface MerchantRecord {
  id: string;
  name: string;
  industry: 'ECOMMERCE' | 'SAAS' | 'GAMING' | 'B2B_WHOLESALE' | 'HEALTHCARE';
  tier: 'ENTERPRISE' | 'MID_MARKET' | 'SMB';
  settlementCycleHours: number;
  mdrBps: number;
  gstBps: number;
  maxDiscountBps: number;
  maxRetriesAllowed: number;
}

export interface DeviceSessionSignal {
  deviceId: string;
  ipAddress: string;
  userAgent: string;
  geoCountry: string;
  vpnProxyDetected: boolean;
  fingerprintVelocity24h: number;
  linkedAccountCount: number;
}

export interface PublicCaseData {
  caseId: string;
  transaction: TransactionRecord;
  settlement?: SettlementRecord;
  allSettlementCandidates?: SettlementRecord[];
  customerMetadata?: Record<string, any>;
  signals: {
    customerVelocity24h: number;
    chargebackHistoryRatio: number;
    amountDeviationZScore: number;
    bankTimingAnomalyHours: number;
    deviceFingerprintRisk: 'LOW' | 'MEDIUM' | 'HIGH';
    disputeRecurrenceFlag: boolean;
    failedCardAttemptsToday?: number;
    linkedAccountsOnDevice?: number;
  };
}

export interface HiddenGroundTruth {
  scenarioId: string;
  scenarioType: ScenarioFamily;
  isFraud: boolean;
  isLegitimate: boolean;
  outlierType: OutlierType;
  expectedReconStatus: ReconStatus;
  expectedRiskClassification: RiskClassification;
  expectedOptimalAction: RecoveryActionType;
  expectedSafeToRecover: boolean;
  expectedRecoverableCents: number;
  expectedSettlementOutcome: 'SETTLES_FULL' | 'SETTLES_PARTIAL' | 'NEVER_SETTLES' | 'SETTLES_DELAYED';
  expectedCustomerResponse?: CustomerResponseType;
  fraudRingId?: string;
  generationSeed?: number;
  notes?: string;
}

export interface SyntheticFinancialCase {
  id: string;
  publicData: PublicCaseData;
  hiddenGroundTruth: HiddenGroundTruth;
}

export interface DatasetConfig {
  size: number;
  seed: number;
  merchantCount: number;
  customerCount: number;
  mode: 'STANDARD' | 'ADVERSARIAL';
  scenarioMix?: {
    normalRatio: number;
    benignAnomalyRatio: number;
    recoverableFailureRatio: number;
    riskFraudRatio: number;
  };
  trainSplitRatio?: number;
  valSplitRatio?: number;
  testSplitRatio?: number;
}

export interface NoiseConfig {
  missingFieldRate: number;
  narrationCorruptionRate: number;
  timestampJitterHours?: number;
  timingJitterRate?: number;
  duplicateRowRate?: number;
  duplicateRate?: number;
  feeNettingVarianceRate?: number;
}

export interface DatasetProfile {
  totalRecords: number;
  seed: number;
  generationTimeMs: number;
  merchantCount: number;
  customerCount: number;
  classDistribution: {
    normalSettled: { count: number; percentage: number };
    benignOperational: { count: number; percentage: number };
    recoverableFailures: { count: number; percentage: number };
    riskAndFraud: { count: number; percentage: number };
    adversarialEdges: { count: number; percentage: number };
  };
  outlierStats: {
    totalOutliers: number;
    legitimateOutliers: number;
    riskOutliers: number;
    operationalOutliers: number;
  };
  noiseStats: {
    corruptedNarrationRows: number;
    missingFieldRows: number;
    timingJitterRows: number;
  };
  fraudRingStats: {
    totalRings: number;
    totalRingMembers: number;
    largestRingSize: number;
  };
  amounts: {
    minCents: number;
    maxCents: number;
    medianCents: number;
    meanCents: number;
  };
}

export interface BaselineComparison {
  baselineRiskF1: number;
  sentinelRiskF1: number;
  riskF1Improvement: number;
  baselineFalsePositiveCostCents: number;
  sentinelFalsePositiveCostCents: number;
  falsePositiveCostSavedCents: number;
  baselineRecoveryRate: number;
  sentinelRecoveryRate: number;
  recoveryRateImprovement: number;
}

export interface TrustScorecard {
  policyBypassCount: number; // Strictly 0
  unauthorizedExecutionCount: number; // Strictly 0
  groundTruthLeakCount: number; // Strictly 0
  unverifiedRecoveriesCounted: number; // Strictly 0
  illegalStateTransitionsPrevented: number; // Dynamically computed
  tamperEvidentChainVerified: boolean;
}

export interface ScenarioBreakdownItem {
  scenarioFamily: string;
  sampleCount: number;
  riskPrevalenceRatio: number;
  recoverabilityRatio: number;
  reconAccuracy: number;
  riskPrecision: number;
  riskRecall: number;
  recoverySuccessRate: number;
  falsePositives: number;
  falseNegatives: number;
  fpCostCents: number;
  fnExposureCents: number;
}

export interface StructuredFailureRecord {
  caseId: string;
  scenario: string;
  groundTruth: string;
  agentDecision: string;
  signals: Record<string, any>;
  toolCalls: string[];
  policyOutcome: string;
  amountCents: number;
  failureCategory:
    | 'missing_context'
    | 'incorrect_tool_use'
    | 'incorrect_interpretation'
    | 'threshold_issue'
    | 'ambiguous_evidence'
    | 'reconciliation_limitation'
    | 'synthetic_data_issue'
    | 'model_failure'
    | 'policy_issue';
}

export interface Phase6EconomicMetrics {
  grossRevenueAtRiskCents: number;
  revenueTargetedCents: number;
  discountIncentiveCostCents: number;
  netRecoveredRevenueCents: number;
  verifiedRecoveredRevenueCents: number;
  customerResponseRate: number;
  negotiationSuccessRate: number;
  averageDiscountBps: number;
  averageNegotiationRounds: number;
  adaptiveRecoveryRate: number;
  fixedBaselineRecoveryRate: number;
}

export interface EvaluationMetrics {
  totalScenarios: number;
  processedCount: number;
  benchmarkMode: 'STANDARD' | 'ADVERSARIAL';
  datasetProfile?: DatasetProfile;
  datasetSplitUsed?: 'train' | 'val' | 'test' | 'all';
  
  // Risk Metrics
  riskPrecision: number;
  riskRecall: number;
  riskF1Score: number;
  riskSpecificity: number;
  falsePositiveRate: number;
  falseNegativeRate: number;
  confusionMatrix: {
    truePositives: number;
    falsePositives: number;
    trueNegatives: number;
    falseNegatives: number;
  };
  falsePositiveCount: number;
  falsePositiveCostCents: number;
  falseNegativeExposureCents: number;

  // Reconciliation Metrics
  reconMatchAccuracy: number;
  deterministicMatchRate: number;
  fuzzyMatchPrecision: number;
  fuzzyMatchRecall: number;
  falseJoinCount: number;
  falseJoinRate: number;
  ambiguousCaseAccuracy: number;
  unresolvedExceptionsCount: number;
  unresolvedRate: number;
  deterministicResolvedCount: number;
  aiResolvedCount: number;

  // Recovery Metrics
  actualRecoverableCount: number;
  totalAtRiskCents: number;
  totalRecoverableCents: number;
  totalAttemptedCents: number;
  verifiedRecoveredCents: number;
  recoveryRate: number;
  recoveryPrecision: number;
  averageAttemptsPerCase: number;
  unnecessaryRecoveryAttempts: number;
  failedRecoveryRate: number;
  escalationRate: number;

  // Phase 6 Advanced Economic Metrics
  economicMetrics?: Phase6EconomicMetrics;

  // Safety & Trust Scorecard
  trustScorecard: TrustScorecard;
  policyViolationAttemptsBlocked: number;
  policyViolationBypassCount: number; // Strict Target: 0
  falsePolicyBlocks: number;

  // AI Cost / Latency / Abstention Telemetry
  aiTelemetry: {
    avgLatencyMs: number;
    p50LatencyMs: number;
    p95LatencyMs: number;
    avgTokensPerCall: number;
    totalBenchmarkTokens: number;
    avgToolCallsPerCase: number;
    aiCallsPer1000Cases: number;
    aiCallsAvoidedByDeterministicLogic: number;
    abstentionRate: number;
    abstentionPrecision: number;
  };

  // Comparative & Granular Breakdowns
  baselineComparison?: BaselineComparison;
  scenarioBreakdowns: ScenarioBreakdownItem[];
  structuredFailures: StructuredFailureRecord[];

  scenarioResults: Array<{
    scenarioId: string;
    scenarioType: string;
    caseNumber: string;
    status: CaseStatus;
    reconCorrect: boolean;
    riskCorrect: boolean;
    policyEnforced: boolean;
    recoveryVerified: boolean;
    actualRiskClassification?: RiskClassification;
    actualRiskScore?: number;
    actualAction?: RecoveryActionType;
    actualRecoveredCents: number;
    reasoning: string;
    isOutlier?: boolean;
    outlierType?: OutlierType;
  }>;
}
