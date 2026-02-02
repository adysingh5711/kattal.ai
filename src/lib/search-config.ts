/**
 * Search configuration constants and performance monitoring
 */

export const SEARCH_CONFIG = {
    RESULT_LIMITS: {
        DEFAULT_K: 10,
        MAX_K: 50,
        MIN_K: 1
    },
    PERFORMANCE: {
        CACHE_TTL: 5 * 60 * 1000, // 5 minutes
        MAX_CONCURRENT_SEARCHES: 10,
        SEARCH_TIMEOUT: 60000, // 60 seconds
    },

    SCORING: {
        DEFAULT_THRESHOLD: 0.7,
        MIN_THRESHOLD: 0.1,
        MAX_THRESHOLD: 1.0
    }
};

/**
 * Simple performance monitor for search operations
 */
export class SearchPerformanceMonitor {
    private static instance: SearchPerformanceMonitor;
    private metrics: Map<string, { count: number; totalTime: number; avgTime: number }> = new Map();

    static getInstance(): SearchPerformanceMonitor {
        if (!SearchPerformanceMonitor.instance) {
            SearchPerformanceMonitor.instance = new SearchPerformanceMonitor();
        }
        return SearchPerformanceMonitor.instance;
    }

    startTimer(): () => void {
        const startTime = Date.now();
        return () => {
            const endTime = Date.now();
            const duration = endTime - startTime;
            this.recordMetric('search', duration);
        };
    }

    private recordMetric(operation: string, duration: number): void {
        const existing = this.metrics.get(operation) || { count: 0, totalTime: 0, avgTime: 0 };
        existing.count++;
        existing.totalTime += duration;
        existing.avgTime = existing.totalTime / existing.count;
        this.metrics.set(operation, existing);
    }

    getMetrics(): Record<string, { count: number; totalTime: number; avgTime: number }> {
        const result: Record<string, { count: number; totalTime: number; avgTime: number }> = {};
        for (const [key, value] of this.metrics.entries()) {
            result[key] = { ...value };
        }
        return result;
    }

    reset(): void {
        this.metrics.clear();
    }
}
