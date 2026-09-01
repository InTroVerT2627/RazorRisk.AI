import { 
  RecoveryOpportunity, 
  RecoverySourceType, 
  RecoveryActionPlan, 
  RecoveryQueueStatus, 
  RecoveryPriority, 
  SpecialistAgentType, 
  RecoveryActionType, 
  RecoveryChannel, 
  CustomerSegment,
  OperatingCentersSummary,
  FinOpsCase,
  TransactionRecord
} from '@/types';
import { RecoveryEligibilityEngine } from './eligibility-engine';
import { RecoveryPriorityEngine } from './priority-engine';

export class OpportunityStore {
  private static instance: OpportunityStore;
  private opportunities: Map<string, RecoveryOpportunity> = new Map();

  private constructor() {}

  public static getInstance(): OpportunityStore {
    if (!OpportunityStore.instance) {
      OpportunityStore.instance = new OpportunityStore();
    }
    return OpportunityStore.instance;
  }

  public clear(): void {
    this.opportunities.clear();
  }

  public addOpportunity(opp: RecoveryOpportunity): void {
    this.opportunities.set(opp.id, opp);
  }

  public getOpportunity(id: string): RecoveryOpportunity | undefined {
    return this.opportunities.get(id);
  }

  public getOpportunityByCaseId(caseId: string): RecoveryOpportunity | undefined {
    for (const opp of this.opportunities.values()) {
      if (opp.caseId === caseId) return opp;
    }
    return undefined;
  }

  public getAllOpportunities(): RecoveryOpportunity[] {
    return Array.from(this.opportunities.values());
  }

  public getOpportunitiesByState(state: RecoveryQueueStatus): RecoveryOpportunity[] {
    return Array.from(this.opportunities.values()).filter((o) => o.recoveryState === state);
  }

  public getOpportunitiesBySource(source: RecoverySourceType): RecoveryOpportunity[] {
    return Array.from(this.opportunities.values()).filter((o) => o.sourceType === source);
  }

  public updateOpportunity(id: string, updates: Partial<RecoveryOpportunity>): RecoveryOpportunity | undefined {
    const opp = this.opportunities.get(id);
    if (!opp) return undefined;

    Object.assign(opp, updates, { updatedAt: new Date().toISOString() });
    return opp;
  }

