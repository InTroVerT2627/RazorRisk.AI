import { TransactionRecord, SettlementRecord, ReconStatus } from '@/types';

export interface ReconMatchResult {
  status: ReconStatus;
  confidence: number;
  transactionId?: string;
  settlementId?: string;
  discrepancyAmountCents: number;
  reason: string;
  matchedFields: string[];
}

export class ReconciliationEngine {
  /**
   * Deterministic Exact Matching Engine
   * Level 1: Match by exact External Reference or UTR / RRN + exact Amount + Time window
   */
  public static reconcilePair(
    tx: TransactionRecord,
    settlement: SettlementRecord,
    toleranceCents = 0
  ): ReconMatchResult {
    const matchedFields: string[] = [];
    const amountDiff = Math.abs(tx.amountCents - settlement.amountCents);

    // Clean identifiers
    const cleanRef = tx.externalRef.trim().toLowerCase();
    const cleanUtr = settlement.utrRrn.trim().toLowerCase();
    const cleanDesc = (settlement.rawDescription || '').toLowerCase();

    // Check Reference Match
    const isExactRefMatch = cleanRef === cleanUtr || cleanDesc.includes(cleanRef);
    if (isExactRefMatch) matchedFields.push('EXTERNAL_REF');

    // Check Amount Match
    const isExactAmount = amountDiff <= toleranceCents;
    if (isExactAmount) matchedFields.push('AMOUNT');

    // Check Currency Match
    const isCurrencyMatch = tx.currency === settlement.currency;
    if (isCurrencyMatch) matchedFields.push('CURRENCY');

    // 1. Exact Match Condition
    if (isExactRefMatch && isExactAmount && isCurrencyMatch) {
      return {
        status: 'EXACT_MATCH',
        confidence: 1.0,
        transactionId: tx.id,
        settlementId: settlement.id,
        discrepancyAmountCents: 0,
        reason: 'Deterministic exact match on external reference, gross amount, and currency.',
        matchedFields,
      };
    }

    // 2. Fee / Net Deduction Discrepancy
    const netAmountDiff = Math.abs(tx.amountCents - (settlement.amountCents + settlement.feeCents + settlement.taxCents));
    if (isExactRefMatch && netAmountDiff === 0) {
      return {
        status: 'FEE_MISMATCH',
        confidence: 0.98,
        transactionId: tx.id,
        settlementId: settlement.id,
        discrepancyAmountCents: settlement.feeCents + settlement.taxCents,
        reason: `Settlement includes standard gateway fee deduction (Fee: ₹${(settlement.feeCents / 100).toFixed(2)}, Tax: ₹${(settlement.taxCents / 100).toFixed(2)}).`,
        matchedFields: [...matchedFields, 'FEE_ADJUSTED_AMOUNT'],
      };
    }

    // 3. Amount Mismatch with matching reference
    if (isExactRefMatch && !isExactAmount) {
      return {
        status: 'AMOUNT_MISMATCH',
        confidence: 0.85,
        transactionId: tx.id,
        settlementId: settlement.id,
        discrepancyAmountCents: amountDiff,
        reason: `Reference matched (${tx.externalRef}), but settled amount (₹${(settlement.amountCents / 100).toFixed(2)}) deviates from ledger amount (₹${(tx.amountCents / 100).toFixed(2)}).`,
        matchedFields: ['EXTERNAL_REF'],
      };
    }

    // 4. Fuzzy Match Context (Customer Name / Phone or Metadata match)
    const nameMatch = settlement.rawDescription.toLowerCase().includes(tx.customerName.toLowerCase());
    const phoneMatch = tx.customerPhone && settlement.rawDescription.includes(tx.customerPhone.slice(-4));
    
    if ((nameMatch || phoneMatch) && isExactAmount) {
      return {
        status: 'FUZZY_MATCH_HIGH',
        confidence: 0.92,
        transactionId: tx.id,
        settlementId: settlement.id,
        discrepancyAmountCents: 0,
        reason: `Fuzzy match on customer identifiers (${nameMatch ? 'Name' : ''}${phoneMatch ? ' PhoneLast4' : ''}) with identical transaction amount.`,
        matchedFields: nameMatch ? ['CUSTOMER_NAME', 'AMOUNT'] : ['PHONE_PARTIAL', 'AMOUNT'],
      };
    }

    // 5. Unmatched default
    return {
      status: 'UNMATCHED_TRANSACTION',
      confidence: 0.0,
      transactionId: tx.id,
      settlementId: settlement.id,
      discrepancyAmountCents: tx.amountCents,
      reason: 'No deterministic reference or entity matching found between records.',
      matchedFields: [],
    };
  }

