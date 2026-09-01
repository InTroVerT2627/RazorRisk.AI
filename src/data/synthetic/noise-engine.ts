import { SeededPRNG } from './prng';
import { SettlementRecord, TransactionRecord, NoiseConfig } from '@/types';

export class FinancialNoiseEngine {
  public static readonly DEFAULT_NOISE_CONFIG: NoiseConfig = {
    missingFieldRate: 0.05,
    narrationCorruptionRate: 0.08,
    timestampJitterHours: 24,
    duplicateRowRate: 0.02,
    feeNettingVarianceRate: 0.10,
  };

  /**
   * Applies realistic bank narration noise, token shuffling, and casing anomalies
   */
  public static corruptNarration(narration: string, prng: SeededPRNG): string {
    const noiseTypes = ['CASE_ALTER', 'TOKEN_REORDER', 'WHITESPACE', 'TRUNCATE', 'PREFIX_TYPO'];
    const chosen = prng.pick(noiseTypes);

    switch (chosen) {
      case 'CASE_ALTER':
        return prng.chance(0.5) ? narration.toLowerCase() : narration.toUpperCase();
      case 'TOKEN_REORDER': {
        const tokens = narration.split(/[\s-]+/).filter(Boolean);
        if (tokens.length >= 3) {
          const shuffled = prng.shuffle(tokens);
          return shuffled.join('-');
        }
        return narration;
      }
      case 'WHITESPACE':
        return narration.replace(/-/g, '   ').trim();
      case 'TRUNCATE':
        return narration.substring(0, Math.max(12, narration.length - prng.rangeInt(4, 10)));
      case 'PREFIX_TYPO':
        return `NEFT/INB/${narration}`;
      default:
        return narration;
    }
  }

  /**
   * Corrupts bank UTR/RRN identifiers (e.g. truncation, bank prefixes)
   */
  public static corruptUtr(utr: string, prng: SeededPRNG): string {
    if (utr.length > 8 && prng.chance(0.4)) {
      return utr.substring(0, utr.length - 4); // truncated last 4 chars
    }
    return `UTR_${utr}`;
  }

  /**
   * Introduces realistic fee deductions (e.g. MDR 1.5-2.5% + 18% GST)
   */
  public static applyFeeDeductions(grossCents: number, mdrBps: number, gstBps: number): {
    feeCents: number;
    taxCents: number;
    netAmountCents: number;
  } {
    const feeCents = Math.round((grossCents * mdrBps) / 10000);
    const taxCents = Math.round((feeCents * gstBps) / 10000);
    const netAmountCents = grossCents - feeCents - taxCents;
    return { feeCents, taxCents, netAmountCents };
  }

  /**
   * Injects timestamp jitter (e.g., weekend bank batch delay)
   */
  public static applyTimestampJitter(isoTimestamp: string, maxJitterHours: number, prng: SeededPRNG): string {
    const date = new Date(isoTimestamp);
    const jitterMs = prng.range(1, maxJitterHours) * 3600 * 1000;
    return new Date(date.getTime() + jitterMs).toISOString();
  }
}