  /**
   * Root-Cause Strategy and Specialist Resolver
   */
  public static resolveRootCauseAndSpecialist(
    sourceType: RecoverySourceType,
    errorCode?: string,
    customerSegment: CustomerSegment = 'CONSUMER',
    amountCents: number = 0
  ): {
    rootCauseReason: string;
    recommendedStrategy: RecoveryActionType;
    channel: RecoveryChannel;
    assignedSpecialist: SpecialistAgentType;
    actionPlan: RecoveryActionPlan;
  } {
    let rootCauseReason = 'Unpaid receivable requiring collections follow-up';
    let recommendedStrategy: RecoveryActionType = 'SEND_PAYMENT_LINK';
    let channel: RecoveryChannel = 'WHATSAPP';
    let assignedSpecialist: SpecialistAgentType = 'COLLECTIONS_AGENT';
    let currentAction = 'Dispatch payment link with invoice reference';
    let nextAction = 'Follow up via automated reminder after 48h';
    let fallbackAction = 'Escalate to human collections operator';
    const stopCondition = 'Bank settlement verified in ledger (SETTLED_VERIFIED)';

    const code = errorCode?.toUpperCase() || '';

    if (code.includes('FRAUD') || code.includes('SUSPECTED')) {
      rootCauseReason = 'Coordinated fraud anomaly flagged by risk engine.';
      recommendedStrategy = 'STOP_RECOVERY';
      channel = 'PORTAL';
      assignedSpecialist = 'COLLECTIONS_AGENT';
      currentAction = 'Hard block automated collections per policy';
      nextAction = 'Route to Fraud Investigation & Blacklist Registry';
      fallbackAction = 'Legal recovery notice';
    } else if (sourceType === 'MANDATE_FAILURE' || code.includes('MANDATE') || code.includes('AUTOPAY_FAILED')) {
      rootCauseReason = 'UPI AutoPay or e-Mandate execution failed at NPCI switch.';
      recommendedStrategy = 'RETRY_MANDATE';
      channel = 'WHATSAPP';
      assignedSpecialist = 'MANDATE_RECOVERY_AGENT';
      currentAction = 'Schedule mandate retry during optimal bank settlement window';
      nextAction = 'Send alternate one-time UPI payment link';
      fallbackAction = 'Prompt customer to re-authenticate e-mandate';
    } else if (code.includes('504') || code.includes('GATEWAY') || code.includes('TIMEOUT')) {
      rootCauseReason = 'Transient gateway timeout (504). Network drop between gateway switch and issuing bank.';
      recommendedStrategy = 'RETRY_PAYMENT';
      channel = 'GATEWAY_RETRY';
      assignedSpecialist = 'PAYMENT_AGENT';
      currentAction = 'Smart retry via fallback payment router';
      nextAction = 'Send WhatsApp UPI collect link if retry fails';
      fallbackAction = 'Invoice dunning via email';
    } else if (code.includes('51') || code.includes('INSUFFICIENT') || code.includes('BALANCE')) {
      rootCauseReason = 'Insufficient account balance (Code 51). Customer action needed to fund account.';
      recommendedStrategy = 'SEND_PAYMENT_LINK';
      channel = 'WHATSAPP';
      assignedSpecialist = 'PAYMENT_AGENT';
      currentAction = 'Send WhatsApp UPI Payment Link with instant-pay button';
      nextAction = 'Send SMS reminder after 24h cooldown';
      fallbackAction = 'Bounded discount negotiation (for high-ticket)';
    } else if (code.includes('54') || code.includes('EXPIRED') || code.includes('CARD')) {
      rootCauseReason = 'Payment card expired or invalid CVV. Requires card instrument update.';
      recommendedStrategy = 'CREATE_PAYMENT_LINK';
      channel = 'EMAIL';
      assignedSpecialist = 'SUBSCRIPTION_RECOVERY_AGENT';
      currentAction = 'Send secure card update portal link';
      nextAction = 'WhatsApp payment link notification after 24h';
      fallbackAction = 'Temporary subscription grace period hold';
    } else if (sourceType === 'ABANDONED_CHECKOUT') {
      rootCauseReason = 'Customer abandoned checkout session with active high-intent cart items.';
      recommendedStrategy = 'SEND_NUDGE';
      channel = 'WHATSAPP';
      assignedSpecialist = 'COLLECTIONS_AGENT';
      currentAction = 'WhatsApp cart recovery reminder with 1-click checkout';
      nextAction = 'Email reminder with bounded incentive (5% discount)';
      fallbackAction = 'Voice bot simulation for high-ticket cart';
    } else if (sourceType === 'OVERDUE_INVOICE' || customerSegment === 'ENTERPRISE') {
      rootCauseReason = 'B2B enterprise invoice overdue beyond agreed commercial credit terms.';
      recommendedStrategy = amountCents >= 5000000 ? 'BOUNDED_NEGOTIATE' : 'SEND_INVOICE_REMINDER';
      channel = 'EMAIL';
      assignedSpecialist = amountCents >= 5000000 ? 'NEGOTIATION_AGENT' : 'INVOICE_AGENT';
      currentAction = 'Issue structured PDF invoice with embedded Razorpay B2B payment link';
      nextAction = 'Offer bounded early-settlement incentive (max 10% policy cap)';
      fallbackAction = 'Escalate to FinOps Lead Operator for commercial review';
    } else if (sourceType === 'SUBSCRIPTION_FAILURE') {
      rootCauseReason = 'Recurring SaaS subscription payment failure on primary card.';
      recommendedStrategy = 'RETRY_PAYMENT';
      channel = 'EMAIL';
      assignedSpecialist = 'SUBSCRIPTION_RECOVERY_AGENT';
      currentAction = 'Dunning cycle retry 1 with card-update link';
      nextAction = 'WhatsApp notification on dunning day 3';
      fallbackAction = 'Service downgrade notice before cancellation';
    }

    return {
      rootCauseReason,
      recommendedStrategy,
      channel,
      assignedSpecialist,
      actionPlan: {
        currentAction,
        nextAction,
        fallbackAction,
        stopCondition,
      },
    };
  }

