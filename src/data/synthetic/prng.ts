/**
 * High-performance, reproducible Seeded PRNG for Large-Scale Financial Simulation
 * Implements Mulberry32 and Box-Muller Gaussian Transforms
 */
export class SeededPRNG {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  /**
   * Generates a deterministic float in [0, 1)
   */
  public next(): number {
    let t = (this.state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /**
   * Float in range [min, max)
   */
  public range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  /**
   * Integer in range [min, max] inclusive
   */
  public rangeInt(min: number, max: number): number {
    return Math.floor(this.range(min, max + 1));
  }

  /**
   * Bernoulli trial (true with given probability in [0, 1])
   */
  public chance(probability: number): boolean {
    return this.next() < probability;
  }

  /**
   * Box-Muller Gaussian distribution
   */
  public gaussian(mean = 0, stdDev = 1): number {
    let u = 0;
    let v = 0;
    while (u === 0) u = this.next();
    while (v === 0) v = this.next();
    const z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
    return mean + z * stdDev;
  }

  /**
   * Pick single random item from array
   */
  public pick<T>(array: readonly T[]): T {
    if (array.length === 0) throw new Error('Cannot pick from empty array');
    const index = Math.floor(this.next() * array.length);
    return array[index];
  }

  /**
   * Weighted categorical sampling
   */
  public sampleWeighted<T>(items: readonly T[], weights: readonly number[]): T {
    if (items.length !== weights.length || items.length === 0) {
      throw new Error('Items and weights must have identical non-zero length');
    }
    const totalWeight = weights.reduce((sum, w) => sum + w, 0);
    let randomThreshold = this.next() * totalWeight;

    for (let i = 0; i < items.length; i++) {
      if (randomThreshold < weights[i]) {
        return items[i];
      }
      randomThreshold -= weights[i];
    }
    return items[items.length - 1];
  }

  /**
   * Deterministic Fisher-Yates shuffle
   */
  public shuffle<T>(array: T[]): T[] {
    const copy = [...array];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }
}
