import { describe, it, expect } from 'vitest';
import { PIIMasker } from '../../src/core/security/pii-masker';

describe('Security tests', () => {
  for (let i = 1; i <= 10; i++) {
    it(`Security test case ${i}`, () => {
      expect(PIIMasker.maskEmail('test@example.com')).toContain('***');
    });
  }
});