  /**
   * Transforms an eligible FinOpsCase and Transaction into a first-class RecoveryOpportunity
   */
  public createFromCase(
    c: FinOpsCase, 
    tx?: TransactionRecord, 
    sourceTypeOverride?: RecoverySourceType
  ): RecoveryOpportunity {
    const segment = tx?.customerSegment || (c.amountAtRiskCents >= 5000000 ? 'ENTERPRISE' : c.amountAtRiskCents >= 1000000 ? 'MID_MARKET' : 'SMB');
    
    // Determine source type
    let sourceType: RecoverySourceType = sourceTypeOverride || 'FAILED_PAYMENT';
    if (tx?.metadata?.isAbandonedCheckout || c.notes?.some(n => n.includes('checkout drop'))) {
      sourceType = 'ABANDONED_CHECKOUT';
    } else if (tx?.daysOverdue && tx.daysOverdue > 14) {
      sourceType = 'OVERDUE_INVOICE';
    } else if (tx?.paymentMethod === 'AUTOPAY' || tx?.metadata?.isSubscription) {
      sourceType = 'SUBSCRIPTION_FAILURE';
    } else if (tx?.errorCode?.includes('MANDATE') || tx?.metadata?.isMandate) {
      sourceType = 'MANDATE_FAILURE';
    } else if (c.status === 'PARTIALLY_RECOVERED' || c.partialCollection) {
      sourceType = 'PARTIAL_COLLECTION';
    }

    const { rootCauseReason, recommendedStrategy, channel, assignedSpecialist, actionPlan } = 
      OpportunityStore.resolveRootCauseAndSpecialist(sourceType, tx?.errorCode || tx?.errorDescription, segment, c.amountAtRiskCents);

    const oppScore = RecoveryEligibilityEngine.getInstance().computeOpportunityScore(c, tx, 0.85);
    const priorityRes = RecoveryPriorityEngine.getInstance().evaluatePriority(c, tx);

    const verifiedCollected = c.partialCollection?.verifiedCollectedCents || c.verifiedCollectedAmountCents || 0;
    const remaining = c.remainingRecoverableAmountCents || (c.amountAtRiskCents - verifiedCollected);

    let recoveryState: RecoveryQueueStatus = 'READY_FOR_RECOVERY';
    if (c.status === 'SETTLED_VERIFIED') recoveryState = 'VERIFIED';
    else if (c.status === 'PARTIALLY_RECOVERED') recoveryState = 'PARTIALLY_RECOVERED';
    else if (c.status === 'VERIFYING') recoveryState = 'VERIFICATION_PENDING';
    else if (c.status === 'RECOVERY_EXECUTED') recoveryState = 'PAYMENT_PENDING';
    else if (c.status === 'RECOVERING') recoveryState = 'ACTIVE';
    else if (c.status === 'HUMAN_REVIEW_REQUIRED') recoveryState = 'ESCALATED';
    else if (c.status === 'CLOSED_UNRESOLVED' || c.status === 'CLOSED_WRITTEN_OFF') recoveryState = 'FAILED';
    else if (c.promiseToPay?.status === 'PENDING') recoveryState = 'WAITING_FOR_CUSTOMER';
    else if (c.negotiation && c.negotiation.status !== 'SETTLEMENT_AGREED') recoveryState = 'NEGOTIATING';

    const opp: RecoveryOpportunity = {
      id: `opp_${c.id}`,
      merchantId: c.merchantId || 'MERCHANT_DEFAULT',
      caseId: c.id,
      caseNumber: c.caseNumber,
      customerId: tx?.metadata?.customerId || `cust_${c.caseNumber.toLowerCase()}`,
      customerName: tx?.customerName || c.recoveryCase?.customerName || `Client ${c.caseNumber}`,
      customerEmail: tx?.customerEmail || c.recoveryCase?.customerEmail || `billing@${c.caseNumber.toLowerCase()}.com`,
      customerPhone: tx?.customerPhone || c.recoveryCase?.customerPhone || '+91 98765 43210',
      customerSegment: segment,
      behaviorSegment: c.recoveryCase?.behaviorSegment || 'RESPONSIVE',
      invoiceId: c.invoicePdfPath ? `INV-${c.caseNumber}` : undefined,
      transactionId: c.transactionId,
      sourceType,
      rootCauseReason,
      amountAtRiskCents: c.amountAtRiskCents,
      recoverableAmountCents: c.amountAtRiskCents,
      remainingAmountCents: remaining,
      verifiedCollectedCents: verifiedCollected,
      daysOverdue: tx?.daysOverdue || 7,
      riskScore: c.riskScore ?? 18,
      riskClassification: c.riskClassification || 'OPS_SHAPED',
      eligibilityStatus: c.recoveryEligibilityStatus || ((c.riskScore && c.riskScore >= 70) || c.status === 'RISK_BLOCKED' || c.riskClassification === 'CRITICAL_FRAUD' ? 'BLOCKED' : 'ELIGIBLE'),
      eligibilityReason: c.recoveryEligibilityReason || ((c.riskScore && c.riskScore >= 70) || c.status === 'RISK_BLOCKED' ? 'Risk score or fraud pattern strictly blocked by policy gate' : 'Valid recoverable balance verified with clean operational risk profile'),
      priority: c.recoveryPriority || priorityRes.priority,
      opportunityScore: oppScore,
      recommendedStrategy,
      currentStrategy: recommendedStrategy,
      channel,
      recoveryState,
      attemptCount: c.retryCount || 0,
      contactCount: c.outboundContactCount7d || 1,
      lastAction: c.recoveryCase?.lastAction || 'Opportunity detected by Recovery Supervisor',
      lastActionAt: c.updatedAt,
      nextAction: actionPlan.currentAction,
      nextActionAt: new Date(Date.now() + 86400000).toISOString(),
      actionPlan,
      campaignId: c.campaignId,
      assignedSpecialist,
      promiseToPay: c.promiseToPay,
      partialCollection: c.partialCollection,
      recoveryTrace: c.recoveryTrace ? [c.recoveryTrace] : [],
      policyStatus: c.riskScore && c.riskScore >= 70 ? 'BLOCKED' : 'APPROVED',
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    };

    this.opportunities.set(opp.id, opp);
    return opp;
  }

