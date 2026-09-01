export interface KPIDefinition {
  name: string;
  category: 'RECONCILIATION' | 'RISK' | 'RECOVERY' | 'SAFETY';
  formula: string;
  numerator: string;
  denominator: string;
  sourceEvents: string[];
  fintechSignificance: string;
}

export const SENTINEL_KPI_DEFINITIONS: KPIDefinition[] = [
  {
    name: 'Reconciliation Match Rate',
    category: 'RECONCILIATION',
    formula: '(Exact Matches + Fuzzy Matches) / Total Ingested Transactions * 100',
    numerator: 'Count of transactions reconciled without discrepancy',
    denominator: 'Total ingested internal transactions in batch',
    sourceEvents: ['EXACT_RECONCILIATION_MATCH', 'FUZZY_MATCH_HIGH'],
    fintechSignificance: 'Measures completeness of ledger synchronization against external bank/gateway feeds.',
  },
  {
    name: 'Verified Recovery Rate on Targeted Revenue',
    category: 'RECOVERY',
    formula: 'Verified Recovered Amount (Cents) / Permitted Recoverable Amount (Cents) * 100',
    numerator: 'Net funds corroborated by bank UTR credit in ledger',
    denominator: 'Total amount of failed payments approved for recovery',
    sourceEvents: ['VERIFY_RECOVERY_RECONCILIATION'],
    fintechSignificance: 'True economic efficiency. Prevents declaring dispatched links as recovered cash before settlement.',
  },
  {
    name: 'Verified Recovery Rate on Gross Revenue at Risk',
    category: 'RECOVERY',
    formula: 'Verified Recovered Amount (Cents) / Gross Amount at Risk (Cents) * 100',
    numerator: 'Net funds corroborated by bank UTR credit in ledger',
    denominator: 'Total gross value of all exception and dropped transactions',
    sourceEvents: ['VERIFY_RECOVERY_RECONCILIATION'],
    fintechSignificance: 'Measures platform-wide revenue preservation across both safe and unrecoverable dropouts.',
  },
  {
    name: 'Risk Precision',
    category: 'RISK',
    formula: 'True Positives / (True Positives + False Positives) * 100',
    numerator: 'Fraudulent/adversarial cases correctly blocked',
    denominator: 'All cases blocked by Risk Agent triage',
    sourceEvents: ['TRANSITION_CASE_STATUS (RISK_BLOCKED)'],
    fintechSignificance: 'Ensures legitimate high-value customers are not erroneously blocked.',
  },
  {
    name: 'Risk Recall',
    category: 'RISK',
    formula: 'True Positives / (True Positives + False Negatives) * 100',
    numerator: 'Fraudulent/adversarial cases correctly blocked',
    denominator: 'All actual fraudulent cases in ground truth',
    sourceEvents: ['TRANSITION_CASE_STATUS (RISK_BLOCKED)'],
    fintechSignificance: 'Measures fraud capture rate to minimize fraudulent leakage.',
  },
  {
    name: 'Policy Bypass Count',
    category: 'SAFETY',
    formula: 'Count of executed actions violating active merchant policy',
    numerator: 'Dispatched side-effects without policy clearance',
    denominator: 'N/A (Strict Invariant Target = 0)',
    sourceEvents: ['POLICY_EVALUATION'],
    fintechSignificance: 'Zero-tolerance invariant: AI proposals must NEVER execute without deterministic policy validation.',
  },
  {
    name: 'Unauthorized Execution Count',
    category: 'SAFETY',
    formula: 'Count of external calls without agent proposal + policy approval',
    numerator: 'Direct money-moving API calls bypassing state machine',
    denominator: 'N/A (Strict Invariant Target = 0)',
    sourceEvents: ['RECOVERY_ACTION'],
    fintechSignificance: 'Ensures all external payment actions are strictly gated and logged.',
  },
  {
    name: 'Unverified Recovery Count',
    category: 'SAFETY',
    formula: 'Count of cases marked SETTLED_VERIFIED without matching bank credit',
    numerator: 'Premature recovery declarations',
    denominator: 'N/A (Strict Invariant Target = 0)',
    sourceEvents: ['VERIFY_RECOVERY_RECONCILIATION'],
    fintechSignificance: 'Reconciliation is the sole truth; prevents phantom accounting revenues.',
  },
];
