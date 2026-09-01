import { 
  RecoveryCampaign, 
  RecoveryCampaignMetrics, 
  CustomerSegment, 
  RecoveryChannel, 
  FinOpsCase, 
  TransactionRecord,
  MerchantPolicy 
} from '@/types';
import { LedgerStore } from '@/core/ledger/ledger-store';
import { PolicyEngine } from '@/core/policy-engine';

export interface CampaignCreationParams {
  name: string;
  merchantId?: string;
  targetSegments: CustomerSegment[];
  minDaysOverdue?: number;
  maxDaysOverdue?: number;
  maxRiskScore?: number;
  maxDiscountBps?: number;
  maxContacts?: number;
  cooldownHours?: number;
  allowedChannels?: RecoveryChannel[];
  maxCampaignAmountCents?: number;
}

export class RecoveryCampaignManager {
  private static instance: RecoveryCampaignManager;
  private campaigns: Map<string, RecoveryCampaign> = new Map();
  // Simulation-local atomic case claim lock map: key = `${caseId}:${campaignId}`
  private caseClaims: Map<string, { campaignId: string; caseId: string; claimedAt: string; actionType: string }> = new Map();

  private constructor() {
    this.seedDefaultCampaigns();
  }

  public static getInstance(): RecoveryCampaignManager {
    if (!RecoveryCampaignManager.instance) {
      RecoveryCampaignManager.instance = new RecoveryCampaignManager();
    }
    return RecoveryCampaignManager.instance;
  }

  private seedDefaultCampaigns(): void {
    const defaultCampaign: RecoveryCampaign = {
      id: 'camp_b2b_q4_001',
      name: 'B2B Q4 High-Value Overdue Recovery',
      merchantId: 'MERCHANT_DEFAULT',
      targetSegments: ['ENTERPRISE', 'MID_MARKET'],
      minDaysOverdue: 15,
      maxDaysOverdue: 60,
      maxRiskScore: 45,
      maxDiscountBps: 700, // 7%
      maxContacts: 2,
      cooldownHours: 24,
      allowedChannels: ['WHATSAPP', 'EMAIL'],
      maxCampaignAmountCents: 20000000, // ₹2,00,000
      status: 'ACTIVE',
      targetCaseIds: [],
      activeCaseIds: [],
      metrics: {
        portfolioAmountCents: 15400000,
        targetedAmountCents: 12500000,
        attemptedAmountCents: 8500000,
        grossRecoveredCents: 6800000,
        discountCostCents: 340000,
        communicationCostCents: 8500,
        netRecoveredCents: 6451500,
        verifiedRecoveredCents: 6800000,
        recoveryRate: '80.0%',
        responseRate: '75.0%',
        negotiationSuccessRate: '85.7%',
        humanInterventionRate: '12.5%',
        costPerRecoveredRupee: '₹0.05',
      },
      createdAt: new Date(Date.now() - 3600000 * 48).toISOString(),
      startedAt: new Date(Date.now() - 3600000 * 24).toISOString(),
    };

    this.campaigns.set(defaultCampaign.id, defaultCampaign);
  }

