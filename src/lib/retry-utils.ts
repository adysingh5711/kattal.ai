/**
 * Robust retry utility for handling network and API failures
 */

export interface RetryOptions {
    maxRetries?: number;
    baseDelay?: number;
    maxDelay?: number;
    backoffFactor?: number;
    retryCondition?: (error: unknown) => boolean;
}

export interface RetryResult<T> {
    success: boolean;
    result?: T;
    error?: Error;
    attempts: number;
    totalTime: number;
}

/**
 * Execute a function with exponential backoff retry logic
 */
export async function withRetry<T>(
    fn: () => Promise<T>,
    options: RetryOptions = {}
): Promise<RetryResult<T>> {
    const {
        maxRetries = 3,
        baseDelay = 1000,
        maxDelay = 30000,
        backoffFactor = 2,
        retryCondition = (error) => isRetryableError(error)
    } = options;

    const startTime = Date.now();
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            const result = await fn();
            return {
                success: true,
                result,
                attempts: attempt + 1,
                totalTime: Date.now() - startTime
            };
        } catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error));

            // Don't retry on the last attempt
            if (attempt === maxRetries) {
                break;
            }

            // Check if error is retryable
            if (!retryCondition(lastError)) {
                console.log(`❌ Non-retryable error, stopping retries: ${lastError.message}`);
                break;
            }

            // Calculate delay with exponential backoff and jitter
            const delay = Math.min(
                baseDelay * Math.pow(backoffFactor, attempt),
                maxDelay
            );
            const jitter = delay * 0.1 * Math.random();
            const finalDelay = delay + jitter;

            console.log(`⚠️  Attempt ${attempt + 1} failed, retrying in ${Math.round(finalDelay)}ms: ${lastError.message}`);

            await sleep(finalDelay);
        }
    }

    return {
        success: false,
        error: lastError,
        attempts: maxRetries + 1,
        totalTime: Date.now() - startTime
    };
}

/**
 * Determine if an error is retryable
 */
export function isRetryableError(error: unknown): boolean {
    if (!error) return false;

    // Create a type-safe error object
    const errorObj: { message?: string; code?: string | number; status?: number } = 
        typeof error === 'object' && error !== null ? error : {};

    const errorMessage = errorObj.message?.toLowerCase() || '';
    const errorCode = errorObj.code || errorObj.status;

    // Network errors
    const networkErrors = [
        'network',
        'timeout',
        'econnreset',
        'econnrefused',
        'etimedout',
        'enotfound',
        'socket hang up'
    ];

    if (networkErrors.some(keyword => errorMessage.includes(keyword))) {
        return true;
    }

    // HTTP status codes that are retryable
    const retryableStatusCodes = [408, 429, 500, 503, 504];
    // Fixed TypeScript error: Argument of type 'string | number | undefined' is not assignable to parameter of type 'number'
    if (typeof errorCode === 'number' && retryableStatusCodes.includes(errorCode)) {
        return true;
    }

    // Rate limiting
    if (errorMessage.includes('rate limit') || errorMessage.includes('too many requests')) {
        return true;
    }

    // Temporary Pinecone errors
    if (errorMessage.includes('temporary') || errorMessage.includes('unavailable')) {
        return true;
    }

    return false;
}

/**
 * Sleep for specified milliseconds
 */
export function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Execute multiple operations in batches with retry logic
 */
export async function batchExecuteWithRetry<T, R>(
    items: T[],
    batchSize: number,
    executor: (batch: T[]) => Promise<R[]>,
    options: RetryOptions & {
        onProgress?: (completed: number, total: number, currentBatch: number) => void;
        onBatchError?: (batch: T[], error: Error, batchIndex: number) => void;
    } = {}
): Promise<{
    results: R[];
    errors: Array<{ batch: T[]; error: Error; batchIndex: number }>;
    totalTime: number;
    completedBatches: number;
}> {
    const startTime = Date.now();
    const results: R[] = [];
    const errors: Array<{ batch: T[]; error: Error; batchIndex: number }> = [];
    const batches = [];

    // Create batches
    for (let i = 0; i < items.length; i += batchSize) {
        batches.push(items.slice(i, i + batchSize));
    }

    console.log(`📊 Processing ${items.length} items in ${batches.length} batches (batch size: ${batchSize})`);

    let completedBatches = 0;

    for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];

        // Progress callback
        options.onProgress?.(results.length, items.length, i + 1);

        const retryResult = await withRetry(
            () => executor(batch),
            {
                maxRetries: options.maxRetries || 3,
                baseDelay: options.baseDelay || 1000,
                retryCondition: options.retryCondition || isRetryableError
            }
        );

        if (retryResult.success && retryResult.result) {
            results.push(...retryResult.result);
            completedBatches++;
            console.log(`✅ Batch ${i + 1}/${batches.length} completed (${batch.length} items)`);
        } else {
            const error = retryResult.error || new Error('Unknown batch error');
            errors.push({ batch, error, batchIndex: i });
            options.onBatchError?.(batch, error, i);
            console.error(`❌ Batch ${i + 1}/${batches.length} failed after ${retryResult.attempts} attempts: ${error.message}`);
        }

        // Small delay between batches to prevent overwhelming the server
        if (i < batches.length - 1) {
            await sleep(100);
        }
    }

    return {
        results,
        errors,
        totalTime: Date.now() - startTime,
        completedBatches
    };
}

/**
 * Circuit breaker pattern for preventing cascade failures
 */
export class CircuitBreaker {
    private failureCount = 0;
    private lastFailureTime = 0;
    private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';

    constructor(
        private maxFailures = 5,
        private resetTimeout = 60000 // 1 minute
    ) { }

    async execute<T>(fn: () => Promise<T>): Promise<T> {
        if (this.state === 'OPEN') {
            if (Date.now() - this.lastFailureTime > this.resetTimeout) {
                this.state = 'HALF_OPEN';
            } else {
                throw new Error('Circuit breaker is OPEN - too many recent failures');
            }
        }

        try {
            const result = await fn();

            // Success - reset circuit breaker
            if (this.state === 'HALF_OPEN') {
                this.state = 'CLOSED';
                this.failureCount = 0;
            }

            return result;
        } catch (error) {
            this.failureCount++;
            this.lastFailureTime = Date.now();

            if (this.failureCount >= this.maxFailures) {
                this.state = 'OPEN';
                console.log(`🚨 Circuit breaker OPEN after ${this.failureCount} failures`);
            }

            throw error;
        }
    }

    getState(): string {
        return this.state;
    }

    reset(): void {
        this.state = 'CLOSED';
        this.failureCount = 0;
        this.lastFailureTime = 0;
    }
}