import { LRUCache } from 'lru-cache';

/**
 * Production-optimized query caching system
 * Provides fast response times for repeated queries
 */

interface CachedQueryResult {
    text: string;
    sources: Array<{
        source: string;
        relevance: number;
        usedFor: string;
        contentType: 'text' | 'table' | 'chart' | 'image';
        pageReference?: string;
    }>;
    analysis: {
        queryType: string;
        complexity: number;
        retrievalStrategy: string;
        documentsUsed: number;
        crossReferences: string[];
        responseStyle: string;
        qualityScore: number;
        confidence: number;
        completeness: 'complete' | 'partial' | 'needs_followup';
        processingTime: number;
    };
    quality: {
        overallScore: number;
        factualAccuracy: number;
        completeness: number;
        coherence: number;
        issues: Array<{
            type: 'factual_error' | 'missing_info' | 'coherence_issue' | 'source_problem' | 'tone_issue';
            severity: 'low' | 'medium' | 'high';
            description: string;
            suggestion: string;
            affectedSection?: string;
        }>;
        improvements: string[];
    };
    reasoning: string[];
    environmentalData?: Record<string, unknown>;
    environmentalSummary?: string;
    cached: boolean;
    cacheTimestamp: number;
}

// Production-optimized cache configuration
const queryCache = new LRUCache<string, CachedQueryResult>({
    max: 200, // Store up to 200 queries
    ttl: 1000 * 60 * 10, // 10 minutes cache duration
    updateAgeOnGet: true, // Refresh TTL on access
    allowStale: false, // Don't return stale data
});

// Cache statistics for monitoring
let cacheStats = {
    hits: 0,
    misses: 0,
    sets: 0,
    evictions: 0,
    startTime: Date.now()
};

/**
 * Generate cache key from query and namespace
 */
function generateCacheKey(query: string, namespace: string, chatHistory?: string): string {
    // Normalize query for consistent caching
    const normalizedQuery = query.toLowerCase().trim().replace(/\s+/g, ' ');

    // Include chat history hash for context-aware caching
    const historyHash = chatHistory ?
        require('crypto').createHash('md5').update(chatHistory).digest('hex').substring(0, 8) :
        'no-history';

    return `${namespace}:${normalizedQuery}:${historyHash}`;
}

/**
 * Get cached query result
 */
export function getCachedQuery(query: string, namespace: string, chatHistory?: string): CachedQueryResult | undefined {
    const key = generateCacheKey(query, namespace, chatHistory);
    const cached = queryCache.get(key);

    if (cached) {
        cacheStats.hits++;
        console.log(`🚀 Cache HIT for query: "${query.substring(0, 50)}..."`);

        // Mark as cached and update timestamp
        cached.cached = true;
        cached.cacheTimestamp = Date.now();

        return cached;
    } else {
        cacheStats.misses++;
        console.log(`❌ Cache MISS for query: "${query.substring(0, 50)}..."`);
        return undefined;
    }
}

/**
 * Cache query result
 */
export function setCachedQuery(
    query: string,
    namespace: string,
    result: CachedQueryResult,
    chatHistory?: string
): void {
    const key = generateCacheKey(query, namespace, chatHistory);

    // Mark as cached
    result.cached = false; // Original result, not from cache
    result.cacheTimestamp = Date.now();

    queryCache.set(key, result);
    cacheStats.sets++;

    console.log(`💾 Cached result for query: "${query.substring(0, 50)}..."`);
}

/**
 * Clear cache (useful for development or when data changes)
 */
export function clearCache(): void {
    queryCache.clear();
    cacheStats = {
        hits: 0,
        misses: 0,
        sets: 0,
        evictions: 0,
        startTime: Date.now()
    };
    console.log('🧹 Query cache cleared');
}

/**
 * Get cache statistics for monitoring
 */
export function getCacheStats(): {
    size: number;
    maxSize: number;
    hits: number;
    misses: number;
    sets: number;
    hitRate: number;
    uptime: number;
} {
    const uptime = Date.now() - cacheStats.startTime;
    const totalRequests = cacheStats.hits + cacheStats.misses;
    const hitRate = totalRequests > 0 ? (cacheStats.hits / totalRequests) * 100 : 0;

    return {
        size: queryCache.size,
        maxSize: queryCache.max,
        hits: cacheStats.hits,
        misses: cacheStats.misses,
        sets: cacheStats.sets,
        hitRate: Math.round(hitRate * 100) / 100,
        uptime: Math.round(uptime / 1000) // seconds
    };
}

/**
 * Log cache performance (for production monitoring)
 */
export function logCachePerformance(): void {
    const stats = getCacheStats();
    console.log('📊 Cache Performance Stats:');
    console.log(`   Size: ${stats.size}/${stats.maxSize}`);
    console.log(`   Hit Rate: ${stats.hitRate}%`);
    console.log(`   Hits: ${stats.hits}, Misses: ${stats.misses}`);
    console.log(`   Uptime: ${stats.uptime}s`);
}

/**
 * Warm cache with common queries (optional optimization)
 */
export function warmCache(commonQueries: string[], namespace: string = 'malayalam-docs'): void {
    console.log(`🔥 Warming cache with ${commonQueries.length} common queries...`);
    // This would typically be called with pre-computed results
    // Implementation depends on your specific use case
}