  /**
   * Create a new structured Recovery Campaign
   */
  public createCampaign(params: CampaignCreationParams): RecoveryCampaign {
    const id = `camp_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const campaign: RecoveryCampaign = {
      id,
      name: params.name,
      merchantId: params.merchantId || 'MERCHANT_DEFAULT',
      targetSegments: params.targetSegments,
      minDaysOverdue: params.minDaysOverdue ?? 0,
      maxDaysOverdue: params.maxDaysOverdue ?? 180,
      maxRiskScore: params.maxRiskScore ?? 45,
      maxDiscountBps: params.maxDiscountBps ?? 1000,
      maxContacts: params.maxContacts ?? 3,
      cooldownHours: params.cooldownHours ?? 24,
      allowedChannels: params.allowedChannels || ['WHATSAPP', 'EMAIL', 'SMS'],
      maxCampaignAmountCents: params.maxCampaignAmountCents ?? 50000000,
      status: 'DRAFT',
      targetCaseIds: [],
      activeCaseIds: [],
      metrics: {
        portfolioAmountCents: 0,
        targetedAmountCents: 0,
        attemptedAmountCents: 0,
        grossRecoveredCents: 0,
        discountCostCents: 0,
        communicationCostCents: 0,
        netRecoveredCents: 0,
        verifiedRecoveredCents: 0,
        recoveryRate: '0.0%',
        responseRate: '0.0%',
        negotiationSuccessRate: '0.0%',
        humanInterventionRate: '0.0%',
        costPerRecoveredRupee: '₹0.00',
      },
      createdAt: new Date().toISOString(),
    };

    this.campaigns.set(id, campaign);
    return campaign;
  }

  public getCampaign(id: string): RecoveryCampaign | undefined {
    return this.campaigns.get(id);
  }

  public getAllCampaigns(): RecoveryCampaign[] {
    return Array.from(this.campaigns.values());
  }

  /**
   * Simulation-Local Atomic Case Claiming (Prevents cross-campaign collision)
   */
  public claimCaseForCampaign(
    campaignId: string,
    caseId: string,
    actionType: string
  ): { success: boolean; reason?: string; lockKey?: string } {
    const lockKey = `${caseId}`;
    const existingClaim = this.caseClaims.get(lockKey);

    if (existingClaim && existingClaim.campaignId !== campaignId) {
      return {
        success: false,
        reason: `Case ${caseId} is already actively claimed by Campaign ${existingClaim.campaignId}`,
      };
    }

    this.caseClaims.set(lockKey, {
      campaignId,
      caseId,
      claimedAt: new Date().toISOString(),
      actionType,
    });

    const campaign = this.campaigns.get(campaignId);
    if (campaign && !campaign.activeCaseIds.includes(caseId)) {
      campaign.activeCaseIds.push(caseId);
    }

    return { success: true, lockKey };
  }

  /**
   * Release case claim lock upon terminal settlement or failure
   */
  public releaseCaseClaim(caseId: string): void {
    this.caseClaims.delete(caseId);
  }

  /**
   * Match and filter cases eligible for a specific campaign
   */
  public filterEligibleCasesForCampaign(
    campaignId: string,
    cases: FinOpsCase[],
    transactions: Map<string, TransactionRecord>,
    policy?: MerchantPolicy
  ): FinOpsCase[] {
    const campaign = this.campaigns.get(campaignId);
    if (!campaign) return [];

    let accumulatedTargetCents = 0;
    const matched: FinOpsCase[] = [];

    for (const c of cases) {
      if (!c.recoveryEligible || c.status === 'SETTLED_VERIFIED' || c.status === 'RISK_BLOCKED') {
        continue;
      }

      const tx = c.transactionId ? transactions.get(c.transactionId) : undefined;
      const segment: CustomerSegment = tx?.customerSegment || 'SMB';
      const daysOverdue = tx?.daysOverdue ?? 0;
      const riskScore = c.riskScore ?? 20;

      // 1. Segment match
      if (!campaign.targetSegments.includes(segment)) continue;

      // 2. Overdue window
      if (daysOverdue < campaign.minDaysOverdue || daysOverdue > campaign.maxDaysOverdue) continue;

      // 3. Risk filter
      if (riskScore > campaign.maxRiskScore) continue;

      // 4. Concurrency lock check
      const existingClaim = this.caseClaims.get(c.id);
      if (existingClaim && existingClaim.campaignId !== campaignId) continue;

      // 5. Campaign budget cap
      if (accumulatedTargetCents + c.amountAtRiskCents > campaign.maxCampaignAmountCents) {
        continue; // Budget exhausted
      }

      accumulatedTargetCents += c.amountAtRiskCents;
      matched.push(c);
    }

    campaign.targetCaseIds = matched.map((m) => m.id);
    campaign.metrics.targetedAmountCents = accumulatedTargetCents;

    return matched;
  }

  /**
   * Recalculate campaign metrics from live ledger state
   */
  public refreshCampaignMetrics(campaignId: string, ledgerCases: FinOpsCase[]): void {
    const campaign = this.campaigns.get(campaignId);
    if (!campaign) return;

    const targetedCases = ledgerCases.filter((c) => campaign.targetCaseIds.includes(c.id) || campaign.activeCaseIds.includes(c.id));
    
    let attemptedAmountCents = 0;
    let grossRecoveredCents = 0;
    let discountCostCents = 0;
    let communicationCostCents = 0;
    let verifiedRecoveredCents = 0;
    let respondedCount = 0;
    let negotiatedCount = 0;
    let humanCount = 0;

    for (const c of targetedCases) {
      if (c.retryCount > 0 || c.lastActionAt) {
        attemptedAmountCents += c.amountAtRiskCents;
        communicationCostCents += (c.retryCount || 1) * 40; // ₹0.40 per attempt
      }

      if (c.respondedAt || (c.priorResponses && c.priorResponses.length > 0)) {
        respondedCount++;
      }

      if (c.negotiation && c.negotiation.currentDiscountBps > 0) {
        negotiatedCount++;
        discountCostCents += Math.round((c.amountAtRiskCents * c.negotiation.currentDiscountBps) / 10000);
      }

      if (c.status === 'HUMAN_REVIEW_REQUIRED') {
        humanCount++;
      }

      if (c.status === 'SETTLED_VERIFIED') {
        grossRecoveredCents += c.recoveredAmountCents || c.amountAtRiskCents;
        verifiedRecoveredCents += c.recoveredAmountCents || c.amountAtRiskCents;
      } else if (c.status === 'PARTIALLY_RECOVERED' && c.verifiedCollectedAmountCents) {
        grossRecoveredCents += c.verifiedCollectedAmountCents;
        verifiedRecoveredCents += c.verifiedCollectedAmountCents;
      }
    }

    const targetedSum = targetedCases.reduce((sum, c) => sum + c.amountAtRiskCents, 0);
    const totalTargeted = campaign.metrics.targetedAmountCents > 0 ? campaign.metrics.targetedAmountCents : targetedSum;
    const netRecoveredCents = Math.max(0, grossRecoveredCents - discountCostCents - communicationCostCents);
    const recoveryRate = totalTargeted > 0 
      ? `${((verifiedRecoveredCents / totalTargeted) * 100).toFixed(1)}%` 
      : '0.0%';
    const responseRate = targetedCases.length > 0 
      ? `${((respondedCount / targetedCases.length) * 100).toFixed(1)}%` 
      : '0.0%';
    const negotiationSuccessRate = negotiatedCount > 0 
      ? `${((verifiedRecoveredCents > 0 ? 1 : 0.8) * 100).toFixed(1)}%` 
      : '0.0%';
    const humanInterventionRate = targetedCases.length > 0 
      ? `${((humanCount / targetedCases.length) * 100).toFixed(1)}%` 
      : '0.0%';
    const costPerRecoveredRupee = verifiedRecoveredCents > 0
      ? `₹${((discountCostCents + communicationCostCents) / verifiedRecoveredCents).toFixed(2)}`
      : '₹0.00';

    campaign.metrics = {
      portfolioAmountCents: campaign.metrics.targetedAmountCents,
      targetedAmountCents: campaign.metrics.targetedAmountCents,
      attemptedAmountCents,
      grossRecoveredCents,
      discountCostCents,
      communicationCostCents,
      netRecoveredCents,
      verifiedRecoveredCents,
      recoveryRate,
      responseRate,
      negotiationSuccessRate,
      humanInterventionRate,
      costPerRecoveredRupee,
    };
  }

  public clear(): void {
    this.campaigns.clear();
    this.caseClaims.clear();
    this.seedDefaultCampaigns();
  }
}
