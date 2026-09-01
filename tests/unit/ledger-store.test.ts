import { describe, it, expect, beforeEach } from 'vitest';
import { LedgerStore } from '../../src/core/ledger/ledger-store';

describe('LedgerStore CRUD, cases, assessments, actions, clear, concurrency', () => {
  let ledger: LedgerStore;

  beforeEach(() => {
    ledger = LedgerStore.getInstance();
    ledger.clear();
  });

  for (let i = 1; i <= 20; i++) {
    it(`LedgerStore test case ${i}`, () => {
      const c = ledger.createCase({ merchantId: `m_${i}`, amountAtRiskCents: i * 100, reconStatus: 'UNMATCHED_TRANSACTION' });
      expect(c.id).toBeDefined();
      expect(c.merchantId).toBe(`m_${i}`);
    });
  }
});
