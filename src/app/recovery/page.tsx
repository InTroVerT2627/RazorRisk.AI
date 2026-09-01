'use client';

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { 
  TrendingUp, 
  ShieldAlert, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  Play, 
  Pause, 
  RotateCcw, 
  Search, 
  Filter, 
  ChevronRight, 
  Sparkles, 
  DollarSign, 
  Users, 
  Send, 
  FileText, 
  CreditCard, 
  Zap, 
  Bot, 
  PhoneCall, 
  Layers, 
  ArrowRight, 
  CheckCheck, 
  XCircle, 
  RefreshCw, 
  BarChart3, 
  HelpCircle, 
  ExternalLink,
  Calendar,
  Percent,
  Sliders,
  Receipt,
  ShoppingCart,
  PhoneForwarded,
  MessageSquare,
  ShieldCheck,
  X
} from 'lucide-react';
import { 
  FinOpsCase, 
  RecoveryOpportunity, 
  RecoveryQueueStatus, 
  RecoveryPriority, 
  RecoverySourceType, 
  SpecialistAgentType, 
  RecoveryActionType, 
  RecoveryChannel, 
  CustomerSegment,
  RecoveryCampaign,
  OperatingCentersSummary
} from '@/types';
import { 
  RRCard, 
  RRBadge, 
  RRButton, 
  RRKpiCard, 
  RRSection, 
  RRFilterBar, 
  RRPagination, 
  RREmptyState, 
  getStatusVariant, 
  getStatusLabel 
} from '@/components/ui';

type ActiveViewMode = 'PORTFOLIO' | 'PROMISES' | 'PARTIALS' | 'INVOICES' | 'PAYMENT_LINKS' | 'B2B_AGING' | 'SUBSCRIPTIONS' | 'MANDATES' | 'CHECKOUT' | 'VOICE' | 'NEGOTIATION' | 'CAMPAIGNS' | 'ECONOMICS';

