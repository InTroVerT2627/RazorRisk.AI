import { describe, it, expect } from 'vitest';
import { ReliabilityEngine } from '../../src/core/reliability/retry-policy';

describe('Reliability tests', () => {
  for (let i = 1; i <= 10; i++) {
    it(`Reliability test case ${i}`, () => {
      expect(ReliabilityEngine.generateIdempotencyKey('a', 'b', i)).toBeDefined();
    });
  }
});