  /**
   * Generates summary statistics across all 10 Operating Centers
   */
  public getCentersSummary(): OperatingCentersSummary {
    const opps = this.getAllOpportunities();

    let promisesDueTodayCount = 0;
    let promisesUpcomingCount = 0;
    let promisesHonoredCount = 0;
    let promisesBrokenCount = 0;

    let totalPartialCollectedCents = 0;
    let totalPartialRemainingCents = 0;
    let partialCasesCount = 0;

    let invoicesCount = 0;
    let invoicesOverdueCents = 0;

    let paymentLinksActiveCount = 0;
    let paymentLinksPaidCount = 0;

    let bracket15_30dCents = 0;
    let bracket31_60dCents = 0;
    let bracket61_90dCents = 0;
    let bracket90PlusCents = 0;

    let subscriptionFailuresCount = 0;
    let mandateFailuresCount = 0;
    let checkoutDropOffsCount = 0;
    let voiceSimulationsCount = 0;
    let activeNegotiationsCount = 0;

    const todayStr = new Date().toISOString().split('T')[0];

    for (const o of opps) {
      // Promises
      if (o.promiseToPay) {
        if (o.promiseToPay.status === 'PENDING') {
          if (o.promiseToPay.promisedDate <= todayStr) {
            promisesDueTodayCount++;
          } else {
            promisesUpcomingCount++;
          }
        } else if (o.promiseToPay.status === 'HONORED') {
          promisesHonoredCount++;
        } else if (o.promiseToPay.status === 'BROKEN') {
          promisesBrokenCount++;
        }
      }

      // Partials
      if (o.sourceType === 'PARTIAL_COLLECTION' || o.recoveryState === 'PARTIALLY_RECOVERED' || (o.verifiedCollectedCents && o.verifiedCollectedCents > 0 && o.remainingAmountCents > 0)) {
        partialCasesCount++;
        totalPartialCollectedCents += (o.verifiedCollectedCents || 0);
        totalPartialRemainingCents += o.remainingAmountCents;
      }

      // Invoices
      if (o.sourceType === 'OVERDUE_INVOICE' || o.invoiceId) {
        invoicesCount++;
        invoicesOverdueCents += o.amountAtRiskCents;
      }

      // Payment links
      if (o.currentStrategy === 'SEND_PAYMENT_LINK' || o.currentStrategy === 'CREATE_PAYMENT_LINK') {
        if (o.recoveryState === 'VERIFIED') paymentLinksPaidCount++;
        else paymentLinksActiveCount++;
      }

      // B2B Aging
      if (o.customerSegment === 'ENTERPRISE' || o.customerSegment === 'MID_MARKET') {
        if (o.daysOverdue >= 90) bracket90PlusCents += o.amountAtRiskCents;
        else if (o.daysOverdue >= 61) bracket61_90dCents += o.amountAtRiskCents;
        else if (o.daysOverdue >= 31) bracket31_60dCents += o.amountAtRiskCents;
        else if (o.daysOverdue >= 15) bracket15_30dCents += o.amountAtRiskCents;
      }

      // Centers counts
      if (o.sourceType === 'SUBSCRIPTION_FAILURE') subscriptionFailuresCount++;
      if (o.sourceType === 'MANDATE_FAILURE') mandateFailuresCount++;
      if (o.sourceType === 'ABANDONED_CHECKOUT') checkoutDropOffsCount++;
      if (o.channel === 'VOICE_BOT' || o.assignedSpecialist === 'VOICE_RECOVERY_AGENT') voiceSimulationsCount++;
      if (o.currentStrategy === 'BOUNDED_NEGOTIATE' || o.recoveryState === 'NEGOTIATING') activeNegotiationsCount++;
    }

    return {
      promisesDueTodayCount,
      promisesUpcomingCount,
      promisesHonoredCount,
      promisesBrokenCount,
      totalPartialCollectedCents,
      totalPartialRemainingCents,
      partialCasesCount,
      invoicesCount,
      invoicesOverdueCents,
      paymentLinksActiveCount,
      paymentLinksPaidCount,
      b2bAging: {
        bracket15_30dCents,
        bracket31_60dCents,
        bracket61_90dCents,
        bracket90PlusCents,
      },
      subscriptionFailuresCount,
      mandateFailuresCount,
      checkoutDropOffsCount,
      voiceSimulationsCount,
      activeNegotiationsCount,
    };
  }