  /**
   * Batch Reconciler for multiple transactions & settlement batch records
   */
  public static reconcileBatch(
    transactions: TransactionRecord[],
    settlements: SettlementRecord[],
    toleranceCents = 0
  ): {
    matched: ReconMatchResult[];
    unmatchedTransactions: TransactionRecord[];
    unmatchedSettlements: SettlementRecord[];
    matchRate: number;
  } {
    const matched: ReconMatchResult[] = [];
    const matchedTxIds = new Set<string>();
    const matchedSettlementIds = new Set<string>();

    // Index settlements by clean UTR/RRN for O(1) candidate lookup
    const settlementUtrMap = new Map<string, SettlementRecord[]>();
    for (const st of settlements) {
      const key = st.utrRrn.trim().toLowerCase();
      const list = settlementUtrMap.get(key) || [];
      list.push(st);
      settlementUtrMap.set(key, list);
    }

    // Pass 1: Deterministic Exact Matches using Indexed Lookups first, then fallback scan
    for (const tx of transactions) {
      const cleanRef = tx.externalRef.trim().toLowerCase();
      const directCandidates = settlementUtrMap.get(cleanRef) || [];

      // Check indexed direct candidates first
      let matchedInPass1 = false;
      for (const st of directCandidates) {
        if (matchedSettlementIds.has(st.id)) continue;
        const result = this.reconcilePair(tx, st, toleranceCents);
        if (result.status === 'EXACT_MATCH' || result.status === 'FEE_MISMATCH') {
          matched.push(result);
          matchedTxIds.add(tx.id);
          matchedSettlementIds.add(st.id);
          matchedInPass1 = true;
          break;
        }
      }

      if (matchedInPass1) continue;

      // Fallback scan for description includes
      for (const st of settlements) {
        if (matchedSettlementIds.has(st.id)) continue;
        const result = this.reconcilePair(tx, st, toleranceCents);
        if (result.status === 'EXACT_MATCH' || result.status === 'FEE_MISMATCH') {
          matched.push(result);
          matchedTxIds.add(tx.id);
          matchedSettlementIds.add(st.id);
          break;
        }
      }
    }

    // Pass 2: Fuzzy & Discrepancy Matches for leftovers
    for (const tx of transactions) {
      if (matchedTxIds.has(tx.id)) continue;
      for (const st of settlements) {
        if (matchedSettlementIds.has(st.id)) continue;
        const result = this.reconcilePair(tx, st, toleranceCents);
        if (result.status === 'FUZZY_MATCH_HIGH' || result.status === 'AMOUNT_MISMATCH') {
          matched.push(result);
          matchedTxIds.add(tx.id);
          matchedSettlementIds.add(st.id);
          break;
        }
      }
    }

    const unmatchedTransactions = transactions.filter((tx) => !matchedTxIds.has(tx.id));
    const unmatchedSettlements = settlements.filter((st) => !matchedSettlementIds.has(st.id));

    const totalRecords = transactions.length;
    const matchRate = totalRecords > 0 ? (matched.length / totalRecords) * 100 : 0;

    return {
      matched,
      unmatchedTransactions,
      unmatchedSettlements,
      matchRate: parseFloat(matchRate.toFixed(2)),
    };
  }
}
