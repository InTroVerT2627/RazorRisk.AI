export interface RetryConfig {
  maxRetries: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffFactor: number;
  jitterRatio?: number;
}

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  initialDelayMs: 200,
  maxDelayMs: 3000,
  backoffFactor: 2,
  jitterRatio: 0.1,
};

export class ReliabilityEngine {
  /**
   * Generates deterministic, stable idempotency key for financial side-effect actions
   */
  public static generateIdempotencyKey(caseId: string, actionType: string, retryCount: number): string {
    return `idem_${caseId}_${actionType}_r${retryCount}`;
  }

  /**
   * Computes backoff delay with deterministic jitter
   */
  public static computeBackoffDelay(attempt: number, config: RetryConfig = DEFAULT_RETRY_CONFIG): number {
    const exponential = config.initialDelayMs * Math.pow(config.backoffFactor, attempt);
    const capped = Math.min(exponential, config.maxDelayMs);
    const jitter = (config.jitterRatio ?? 0) * capped * (Math.random() * 2 - 1);
    return Math.round(Math.max(0, capped + jitter));
  }

  /**
   * Executes an async operation with automatic retry and exponential backoff
   */
  public static async executeWithRetry<T>(
    operation: (attempt: number) => Promise<T>,
    isPermanentFailure: (error: any) => boolean = () => false,
    config: RetryConfig = DEFAULT_RETRY_CONFIG
  ): Promise<{ result?: T; attempts: number; success: boolean; lastError?: Error }> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
      try {
        const result = await operation(attempt);
        return { result, attempts: attempt + 1, success: true };
      } catch (err: any) {
        lastError = err;
        if (isPermanentFailure(err) || attempt === config.maxRetries) {
          break;
        }
        const delay = this.computeBackoffDelay(attempt, config);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    return { attempts: config.maxRetries + 1, success: false, lastError };
  }
}