  /**
   * Seeds a rich, diverse demo portfolio of 120+ non-uniform opportunities
   */
  public seedDemoPortfolio(): void {
    if (this.opportunities.size >= 50) return;

    const merchants = ['MERCHANT_DEFAULT', 'MERCHANT_ENTERPRISE', 'MERCHANT_SaaS'];
    const segments: CustomerSegment[] = ['ENTERPRISE', 'MID_MARKET', 'SMB', 'CONSUMER'];
    const names = [
      'Acme Technologies Ltd', 'Orbit Cloud Systems', 'Nexus Financial India', 'Vertex Retail Global',
      'Quantum Data Labs', 'Apex Logistics Hub', 'InfraCore SaaS', 'Titan Media Holdings',
      'Zenith Mobility Corp', 'Starlight Hospitality', 'BluePeak Software', 'Alpha Dynamics Pvt Ltd'
    ];

    const todayStr = new Date().toISOString().split('T')[0];
    const tomorrowStr = new Date(Date.now() + 86400000).toISOString().split('T')[0];
    const nextWeekStr = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];

    const sources: RecoverySourceType[] = [
      'FAILED_PAYMENT', 'OVERDUE_INVOICE', 'ABANDONED_CHECKOUT',
      'SUBSCRIPTION_FAILURE', 'MANDATE_FAILURE', 'PARTIAL_COLLECTION'
    ];

    let seedIdx = 1;