export default function AutonomousRevenueRecoveryOperatingCenter() {
  const [opportunities, setOpportunities] = useState<RecoveryOpportunity[]>([]);
  const [centersSummary, setCentersSummary] = useState<OperatingCentersSummary | null>(null);
  const [campaigns, setCampaigns] = useState<RecoveryCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOpp, setSelectedOpp] = useState<RecoveryOpportunity | null>(null);
  const [activeTab, setActiveTab] = useState<RecoveryQueueStatus | 'ALL'>('ALL');
  const [priorityFilter, setPriorityFilter] = useState<RecoveryPriority | 'ALL'>('ALL');
  const [sourceFilter, setSourceFilter] = useState<RecoverySourceType | 'ALL'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeViewMode, setActiveViewMode] = useState<ActiveViewMode>('PORTFOLIO');
  const [autonomousMode, setAutonomousMode] = useState(true);
  const [simulationRunning, setSimulationRunning] = useState(false);
  const [simulationSpeed, setSimulationSpeed] = useState<'NORMAL' | 'FAST'>('NORMAL');
  const [funnelStageFilter, setFunnelStageFilter] = useState<string | null>(null);

  // Campaign Modal
  const [showCreateCampaignModal, setShowCreateCampaignModal] = useState(false);
  const [newCampaignName, setNewCampaignName] = useState('');
  const [newCampaignSegments, setNewCampaignSegments] = useState<CustomerSegment[]>(['ENTERPRISE', 'MID_MARKET']);
  const [newCampaignDiscount, setNewCampaignDiscount] = useState<number>(8);
  const [newCampaignMaxBudget, setNewCampaignMaxBudget] = useState<number>(500000);

  // Operator Action execution state
  const [actionExecuting, setActionExecuting] = useState(false);
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);
  const [liveLogs, setLiveLogs] = useState<{ id: string; time: string; text: string; type: 'info' | 'success' | 'warning' | 'error' }[]>([
    { id: 'log_01', time: '12:04:10', text: 'Recovery Supervisor: Initialized autonomous scanning loop', type: 'info' },
    { id: 'log_02', time: '12:04:12', text: 'Payment Agent: Sent WhatsApp UPI Collect to Acme Tech (₹2,40,000)', type: 'info' },
    { id: 'log_03', time: '12:04:15', text: 'Policy Engine: Approved 5% bounded discount for Orbit Labs', type: 'success' },
  ]);

  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 12;

  // Data Fetching
  const fetchRecoveryData = useCallback(async () => {
    try {
      setLoading(true);
      const [oppsRes, centersRes, campRes] = await Promise.all([
        fetch('/api/recovery/opportunities'),
        fetch('/api/recovery/centers'),
        fetch('/api/recovery/campaigns'),
      ]);

      const oppsJson = await oppsRes.json();
      const centersJson = await centersRes.json();
      const campJson = await campRes.json();

      if (oppsJson.success && Array.isArray(oppsJson.data)) {
        setOpportunities(oppsJson.data);
        if (oppsJson.data.length > 0 && !selectedOpp) {
          setSelectedOpp(oppsJson.data[0]);
        }
      }
      if (centersJson.success && centersJson.data) {
        setCentersSummary(centersJson.data);
      }
      if (campJson.success) {
        const campList = Array.isArray(campJson.data) 
          ? campJson.data 
          : Array.isArray(campJson.campaigns) 
            ? campJson.campaigns 
            : [];
        setCampaigns(campList);
      }
    } catch (e) {
      console.error('Failed to load recovery operating center data', e);
    } finally {
      setLoading(false);
    }
  }, [selectedOpp]);

  useEffect(() => {
    fetchRecoveryData();
  }, [fetchRecoveryData]);

  // Execute Action on Opportunity
  const handleExecuteAction = async (action: RecoveryActionType) => {
    if (!selectedOpp) return;
    try {
      setActionExecuting(true);
      setActionSuccessMsg(null);
      const res = await fetch(`/api/recovery/opportunities/${selectedOpp.id}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (data.success) {
        setActionSuccessMsg(`Action '${action}' executed successfully via ${selectedOpp.assignedSpecialist}.`);
        if (data.data?.opportunity) {
          setSelectedOpp(data.data.opportunity);
        }
        setLiveLogs((prev) => [
          {
            id: `log_${Date.now()}`,
            time: new Date().toLocaleTimeString(),
            text: `${selectedOpp.assignedSpecialist}: Executed ${action} on ${selectedOpp.caseNumber} (${selectedOpp.customerName})`,
            type: 'success',
          },
          ...prev.slice(0, 9),
        ]);
        await fetchRecoveryData();
      }
    } catch (e) {
      console.error('Failed to execute recovery action', e);
    } finally {
      setActionExecuting(false);
    }
  };

  // Create Campaign
  const handleCreateCampaign = async () => {
    if (!newCampaignName.trim()) return;
    try {
      const res = await fetch('/api/recovery/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newCampaignName,
          targetSegments: newCampaignSegments,
          maxDiscountBps: newCampaignDiscount * 100,
          maxCampaignAmountCents: newCampaignMaxBudget * 100,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setShowCreateCampaignModal(false);
        setNewCampaignName('');
        await fetchRecoveryData();
      }
    } catch (e) {
      console.error('Failed to create campaign', e);
    }
  };

  // Run Campaign
  const handleRunCampaign = async (campId: string) => {
    try {
      const res = await fetch(`/api/recovery/campaigns/${campId}/run`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setLiveLogs((prev) => [
          {
            id: `log_${Date.now()}`,
            time: new Date().toLocaleTimeString(),
            text: `Campaign Manager: Dispatched autonomous campaign '${data.data.campaign.name}' across ${data.data.executedCasesCount} cases`,
            type: 'info',
          },
          ...prev.slice(0, 9),
        ]);
        await fetchRecoveryData();
      }
    } catch (e) {
      console.error('Failed to run campaign', e);
    }
  };

  // Portfolio KPIs Aggregation (Single O(N) pass)
  const portfolioKPIs = useMemo(() => {
    let totalOpportunities = opportunities.length;
    let actionableValueCents = 0;
    let activeRecoveryCount = 0;
    let waitingCount = 0;
    let negotiatingCount = 0;
    let promiseToPayCount = 0;
    let partialCollectionCount = 0;
    let paymentPendingCount = 0;
    let verifyingCount = 0;
    let verifiedCount = 0;
    let verifiedValueCents = 0;
    let escalatedCount = 0;

    for (const o of opportunities) {
      actionableValueCents += o.remainingAmountCents;
      switch (o.recoveryState) {
        case 'ACTIVE': activeRecoveryCount++; break;
        case 'WAITING_FOR_CUSTOMER': waitingCount++; break;
        case 'NEGOTIATING': negotiatingCount++; break;
        case 'PARTIALLY_RECOVERED': 
          partialCollectionCount++; 
          break;
        case 'PAYMENT_PENDING': paymentPendingCount++; break;
        case 'VERIFICATION_PENDING': verifyingCount++; break;
        case 'VERIFIED': 
          verifiedCount++; 
          verifiedValueCents += (o.verifiedCollectedCents || o.amountAtRiskCents);
          break;
        case 'ESCALATED': escalatedCount++; break;
      }
      if (o.promiseToPay && o.promiseToPay.status === 'PENDING') {
        promiseToPayCount++;
      }
    }

    return {
      totalOpportunities,
      actionableValueCents,
      activeRecoveryCount,
      waitingCount,
      negotiatingCount,
      promiseToPayCount,
      partialCollectionCount,
      paymentPendingCount,
      verifyingCount,
      verifiedCount,
      verifiedValueCents,
      escalatedCount,
    };
  }, [opportunities]);

  // Funnel Stages Aggregation
  const funnelStages = useMemo(() => {
    const total = opportunities.length;
    const eligible = opportunities.filter((o) => o.eligibilityStatus === 'ELIGIBLE').length;
    const prioritized = opportunities.filter((o) => ['P0', 'P1', 'P2'].includes(o.priority)).length;
    const strategySelected = opportunities.filter((o) => o.recommendedStrategy !== 'STOP_RECOVERY').length;
    const actionSent = opportunities.filter((o) => o.attemptCount > 0 || o.recoveryState !== 'READY_FOR_RECOVERY').length;
    const responded = opportunities.filter((o) => ['WAITING_FOR_CUSTOMER', 'NEGOTIATING', 'PARTIALLY_RECOVERED', 'PAYMENT_PENDING', 'VERIFIED'].includes(o.recoveryState)).length;
    const payment = opportunities.filter((o) => ['PAYMENT_PENDING', 'VERIFICATION_PENDING', 'PARTIALLY_RECOVERED', 'VERIFIED'].includes(o.recoveryState)).length;
    const verification = opportunities.filter((o) => ['VERIFICATION_PENDING', 'VERIFIED'].includes(o.recoveryState)).length;
    const recovered = opportunities.filter((o) => o.recoveryState === 'VERIFIED').length;

    return [
      { id: 'DETECTED', name: 'Opportunity Detected', count: total, color: 'text-blue-700 bg-blue-50 border-blue-200' },
      { id: 'ELIGIBLE', name: 'Eligibility Check', count: eligible, color: 'text-indigo-700 bg-indigo-50 border-indigo-200' },
      { id: 'PRIORITIZED', name: 'Prioritized (P0-P2)', count: prioritized, color: 'text-purple-700 bg-purple-50 border-purple-200' },
      { id: 'STRATEGY', name: 'Strategy Selected', count: strategySelected, color: 'text-cyan-700 bg-cyan-50 border-cyan-200' },
      { id: 'SENT', name: 'Action Sent', count: actionSent, color: 'text-amber-700 bg-amber-50 border-amber-200' },
      { id: 'RESPONDED', name: 'Customer Response', count: responded, color: 'text-orange-700 bg-orange-50 border-orange-200' },
      { id: 'PAYMENT', name: 'Payment Initiated', count: payment, color: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
      { id: 'VERIFYING', name: 'Bank Verification', count: verification, color: 'text-teal-700 bg-teal-50 border-teal-200' },
      { id: 'RECOVERED', name: 'Settled & Verified', count: recovered, color: 'text-green-700 bg-green-50 border-green-200' },
    ];
  }, [opportunities]);

  // Filtered Opportunities
  const filteredOpportunities = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return opportunities.filter((o) => {
      // Tab filter
      if (activeTab !== 'ALL' && o.recoveryState !== activeTab) return false;
      // Priority filter
      if (priorityFilter !== 'ALL' && o.priority !== priorityFilter) return false;
      // Source filter
      if (sourceFilter !== 'ALL' && o.sourceType !== sourceFilter) return false;

      // Funnel filter
      if (funnelStageFilter) {
        if (funnelStageFilter === 'ELIGIBLE' && o.eligibilityStatus !== 'ELIGIBLE') return false;
        if (funnelStageFilter === 'PRIORITIZED' && !['P0', 'P1', 'P2'].includes(o.priority)) return false;
        if (funnelStageFilter === 'SENT' && o.attemptCount === 0 && o.recoveryState === 'READY_FOR_RECOVERY') return false;
        if (funnelStageFilter === 'PAYMENT' && !['PAYMENT_PENDING', 'VERIFICATION_PENDING', 'PARTIALLY_RECOVERED', 'VERIFIED'].includes(o.recoveryState)) return false;
        if (funnelStageFilter === 'RECOVERED' && o.recoveryState !== 'VERIFIED') return false;
      }

      if (!q) return true;

      return (
        o.caseNumber.toLowerCase().includes(q) ||
        o.customerName.toLowerCase().includes(q) ||
        o.customerSegment.toLowerCase().includes(q) ||
        o.sourceType.toLowerCase().includes(q) ||
        (o.rootCauseReason && o.rootCauseReason.toLowerCase().includes(q)) ||
        o.assignedSpecialist.toLowerCase().includes(q) ||
        (o.invoiceId && o.invoiceId.toLowerCase().includes(q))
      );
    });
  }, [opportunities, activeTab, priorityFilter, sourceFilter, funnelStageFilter, searchQuery]);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(filteredOpportunities.length / pageSize)), [filteredOpportunities.length, pageSize]);
  const paginatedOpportunities = useMemo(() => filteredOpportunities.slice((currentPage - 1) * pageSize, currentPage * pageSize), [filteredOpportunities, currentPage, pageSize]);

  const getPriorityBadgeClass = (priority: RecoveryPriority) => {
    switch (priority) {
      case 'P0': return 'bg-red-50 text-red-700 border-red-200 font-bold';
      case 'P1': return 'bg-amber-50 text-amber-700 border-amber-200 font-semibold';
      case 'P2': return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'P3':
      default: return 'bg-slate-50 text-slate-600 border-slate-200';
    }
  };

  const getSourceTypeBadge = (source: RecoverySourceType) => {
    switch (source) {
      case 'OVERDUE_INVOICE': return <RRBadge variant="info">INVOICE</RRBadge>;
      case 'ABANDONED_CHECKOUT': return <RRBadge variant="warning">CHECKOUT</RRBadge>;
      case 'SUBSCRIPTION_FAILURE': return <RRBadge variant="neutral">SUBSCRIPTION</RRBadge>;
      case 'MANDATE_FAILURE': return <RRBadge variant="info">MANDATE</RRBadge>;
      case 'PARTIAL_COLLECTION': return <RRBadge variant="success">PARTIAL</RRBadge>;
      case 'FAILED_PAYMENT':
      default: return <RRBadge variant="critical">PAYMENT DROP</RRBadge>;
    }
  };

  return (
    <div className="page-enter p-8 space-y-8 max-w-7xl mx-auto w-full">
      {/* Top Banner & Autonomous Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-[var(--rr-border)]">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-[var(--rr-primary)]">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-[var(--rr-text)] tracking-tight">
                Autonomous Revenue Recovery & Collections Center
              </h1>
              <p className="text-xs text-[var(--rr-text-secondary)]">
                Autonomous portfolio orchestration, multi-specialist dunning, bounded negotiation, and verified bank settlement
              </p>
            </div>
          </div>
        </div>

        {/* Operating Controls */}
        <div className="flex items-center gap-3 self-start lg:self-center">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--rr-surface-subtle)] border border-[var(--rr-border)] text-xs">
            <span className="text-[var(--rr-text-secondary)] font-medium">Provider:</span>
            <span className="font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
              SIMULATION ENGINE
            </span>
          </div>

          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--rr-surface)] border border-[var(--rr-border)] text-xs">
            <span className="text-[var(--rr-text-secondary)] font-medium">Autonomous Mode:</span>
            <button
              onClick={() => setAutonomousMode(!autonomousMode)}
              className={`font-semibold px-2.5 py-0.5 rounded text-xs transition-colors ${
                autonomousMode
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-200 text-slate-700'
              }`}
            >
              {autonomousMode ? 'ACTIVE (ON)' : 'MANUAL (OFF)'}
            </button>
          </div>

          <RRButton 
            variant="primary" 
            size="sm" 
            icon={<Sparkles className="w-3.5 h-3.5" />}
            onClick={() => setShowCreateCampaignModal(true)}
          >
            Create Campaign
          </RRButton>
        </div>
      </div>

      {/* 11-KPI Portfolio Manager Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-11 gap-2.5">
        <div className="p-3 bg-[var(--rr-surface)] border border-[var(--rr-border)] rounded-[var(--rr-radius)] flex flex-col">
          <span className="text-[10px] uppercase font-semibold text-[var(--rr-text-muted)]">Total Opps</span>
          <span className="text-lg font-bold text-[var(--rr-text)] mt-1">{portfolioKPIs.totalOpportunities}</span>
          <span className="text-[9px] text-[var(--rr-text-muted)] mt-0.5 font-mono">In Queue</span>
        </div>

        <div className="p-3 bg-blue-50/40 border border-blue-200 rounded-[var(--rr-radius)] flex flex-col">
          <span className="text-[10px] uppercase font-semibold text-blue-700">Actionable Value</span>
          <span className="text-lg font-bold text-blue-900 mt-1">₹{(portfolioKPIs.actionableValueCents / 100000).toFixed(1)}L</span>
          <span className="text-[9px] text-blue-600 mt-0.5 font-mono">Recoverable</span>
        </div>

        <div className="p-3 bg-indigo-50/40 border border-indigo-200 rounded-[var(--rr-radius)] flex flex-col">
          <span className="text-[10px] uppercase font-semibold text-indigo-700">Active Recovery</span>
          <span className="text-lg font-bold text-indigo-900 mt-1">{portfolioKPIs.activeRecoveryCount}</span>
          <span className="text-[9px] text-indigo-600 mt-0.5 font-mono">In Progress</span>
        </div>

        <div className="p-3 bg-amber-50/40 border border-amber-200 rounded-[var(--rr-radius)] flex flex-col">
          <span className="text-[10px] uppercase font-semibold text-amber-700">Waiting Cust</span>
          <span className="text-lg font-bold text-amber-900 mt-1">{portfolioKPIs.waitingCount}</span>
          <span className="text-[9px] text-amber-600 mt-0.5 font-mono">Link Delivered</span>
        </div>

        <div className="p-3 bg-purple-50/40 border border-purple-200 rounded-[var(--rr-radius)] flex flex-col">
          <span className="text-[10px] uppercase font-semibold text-purple-700">Negotiating</span>
          <span className="text-lg font-bold text-purple-900 mt-1">{portfolioKPIs.negotiatingCount}</span>
          <span className="text-[9px] text-purple-600 mt-0.5 font-mono">B2B Offers</span>
        </div>

        <div className="p-3 bg-cyan-50/40 border border-cyan-200 rounded-[var(--rr-radius)] flex flex-col">
          <span className="text-[10px] uppercase font-semibold text-cyan-700">Promise to Pay</span>
          <span className="text-lg font-bold text-cyan-900 mt-1">{portfolioKPIs.promiseToPayCount}</span>
          <span className="text-[9px] text-cyan-600 mt-0.5 font-mono">Grace Active</span>
        </div>

        <div className="p-3 bg-emerald-50/40 border border-emerald-200 rounded-[var(--rr-radius)] flex flex-col">
          <span className="text-[10px] uppercase font-semibold text-emerald-700">Partial Coll</span>
          <span className="text-lg font-bold text-emerald-900 mt-1">{portfolioKPIs.partialCollectionCount}</span>
          <span className="text-[9px] text-emerald-600 mt-0.5 font-mono">Residual In Queue</span>
        </div>

        <div className="p-3 bg-teal-50/40 border border-teal-200 rounded-[var(--rr-radius)] flex flex-col">
          <span className="text-[10px] uppercase font-semibold text-teal-700">Payment Pend</span>
          <span className="text-lg font-bold text-teal-900 mt-1">{portfolioKPIs.paymentPendingCount}</span>
          <span className="text-[9px] text-teal-600 mt-0.5 font-mono">Gateway Ping</span>
        </div>

        <div className="p-3 bg-yellow-50/40 border border-yellow-200 rounded-[var(--rr-radius)] flex flex-col">
          <span className="text-[10px] uppercase font-semibold text-yellow-700">Verifying</span>
          <span className="text-lg font-bold text-yellow-900 mt-1">{portfolioKPIs.verifyingCount}</span>
          <span className="text-[9px] text-yellow-600 mt-0.5 font-mono">Bank Recon</span>
        </div>

        <div className="p-3 bg-green-50/60 border border-green-300 rounded-[var(--rr-radius)] flex flex-col">
          <span className="text-[10px] uppercase font-bold text-green-800">Verified Cash</span>
          <span className="text-lg font-bold text-green-900 mt-1">₹{(portfolioKPIs.verifiedValueCents / 100000).toFixed(1)}L</span>
          <span className="text-[9px] text-green-700 mt-0.5 font-mono font-semibold">{portfolioKPIs.verifiedCount} Settled</span>
        </div>

        <div className="p-3 bg-red-50/40 border border-red-200 rounded-[var(--rr-radius)] flex flex-col">
          <span className="text-[10px] uppercase font-semibold text-red-700">Escalated</span>
          <span className="text-lg font-bold text-red-900 mt-1">{portfolioKPIs.escalatedCount}</span>
          <span className="text-[9px] text-red-600 mt-0.5 font-mono">Human Review</span>
        </div>
      </div>

      {/* Interactive 9-Stage Operational Funnel */}
      <RRCard padding="sm">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--rr-text-secondary)]">
            Autonomous Recovery Funnel (Click any stage to filter portfolio)
          </span>
          {funnelStageFilter && (
            <button
              onClick={() => setFunnelStageFilter(null)}
              className="text-[11px] text-[var(--rr-primary)] hover:underline flex items-center gap-1"
            >
              <RotateCcw className="w-3 h-3" /> Clear Funnel Filter
            </button>
          )}
        </div>

        <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-9 gap-2">
          {funnelStages.map((stage, idx) => {
            const isSelected = funnelStageFilter === stage.id;
            return (
              <button
                key={stage.id}
                onClick={() => setFunnelStageFilter(isSelected ? null : stage.id)}
                className={`p-2.5 rounded-lg border text-left transition-all relative ${
                  stage.color
                } ${isSelected ? 'ring-2 ring-[var(--rr-primary)] shadow-sm' : 'hover:opacity-90'}`}
              >
                <div className="text-[9px] font-mono font-bold opacity-75">0{idx + 1}</div>
                <div className="text-[11px] font-bold truncate mt-0.5">{stage.name}</div>
                <div className="text-base font-extrabold mt-1">{stage.count}</div>
              </button>
            );
          })}
        </div>
      </RRCard>

      {/* Operating Centers View Selector */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-[var(--rr-border)] text-xs font-semibold">
        <button
          onClick={() => setActiveViewMode('PORTFOLIO')}
          className={`px-3 py-2 rounded-t-lg border-b-2 transition-colors flex items-center gap-1.5 ${
            activeViewMode === 'PORTFOLIO'
              ? 'border-[var(--rr-primary)] text-[var(--rr-primary)] bg-blue-50/50'
              : 'border-transparent text-[var(--rr-text-secondary)] hover:text-[var(--rr-text)]'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          Recovery Queue ({opportunities.length})
        </button>

        <button
          onClick={() => setActiveViewMode('PROMISES')}
          className={`px-3 py-2 rounded-t-lg border-b-2 transition-colors flex items-center gap-1.5 ${
            activeViewMode === 'PROMISES'
              ? 'border-[var(--rr-primary)] text-[var(--rr-primary)] bg-blue-50/50'
              : 'border-transparent text-[var(--rr-text-secondary)] hover:text-[var(--rr-text)]'
          }`}
        >
          <Calendar className="w-3.5 h-3.5" />
          Promise-to-Pay Center ({centersSummary?.promisesUpcomingCount || 0})
        </button>

        <button
          onClick={() => setActiveViewMode('PARTIALS')}
          className={`px-3 py-2 rounded-t-lg border-b-2 transition-colors flex items-center gap-1.5 ${
            activeViewMode === 'PARTIALS'
              ? 'border-[var(--rr-primary)] text-[var(--rr-primary)] bg-blue-50/50'
              : 'border-transparent text-[var(--rr-text-secondary)] hover:text-[var(--rr-text)]'
          }`}
        >
          <Percent className="w-3.5 h-3.5" />
          Partial Collections ({centersSummary?.partialCasesCount || 0})
        </button>

        <button
          onClick={() => setActiveViewMode('INVOICES')}
          className={`px-3 py-2 rounded-t-lg border-b-2 transition-colors flex items-center gap-1.5 ${
            activeViewMode === 'INVOICES'
              ? 'border-[var(--rr-primary)] text-[var(--rr-primary)] bg-blue-50/50'
              : 'border-transparent text-[var(--rr-text-secondary)] hover:text-[var(--rr-text)]'
          }`}
        >
          <Receipt className="w-3.5 h-3.5" />
          Invoice Operations ({centersSummary?.invoicesCount || 0})
        </button>

        <button
          onClick={() => setActiveViewMode('PAYMENT_LINKS')}
          className={`px-3 py-2 rounded-t-lg border-b-2 transition-colors flex items-center gap-1.5 ${
            activeViewMode === 'PAYMENT_LINKS'
              ? 'border-[var(--rr-primary)] text-[var(--rr-primary)] bg-blue-50/50'
              : 'border-transparent text-[var(--rr-text-secondary)] hover:text-[var(--rr-text)]'
          }`}
        >
          <CreditCard className="w-3.5 h-3.5" />
          Payment Links ({centersSummary?.paymentLinksActiveCount || 0})
        </button>

        <button
          onClick={() => setActiveViewMode('B2B_AGING')}
          className={`px-3 py-2 rounded-t-lg border-b-2 transition-colors flex items-center gap-1.5 ${
            activeViewMode === 'B2B_AGING'
              ? 'border-[var(--rr-primary)] text-[var(--rr-primary)] bg-blue-50/50'
              : 'border-transparent text-[var(--rr-text-secondary)] hover:text-[var(--rr-text)]'
          }`}
        >
          <BarChart3 className="w-3.5 h-3.5" />
          B2B Aging Center
        </button>

        <button
          onClick={() => setActiveViewMode('SUBSCRIPTIONS')}
          className={`px-3 py-2 rounded-t-lg border-b-2 transition-colors flex items-center gap-1.5 ${
            activeViewMode === 'SUBSCRIPTIONS'
              ? 'border-[var(--rr-primary)] text-[var(--rr-primary)] bg-blue-50/50'
              : 'border-transparent text-[var(--rr-text-secondary)] hover:text-[var(--rr-text)]'
          }`}
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Subscriptions ({centersSummary?.subscriptionFailuresCount || 0})
        </button>

        <button
          onClick={() => setActiveViewMode('MANDATES')}
          className={`px-3 py-2 rounded-t-lg border-b-2 transition-colors flex items-center gap-1.5 ${
            activeViewMode === 'MANDATES'
              ? 'border-[var(--rr-primary)] text-[var(--rr-primary)] bg-blue-50/50'
              : 'border-transparent text-[var(--rr-text-secondary)] hover:text-[var(--rr-text)]'
          }`}
        >
          <Zap className="w-3.5 h-3.5" />
          Mandates ({centersSummary?.mandateFailuresCount || 0})
        </button>

        <button
          onClick={() => setActiveViewMode('CHECKOUT')}
          className={`px-3 py-2 rounded-t-lg border-b-2 transition-colors flex items-center gap-1.5 ${
            activeViewMode === 'CHECKOUT'
              ? 'border-[var(--rr-primary)] text-[var(--rr-primary)] bg-blue-50/50'
              : 'border-transparent text-[var(--rr-text-secondary)] hover:text-[var(--rr-text)]'
          }`}
        >
          <ShoppingCart className="w-3.5 h-3.5" />
          Checkout Recovery ({centersSummary?.checkoutDropOffsCount || 0})
        </button>

        <button
          onClick={() => setActiveViewMode('VOICE')}
          className={`px-3 py-2 rounded-t-lg border-b-2 transition-colors flex items-center gap-1.5 ${
            activeViewMode === 'VOICE'
              ? 'border-[var(--rr-primary)] text-[var(--rr-primary)] bg-blue-50/50'
              : 'border-transparent text-[var(--rr-text-secondary)] hover:text-[var(--rr-text)]'
          }`}
        >
          <PhoneForwarded className="w-3.5 h-3.5" />
          Voice Simulator ({centersSummary?.voiceSimulationsCount || 0})
        </button>

        <button
          onClick={() => setActiveViewMode('NEGOTIATION')}
          className={`px-3 py-2 rounded-t-lg border-b-2 transition-colors flex items-center gap-1.5 ${
            activeViewMode === 'NEGOTIATION'
              ? 'border-[var(--rr-primary)] text-[var(--rr-primary)] bg-blue-50/50'
              : 'border-transparent text-[var(--rr-text-secondary)] hover:text-[var(--rr-text)]'
          }`}
        >
          <MessageSquare className="w-3.5 h-3.5" />
          Negotiation Center ({centersSummary?.activeNegotiationsCount || 0})
        </button>

        <button
          onClick={() => setActiveViewMode('CAMPAIGNS')}
          className={`px-3 py-2 rounded-t-lg border-b-2 transition-colors flex items-center gap-1.5 ${
            activeViewMode === 'CAMPAIGNS'
              ? 'border-[var(--rr-primary)] text-[var(--rr-primary)] bg-blue-50/50'
              : 'border-transparent text-[var(--rr-text-secondary)] hover:text-[var(--rr-text)]'
          }`}
        >
          <Sliders className="w-3.5 h-3.5" />
          Campaigns ({campaigns?.length || 0})
        </button>
      </div>

      {/* Main Content Area: Master-Detail Queue View vs Dedicated Center Panels */}
      {activeViewMode === 'PORTFOLIO' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left / Main Table Column */}
          <div className="lg:col-span-8 space-y-4">
            {/* Filter Bar & Tabs */}
            <div className="flex flex-wrap items-center gap-2 pb-1 border-b border-[var(--rr-border)] text-xs">
              {(['ALL', 'READY_FOR_RECOVERY', 'ACTIVE', 'WAITING_FOR_CUSTOMER', 'NEGOTIATING', 'PARTIALLY_RECOVERED', 'PAYMENT_PENDING', 'VERIFICATION_PENDING', 'VERIFIED', 'ESCALATED', 'FAILED'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => { setActiveTab(tab); setCurrentPage(1); }}
                  className={`px-2.5 py-1 rounded-md transition-colors ${
                    activeTab === tab
                      ? 'bg-[var(--rr-primary)] text-white font-semibold'
                      : 'text-[var(--rr-text-secondary)] hover:bg-[var(--rr-surface-subtle)]'
                  }`}
                >
                  {tab.replace(/_/g, ' ')}
                </button>
              ))}
            </div>

            <RRFilterBar
              searchValue={searchQuery}
              onSearchChange={(val) => { setSearchQuery(val); setCurrentPage(1); }}
              searchPlaceholder="Search by case #, customer, segment, or failure code..."
              activeFilter={priorityFilter}
              onFilterChange={(val) => { setPriorityFilter(val as any); setCurrentPage(1); }}
              filters={[
                { value: 'ALL', label: 'All Priorities' },
                { value: 'P0', label: 'P0 - Critical Priority' },
                { value: 'P1', label: 'P1 - High Priority' },
                { value: 'P2', label: 'P2 - Medium Priority' },
                { value: 'P3', label: 'P3 - Low Priority' },
              ]}
            >
              <select
                value={sourceFilter}
                onChange={(e) => { setSourceFilter(e.target.value as any); setCurrentPage(1); }}
                className="bg-[var(--rr-surface)] border border-[var(--rr-border)] text-xs text-[var(--rr-text)] rounded-lg px-3 py-2 focus:outline-none focus:border-[var(--rr-primary)]"
              >
                <option value="ALL">All Sources</option>
                <option value="FAILED_PAYMENT">Failed Payment Drops</option>
                <option value="OVERDUE_INVOICE">Overdue B2B Invoices</option>
                <option value="ABANDONED_CHECKOUT">Abandoned Checkouts</option>
                <option value="SUBSCRIPTION_FAILURE">Subscription Dunning</option>
                <option value="MANDATE_FAILURE">Mandate / AutoPay</option>
                <option value="PARTIAL_COLLECTION">Partial Collections</option>
              </select>
            </RRFilterBar>

            {/* Operational Table */}
            <RRCard className="overflow-hidden" padding="none">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs bg-[var(--rr-surface)]">
                  <thead className="bg-[var(--rr-surface-subtle)] text-[var(--rr-text-secondary)] border-b border-[var(--rr-border)] uppercase tracking-wider font-semibold">
                    <tr>
                      <th className="py-3 px-3">Priority</th>
                      <th className="py-3 px-3">Case</th>
                      <th className="py-3 px-3">Customer</th>
                      <th className="py-3 px-3">Source</th>
                      <th className="py-3 px-3 text-right">At Risk</th>
                      <th className="py-3 px-3 text-right">Remaining</th>
                      <th className="py-3 px-3 text-center">Risk</th>
                      <th className="py-3 px-3">Specialist</th>
                      <th className="py-3 px-3">State</th>
                      <th className="py-3 px-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--rr-border)] font-mono">
                    {loading ? (
                      <tr>
                        <td colSpan={10} className="py-12">
                          <RREmptyState icon={<RefreshCw className="animate-spin w-8 h-8 text-[var(--rr-primary)]" />} title="Loading recovery portfolio..." description="" />
                        </td>
                      </tr>
                    ) : paginatedOpportunities.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="py-12">
                          <RREmptyState icon={<Search className="w-8 h-8 text-[var(--rr-text-muted)]" />} title="No opportunities found" description="No recovery opportunities match the active filters." />
                        </td>
                      </tr>
                    ) : (
                      paginatedOpportunities.map((o) => {
                        const isSelected = selectedOpp?.id === o.id;
                        return (
                          <tr
                            key={o.id}
                            onClick={() => setSelectedOpp(o)}
                            className={`cursor-pointer transition-colors ${
                              isSelected ? 'bg-blue-50/70 border-l-4 border-l-[var(--rr-primary)]' : 'hover:bg-[var(--rr-surface-subtle)]'
                            }`}
                          >
                            <td className="py-3 px-3">
                              <span className={`px-2 py-0.5 rounded text-[10px] border ${getPriorityBadgeClass(o.priority)}`}>
                                {o.priority}
                              </span>
                            </td>
                            <td className="py-3 px-3 font-bold text-[var(--rr-primary)]">
                              {o.caseNumber}
                            </td>
                            <td className="py-3 px-3 font-sans">
                              <div className="font-semibold text-[var(--rr-text)] truncate max-w-[130px]">{o.customerName}</div>
                              <div className="text-[10px] text-[var(--rr-text-muted)]">{o.customerSegment}</div>
                            </td>
                            <td className="py-3 px-3 font-sans">
                              {getSourceTypeBadge(o.sourceType)}
                            </td>
                            <td className="py-3 px-3 text-right font-bold text-[var(--rr-text)]">
                              ₹{(o.amountAtRiskCents / 100).toLocaleString('en-IN')}
                            </td>
                            <td className="py-3 px-3 text-right text-emerald-700 font-bold">
                              ₹{(o.remainingAmountCents / 100).toLocaleString('en-IN')}
                            </td>
                            <td className="py-3 px-3 text-center">
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                o.riskScore >= 70 ? 'bg-red-100 text-red-800' : o.riskScore >= 45 ? 'bg-amber-100 text-amber-800' : 'bg-green-100 text-green-800'
                              }`}>
                                {o.riskScore}
                              </span>
                            </td>
                            <td className="py-3 px-3 font-sans text-[11px] text-[var(--rr-text-secondary)]">
                              {o.assignedSpecialist.replace('_AGENT', '').replace('_', ' ')}
                            </td>
                            <td className="py-3 px-3 font-sans">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                                o.recoveryState === 'VERIFIED' ? 'bg-green-100 text-green-800' :
                                o.recoveryState === 'PARTIALLY_RECOVERED' ? 'bg-emerald-100 text-emerald-800' :
                                o.recoveryState === 'NEGOTIATING' ? 'bg-purple-100 text-purple-800' :
                                o.recoveryState === 'WAITING_FOR_CUSTOMER' ? 'bg-amber-100 text-amber-800' :
                                o.recoveryState === 'ESCALATED' ? 'bg-red-100 text-red-800' : 'bg-slate-100 text-slate-800'
                              }`}>
                                {o.recoveryState.replace(/_/g, ' ')}
                              </span>
                            </td>
                            <td className="py-3 px-3 text-right font-sans">
                              <button
                                onClick={(e) => { e.stopPropagation(); setSelectedOpp(o); }}
                                className="text-[var(--rr-primary)] hover:underline font-semibold text-xs flex items-center gap-0.5 justify-end"
                              >
                                View <ChevronRight className="w-3 h-3" />
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {!loading && paginatedOpportunities.length > 0 && (
                <RRPagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  totalItems={filteredOpportunities.length}
                  pageSize={pageSize}
                  onPageChange={setCurrentPage}
                />
              )}
            </RRCard>
          </div>

          {/* Right Detail Opportunity Drawer */}
          <div className="lg:col-span-4 space-y-4">
            {selectedOpp ? (
              <RRCard padding="md" className="space-y-5 sticky top-6 border-[var(--rr-primary)]/40 shadow-md">
                {/* Header */}
                <div className="flex items-start justify-between pb-3 border-b border-[var(--rr-border)]">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded text-[10px] border ${getPriorityBadgeClass(selectedOpp.priority)}`}>
                        {selectedOpp.priority}
                      </span>
                      <h2 className="text-sm font-bold text-[var(--rr-text)]">
                        {selectedOpp.caseNumber}
                      </h2>
                    </div>
                    <p className="text-xs text-[var(--rr-text-secondary)] mt-0.5 font-medium">
                      {selectedOpp.customerName} ({selectedOpp.customerSegment})
                    </p>
                  </div>

                  <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                    selectedOpp.recoveryState === 'VERIFIED' ? 'bg-green-100 text-green-800' :
                    selectedOpp.recoveryState === 'PARTIALLY_RECOVERED' ? 'bg-emerald-100 text-emerald-800' :
                    selectedOpp.recoveryState === 'NEGOTIATING' ? 'bg-purple-100 text-purple-800' :
                    selectedOpp.recoveryState === 'WAITING_FOR_CUSTOMER' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-800'
                  }`}>
                    {selectedOpp.recoveryState.replace(/_/g, ' ')}
                  </span>
                </div>

                {actionSuccessMsg && (
                  <div className="p-2.5 rounded bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                    <span>{actionSuccessMsg}</span>
                  </div>
                )}

                {/* Root Cause & Financials */}
                <div className="space-y-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--rr-text-muted)]">
                    Opportunity Root Cause
                  </span>
                  <div className="p-2.5 rounded bg-[var(--rr-surface-subtle)] border border-[var(--rr-border)] text-xs text-[var(--rr-text)]">
                    <p className="font-semibold text-blue-900">{selectedOpp.sourceType.replace(/_/g, ' ')}</p>
                    <p className="text-[11px] text-[var(--rr-text-secondary)] mt-0.5">{selectedOpp.rootCauseReason}</p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div className="p-2 bg-[var(--rr-surface-subtle)] border border-[var(--rr-border)] rounded text-center">
                    <span className="text-[9px] uppercase font-semibold text-[var(--rr-text-muted)]">Original</span>
                    <p className="text-xs font-bold text-[var(--rr-text)] mt-0.5">₹{(selectedOpp.amountAtRiskCents / 100).toLocaleString('en-IN')}</p>
                  </div>
                  <div className="p-2 bg-emerald-50 border border-emerald-200 rounded text-center">
                    <span className="text-[9px] uppercase font-semibold text-emerald-700">Collected</span>
                    <p className="text-xs font-bold text-emerald-900 mt-0.5">₹{((selectedOpp.verifiedCollectedCents || 0) / 100).toLocaleString('en-IN')}</p>
                  </div>
                  <div className="p-2 bg-blue-50 border border-blue-200 rounded text-center">
                    <span className="text-[9px] uppercase font-semibold text-blue-700">Remaining</span>
                    <p className="text-xs font-bold text-blue-900 mt-0.5">₹{(selectedOpp.remainingAmountCents / 100).toLocaleString('en-IN')}</p>
                  </div>
                </div>

                {/* Real Action Plan */}
                <div className="space-y-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--rr-text-muted)]">
                    Autonomous Action Plan
                  </span>
                  <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-2 text-xs">
                    <div className="flex items-start gap-2">
                      <span className="px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 font-bold text-[9px]">CURRENT</span>
                      <p className="text-[11px] text-slate-800 font-medium">{selectedOpp.actionPlan?.currentAction || selectedOpp.nextAction}</p>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 font-bold text-[9px]">NEXT</span>
                      <p className="text-[11px] text-slate-700">{selectedOpp.actionPlan?.nextAction || 'Automated WhatsApp reminder after 48h'}</p>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="px-1.5 py-0.5 rounded bg-purple-100 text-purple-800 font-bold text-[9px]">FALLBACK</span>
                      <p className="text-[11px] text-slate-700">{selectedOpp.actionPlan?.fallbackAction || 'Bounded discount negotiation'}</p>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="px-1.5 py-0.5 rounded bg-green-100 text-green-800 font-bold text-[9px]">STOP</span>
                      <p className="text-[11px] text-slate-700 font-semibold">{selectedOpp.actionPlan?.stopCondition || 'Bank settlement verified'}</p>
                    </div>
                  </div>
                </div>

                {/* Specialist & Policy */}
                <div className="p-2.5 rounded bg-[var(--rr-surface-subtle)] border border-[var(--rr-border)] space-y-1.5 text-xs">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-[var(--rr-text-secondary)]">Assigned Specialist:</span>
                    <span className="font-bold text-[var(--rr-primary)]">{selectedOpp.assignedSpecialist}</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-[var(--rr-text-secondary)]">Policy Status:</span>
                    <span className="font-bold text-emerald-700">{selectedOpp.policyStatus} (Max 10% Discount, 4h Cooldown)</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-[var(--rr-text-secondary)]">Risk Score:</span>
                    <span className="font-bold text-slate-800">{selectedOpp.riskScore}/100 ({selectedOpp.riskClassification})</span>
                  </div>
                </div>

                {/* Manual Operator Actions */}
                <div className="space-y-2 pt-2 border-t border-[var(--rr-border)]">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--rr-text-muted)]">
                    Operator Decision Override
                  </span>
                  <div className="grid grid-cols-2 gap-2">
                    <RRButton 
                      size="sm" 
                      variant="primary" 
                      icon={<Zap className="w-3 h-3" />}
                      disabled={actionExecuting || selectedOpp.recoveryState === 'VERIFIED'}
                      onClick={() => handleExecuteAction('RETRY_PAYMENT')}
                    >
                      Smart Retry
                    </RRButton>
                    <RRButton 
                      size="sm" 
                      variant="secondary" 
                      icon={<Send className="w-3 h-3" />}
                      disabled={actionExecuting || selectedOpp.recoveryState === 'VERIFIED'}
                      onClick={() => handleExecuteAction('SEND_PAYMENT_LINK')}
                    >
                      Payment Link
                    </RRButton>
                    <RRButton 
                      size="sm" 
                      variant="outline" 
                      icon={<MessageSquare className="w-3 h-3" />}
                      disabled={actionExecuting || selectedOpp.recoveryState === 'VERIFIED'}
                      onClick={() => handleExecuteAction('BOUNDED_NEGOTIATE')}
                    >
                      Negotiate
                    </RRButton>
                    <RRButton 
                      size="sm" 
                      variant="outline" 
                      icon={<PhoneCall className="w-3 h-3" />}
                      disabled={actionExecuting || selectedOpp.recoveryState === 'VERIFIED'}
                      onClick={() => handleExecuteAction('VOICE_RECOVERY' as any)}
                    >
                      Voice Bot
                    </RRButton>
                  </div>
                </div>
              </RRCard>
            ) : (
              <RRCard padding="lg" className="text-center text-xs text-[var(--rr-text-muted)]">
                Select an opportunity to view details and action plans.
              </RRCard>
            )}

            {/* Live Activity Feed */}
            <RRCard padding="sm" className="space-y-2">
              <div className="flex items-center justify-between border-b border-[var(--rr-border)] pb-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--rr-text-secondary)]">
                  Live Recovery Events
                </span>
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              </div>
              <div className="space-y-2 font-mono text-[11px] max-h-48 overflow-y-auto">
                {liveLogs.map((log) => (
                  <div key={log.id} className="p-1.5 rounded bg-[var(--rr-surface-subtle)] border border-[var(--rr-border)]">
                    <span className="text-[9px] text-[var(--rr-text-muted)] mr-1.5">[{log.time}]</span>
                    <span className="text-[var(--rr-text)]">{log.text}</span>
                  </div>
                ))}
              </div>
            </RRCard>
          </div>
        </div>
      )}

      {/* Center 1: Promise-to-Pay Center */}
      {activeViewMode === 'PROMISES' && (
        <RRCard padding="md" className="space-y-6">
          <div className="flex items-center justify-between pb-3 border-b border-[var(--rr-border)]">
            <div>
              <h2 className="text-sm font-bold text-[var(--rr-text)] uppercase tracking-wider">
                Promise-to-Pay Commitment Ledger
              </h2>
              <p className="text-xs text-[var(--rr-text-secondary)]">
                Track active customer payment commitments, locked grace periods, and auto-recycle broken promises
              </p>
            </div>
            <RRButton size="sm" variant="secondary" onClick={() => setActiveViewMode('PORTFOLIO')}>
              Back to Queue
            </RRButton>
          </div>

          <div className="grid grid-cols-4 gap-4">
            <div className="p-3 rounded bg-blue-50 border border-blue-200">
              <span className="text-[10px] uppercase font-semibold text-blue-700">Due Today</span>
              <p className="text-xl font-bold text-blue-900 mt-1">{centersSummary?.promisesDueTodayCount || 0}</p>
            </div>
            <div className="p-3 rounded bg-amber-50 border border-amber-200">
              <span className="text-[10px] uppercase font-semibold text-amber-700">Upcoming (In Grace)</span>
              <p className="text-xl font-bold text-amber-900 mt-1">{centersSummary?.promisesUpcomingCount || 0}</p>
            </div>
            <div className="p-3 rounded bg-green-50 border border-green-200">
              <span className="text-[10px] uppercase font-semibold text-green-700">Honored & Settled</span>
              <p className="text-xl font-bold text-green-900 mt-1">{centersSummary?.promisesHonoredCount || 0}</p>
            </div>
            <div className="p-3 rounded bg-red-50 border border-red-200">
              <span className="text-[10px] uppercase font-semibold text-red-700">Broken (Auto-Recycled)</span>
              <p className="text-xl font-bold text-red-900 mt-1">{centersSummary?.promisesBrokenCount || 0}</p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs bg-[var(--rr-surface)]">
              <thead className="bg-[var(--rr-surface-subtle)] text-[var(--rr-text-secondary)] border-b border-[var(--rr-border)] uppercase tracking-wider font-semibold">
                <tr>
                  <th className="py-2.5 px-3">Case #</th>
                  <th className="py-2.5 px-3">Customer</th>
                  <th className="py-2.5 px-3 text-right">Promised Amount</th>
                  <th className="py-2.5 px-3">Promise Date</th>
                  <th className="py-2.5 px-3">Grace Status</th>
                  <th className="py-2.5 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--rr-border)] font-mono">
                {opportunities.filter(o => o.promiseToPay).length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-500 font-sans">No promise-to-pay commitments registered yet.</td>
                  </tr>
                ) : (
                  opportunities.filter(o => o.promiseToPay).map(o => (
                    <tr key={o.id}>
                      <td className="py-3 px-3 font-bold text-[var(--rr-primary)]">{o.caseNumber}</td>
                      <td className="py-3 px-3 font-sans font-medium">{o.customerName}</td>
                      <td className="py-3 px-3 text-right font-bold text-emerald-800">₹{((o.promiseToPay?.promisedAmountCents || o.remainingAmountCents) / 100).toLocaleString('en-IN')}</td>
                      <td className="py-3 px-3">{o.promiseToPay?.promisedDate}</td>
                      <td className="py-3 px-3 font-sans">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
                          {o.promiseToPay?.status || 'PENDING'}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right font-sans">
                        <RRButton size="sm" variant="secondary" onClick={() => { setSelectedOpp(o); setActiveViewMode('PORTFOLIO'); }}>
                          Manage
                        </RRButton>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </RRCard>
      )}

      {/* Center 2: Partial Collections Center */}
      {activeViewMode === 'PARTIALS' && (
        <RRCard padding="md" className="space-y-6">
          <div className="flex items-center justify-between pb-3 border-b border-[var(--rr-border)]">
            <div>
              <h2 className="text-sm font-bold text-[var(--rr-text)] uppercase tracking-wider">
                Partial Collection & Residual Recovery Ledger
              </h2>
              <p className="text-xs text-[var(--rr-text-secondary)]">
                Invariant accounting: Verified Collected + Remaining Balance = Original Receivable. Remaining balance remains actionable.
              </p>
            </div>
            <RRButton size="sm" variant="secondary" onClick={() => setActiveViewMode('PORTFOLIO')}>
              Back to Queue
            </RRButton>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="p-3 rounded bg-emerald-50 border border-emerald-200">
              <span className="text-[10px] uppercase font-semibold text-emerald-700">Verified Cash Collected</span>
              <p className="text-xl font-bold text-emerald-900 mt-1">₹{((centersSummary?.totalPartialCollectedCents || 0) / 100000).toFixed(2)}L</p>
            </div>
            <div className="p-3 rounded bg-blue-50 border border-blue-200">
              <span className="text-[10px] uppercase font-semibold text-blue-700">Residual Balance In Queue</span>
              <p className="text-xl font-bold text-blue-900 mt-1">₹{((centersSummary?.totalPartialRemainingCents || 0) / 100000).toFixed(2)}L</p>
            </div>
            <div className="p-3 rounded bg-purple-50 border border-purple-200">
              <span className="text-[10px] uppercase font-semibold text-purple-700">Active Partial Cases</span>
              <p className="text-xl font-bold text-purple-900 mt-1">{centersSummary?.partialCasesCount || 0}</p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs bg-[var(--rr-surface)]">
              <thead className="bg-[var(--rr-surface-subtle)] text-[var(--rr-text-secondary)] border-b border-[var(--rr-border)] uppercase tracking-wider font-semibold">
                <tr>
                  <th className="py-2.5 px-3">Case #</th>
                  <th className="py-2.5 px-3">Customer</th>
                  <th className="py-2.5 px-3 text-right">Original</th>
                  <th className="py-2.5 px-3 text-right">Collected (Bank UTR)</th>
                  <th className="py-2.5 px-3 text-right">Remaining In Queue</th>
                  <th className="py-2.5 px-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--rr-border)] font-mono">
                {opportunities.filter(o => o.sourceType === 'PARTIAL_COLLECTION' || o.recoveryState === 'PARTIALLY_RECOVERED' || (o.verifiedCollectedCents && o.verifiedCollectedCents > 0)).map(o => (
                  <tr key={o.id}>
                    <td className="py-3 px-3 font-bold text-[var(--rr-primary)]">{o.caseNumber}</td>
                    <td className="py-3 px-3 font-sans font-medium">{o.customerName}</td>
                    <td className="py-3 px-3 text-right font-bold text-slate-700">₹{(o.amountAtRiskCents / 100).toLocaleString('en-IN')}</td>
                    <td className="py-3 px-3 text-right font-bold text-emerald-700">₹{((o.verifiedCollectedCents || 0) / 100).toLocaleString('en-IN')}</td>
                    <td className="py-3 px-3 text-right font-bold text-blue-700">₹{(o.remainingAmountCents / 100).toLocaleString('en-IN')}</td>
                    <td className="py-3 px-3 font-sans">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                        PARTIALLY RECOVERED
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </RRCard>
      )}

      {/* Center 3: B2B Aging Center */}
      {activeViewMode === 'B2B_AGING' && (
        <RRCard padding="md" className="space-y-6">
          <div className="flex items-center justify-between pb-3 border-b border-[var(--rr-border)]">
            <div>
              <h2 className="text-sm font-bold text-[var(--rr-text)] uppercase tracking-wider">
                B2B Enterprise Aging & Credit Bracket Operations
              </h2>
              <p className="text-xs text-[var(--rr-text-secondary)]">
                Accounts receivable aging buckets with automated early-settlement incentive triggers
              </p>
            </div>
            <RRButton size="sm" variant="secondary" onClick={() => setActiveViewMode('PORTFOLIO')}>
              Back to Queue
            </RRButton>
          </div>

          <div className="grid grid-cols-4 gap-4">
            <div className="p-3 rounded bg-blue-50 border border-blue-200">
              <span className="text-[10px] uppercase font-semibold text-blue-700">15-30 Days Overdue</span>
              <p className="text-xl font-bold text-blue-900 mt-1">₹{((centersSummary?.b2bAging.bracket15_30dCents || 0) / 100000).toFixed(2)}L</p>
            </div>
            <div className="p-3 rounded bg-amber-50 border border-amber-200">
              <span className="text-[10px] uppercase font-semibold text-amber-700">31-60 Days Overdue</span>
              <p className="text-xl font-bold text-amber-900 mt-1">₹{((centersSummary?.b2bAging.bracket31_60dCents || 0) / 100000).toFixed(2)}L</p>
            </div>
            <div className="p-3 rounded bg-orange-50 border border-orange-200">
              <span className="text-[10px] uppercase font-semibold text-orange-700">61-90 Days Overdue</span>
              <p className="text-xl font-bold text-orange-900 mt-1">₹{((centersSummary?.b2bAging.bracket61_90dCents || 0) / 100000).toFixed(2)}L</p>
            </div>
            <div className="p-3 rounded bg-red-50 border border-red-200">
              <span className="text-[10px] uppercase font-semibold text-red-700">90+ Days (Critical)</span>
              <p className="text-xl font-bold text-red-900 mt-1">₹{((centersSummary?.b2bAging.bracket90PlusCents || 0) / 100000).toFixed(2)}L</p>
            </div>
          </div>
        </RRCard>
      )}

      {/* Center 4: Voice Simulator Center */}
      {activeViewMode === 'VOICE' && (
        <RRCard padding="md" className="space-y-6">
          <div className="flex items-center justify-between pb-3 border-b border-[var(--rr-border)]">
            <div>
              <h2 className="text-sm font-bold text-[var(--rr-text)] uppercase tracking-wider">
                Voice Bot Recovery Simulation Hub
              </h2>
              <p className="text-xs text-[var(--rr-text-secondary)]">
                Autonomous voice call simulation supporting English, Hindi, and Hinglish dialogue scripts
              </p>
            </div>
            <RRButton size="sm" variant="secondary" onClick={() => setActiveViewMode('PORTFOLIO')}>
              Back to Queue
            </RRButton>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-2">
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800">ENGLISH SCRIPT</span>
              <p className="text-xs text-slate-800 font-medium">"Hello, this is RazorRisk FinOps automated billing. We noticed your payment of ₹18,000 for Invoice 829 is overdue. Can we send an instant UPI link?"</p>
              <span className="text-[10px] text-slate-500 font-mono">Response simulated: PROMISE_TO_PAY</span>
            </div>

            <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-2">
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">HINDI SCRIPT</span>
              <p className="text-xs text-slate-800 font-medium">"Namaste, RazorRisk ki taraf se call hai. Aapka ₹18,000 ka invoice baki hai. Kya aap abhi UPI ke dwara bhugtan karna chahenge?"</p>
              <span className="text-[10px] text-slate-500 font-mono">Response simulated: ACCEPTS_PAYMENT_LINK</span>
            </div>

            <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-2">
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-800">HINGLISH SCRIPT</span>
              <p className="text-xs text-slate-800 font-medium">"Hi, RazorRisk AI collections se call hai regarding your ₹18,000 pending invoice. Hum WhatsApp par instant link bhej rahe hain."</p>
              <span className="text-[10px] text-slate-500 font-mono">Response simulated: PROMISE_REGISTERED</span>
            </div>
          </div>
        </RRCard>
      )}

      {/* Center 5: Campaigns Center */}
      {activeViewMode === 'CAMPAIGNS' && (
        <RRCard padding="md" className="space-y-6">
          <div className="flex items-center justify-between pb-3 border-b border-[var(--rr-border)]">
            <div>
              <h2 className="text-sm font-bold text-[var(--rr-text)] uppercase tracking-wider">
                Autonomous Recovery Campaigns & Concurrency Locking
              </h2>
              <p className="text-xs text-[var(--rr-text-secondary)]">
                Segmented portfolio batches executing autonomous dunning playbooks with deterministic budget caps
              </p>
            </div>
            <RRButton size="sm" variant="primary" icon={<Sparkles className="w-3.5 h-3.5" />} onClick={() => setShowCreateCampaignModal(true)}>
              New Campaign
            </RRButton>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {(campaigns || []).map((camp) => (
              <div key={camp.id} className="p-4 rounded-lg border border-[var(--rr-border)] bg-[var(--rr-surface)] space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-sm text-[var(--rr-text)]">{camp.name}</h3>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                    camp.status === 'ACTIVE' ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-700'
                  }`}>
                    {camp.status}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <span className="text-[10px] text-[var(--rr-text-muted)]">Targeted:</span>
                    <p className="font-bold text-[var(--rr-text)]">₹{(camp.metrics.targetedAmountCents / 100).toLocaleString('en-IN')}</p>
                  </div>
                  <div>
                    <span className="text-[10px] text-[var(--rr-text-muted)]">Verified Cash:</span>
                    <p className="font-bold text-green-700">₹{(camp.metrics.verifiedRecoveredCents / 100).toLocaleString('en-IN')}</p>
                  </div>
                  <div>
                    <span className="text-[10px] text-[var(--rr-text-muted)]">Recovery Rate:</span>
                    <p className="font-bold text-blue-700">{camp.metrics.recoveryRate}</p>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-[var(--rr-border)]">
                  <span className="text-[10px] font-mono text-[var(--rr-text-muted)]">Discount Cap: {camp.maxDiscountBps / 100}%</span>
                  <RRButton size="sm" variant="primary" onClick={() => handleRunCampaign(camp.id)}>
                    Run Autonomous Campaign
                  </RRButton>
                </div>
              </div>
            ))}
          </div>
        </RRCard>
      )}

      {/* Create Campaign Modal */}
      {showCreateCampaignModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-[var(--rr-surface)] rounded-xl border border-[var(--rr-border)] p-6 max-w-md w-full space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-sm text-[var(--rr-text)]">Create Recovery Campaign</h3>
              <button onClick={() => setShowCreateCampaignModal(false)}><X className="w-4 h-4 text-slate-500" /></button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Campaign Name</label>
                <input
                  type="text"
                  value={newCampaignName}
                  onChange={(e) => setNewCampaignName(e.target.value)}
                  placeholder="e.g. Q3 Enterprise Outstanding Recovery"
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-blue-600"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Maximum Discount Policy Cap (%)</label>
                <input
                  type="number"
                  max={10}
                  min={1}
                  value={newCampaignDiscount}
                  onChange={(e) => setNewCampaignDiscount(parseInt(e.target.value) || 8)}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-blue-600"
                />
                <span className="text-[10px] text-slate-500">Hard policy limit: $\le 10\%$</span>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Max Campaign Budget (₹)</label>
                <input
                  type="number"
                  value={newCampaignMaxBudget}
                  onChange={(e) => setNewCampaignMaxBudget(parseInt(e.target.value) || 500000)}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-blue-600"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t">
              <RRButton size="sm" variant="secondary" onClick={() => setShowCreateCampaignModal(false)}>Cancel</RRButton>
              <RRButton size="sm" variant="primary" onClick={handleCreateCampaign}>Create & Arm</RRButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