    for (let i = 0; i < 120; i++) {
      const source = sources[i % sources.length];
      const segment = segments[i % segments.length];
      const customerName = `${names[i % names.length]} #${i + 1}`;
      const caseId = `case_demo_${seedIdx}`;
      const caseNumber = `CASE-${100000 + seedIdx}`;
      const id = `opp_demo_${seedIdx}`;
      seedIdx++;

      let amountAtRiskCents = 150000;
      let daysOverdue = (i * 3) % 95 + 1;
      let riskScore = 15 + ((i * 7) % 35);
      let riskClassification = riskScore >= 70 ? 'CRITICAL_FRAUD' : riskScore >= 45 ? 'BORDERLINE_REVIEW' : 'OPS_SHAPED';

      if (source === 'OVERDUE_INVOICE' || segment === 'ENTERPRISE') {
        amountAtRiskCents = 5000000 + (i * 250000); // ₹50,000 - ₹80,000
      } else if (source === 'PARTIAL_COLLECTION') {
        amountAtRiskCents = 4000000 + (i * 100000); // ₹40,000
      } else if (source === 'SUBSCRIPTION_FAILURE') {
        amountAtRiskCents = 99900 + ((i % 5) * 50000); // ₹999 - ₹3,499
      } else if (source === 'ABANDONED_CHECKOUT') {
        amountAtRiskCents = 180000 + ((i % 8) * 40000); // ₹1,800 - ₹5,000
      } else {
        amountAtRiskCents = 250000 + ((i % 10) * 80000);
      }

      // Root cause resolution
      const { rootCauseReason, recommendedStrategy, channel, assignedSpecialist, actionPlan } =
        OpportunityStore.resolveRootCauseAndSpecialist(source, undefined, segment, amountAtRiskCents);

      let recoveryState: RecoveryQueueStatus = 'READY_FOR_RECOVERY';
      let verifiedCollectedCents = 0;
      let remainingAmountCents = amountAtRiskCents;
      let promiseToPay: RecoveryOpportunity['promiseToPay'] | undefined;
      let partialCollection: RecoveryOpportunity['partialCollection'] | undefined;
      let invoiceId: string | undefined;

      if (source === 'OVERDUE_INVOICE') {
        invoiceId = `INV-${202600 + i}`;
      }

      // Distribute diverse operational states
      const stateMod = i % 10;
      if (stateMod === 0) {
        recoveryState = 'READY_FOR_RECOVERY';
      } else if (stateMod === 1) {
        recoveryState = 'ACTIVE';
      } else if (stateMod === 2) {
        recoveryState = 'WAITING_FOR_CUSTOMER';
      } else if (stateMod === 3) {
        recoveryState = 'NEGOTIATING';
      } else if (stateMod === 4 || source === 'PARTIAL_COLLECTION') {
        recoveryState = 'PARTIALLY_RECOVERED';
        verifiedCollectedCents = Math.round(amountAtRiskCents * 0.60);
        remainingAmountCents = amountAtRiskCents - verifiedCollectedCents;
        partialCollection = {
          id: `part_seed_${i}`,
          caseId,
          originalRecoverableCents: amountAtRiskCents,
          verifiedCollectedCents,
          remainingAmountCents,
          utrRrn: `UTR_PART_${100000 + i}`,
          collectedAt: new Date(Date.now() - 3600000 * 24).toISOString(),
        };
      } else if (stateMod === 5) {
        recoveryState = 'PAYMENT_PENDING';
      } else if (stateMod === 6) {
        recoveryState = 'VERIFICATION_PENDING';
      } else if (stateMod === 7) {
        recoveryState = 'VERIFIED';
        verifiedCollectedCents = amountAtRiskCents;
        remainingAmountCents = 0;
      } else if (stateMod === 8) {
        recoveryState = 'ESCALATED';
        riskScore = 58;
        riskClassification = 'BORDERLINE_REVIEW';
      } else {
        recoveryState = 'READY_FOR_RECOVERY';
        promiseToPay = {
          id: `p2p_seed_${i}`,
          caseId,
          promisedAmountCents: amountAtRiskCents,
          promisedDate: i % 2 === 0 ? todayStr : tomorrowStr,
          status: 'PENDING',
          createdAt: new Date().toISOString(),
        };
      }

      const priority: RecoveryPriority = amountAtRiskCents >= 5000000 ? 'P0' : amountAtRiskCents >= 2000000 ? 'P1' : amountAtRiskCents >= 500000 ? 'P2' : 'P3';

      const opp: RecoveryOpportunity = {
        id,
        merchantId: merchants[i % merchants.length],
        caseId,
        caseNumber,
        customerName,
        customerId: `cust_${1000 + i}`,
        customerEmail: `billing@${customerName.toLowerCase().replace(/[^a-z0-9]/g, '')}.com`,
        customerPhone: `+91 98${Math.floor(10000000 + Math.random() * 90000000)}`,
        customerSegment: segment,
        behaviorSegment: 'RESPONSIVE',
        sourceType: source,
        amountAtRiskCents,
        recoverableAmountCents: amountAtRiskCents,
        remainingAmountCents,
        verifiedCollectedCents,
        daysOverdue,
        riskScore,
        riskClassification: riskClassification as any,
        eligibilityStatus: riskScore >= 70 ? 'BLOCKED' : 'ELIGIBLE',
        eligibilityReason: riskScore >= 70 ? 'Risk score blocked' : 'Valid outstanding obligation',
        priority,
        recommendedStrategy,
        currentStrategy: recommendedStrategy,
        channel,
        recoveryState,
        attemptCount: recoveryState === 'READY_FOR_RECOVERY' ? 0 : 1,
        contactCount: 1,
        lastAction: `Action dispatched via ${channel}`,
        lastActionAt: new Date(Date.now() - 3600000 * 12).toISOString(),
        nextAction: actionPlan.nextAction,
        actionPlan,
        assignedSpecialist,
        policyStatus: riskScore >= 70 ? 'BLOCKED' : 'APPROVED',
        invoiceId,
        promiseToPay,
        partialCollection,
        createdAt: new Date(Date.now() - 86400000 * (i + 1)).toISOString(),
        updatedAt: new Date().toISOString(),
      };

      this.addOpportunity(opp);
    }
  }
}
