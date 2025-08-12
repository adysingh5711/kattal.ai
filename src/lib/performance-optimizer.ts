import { Document } from "langchain/document";
import { QueryAnalysis } from "./query-analyzer";
import { ResponseSynthesis } from "./response-synthesizer";
import { ValidationResult } from "./quality-validator";

export interface CachedResponse {
    query: string;
    queryHash: string;
    response: ResponseSynthesis;
    validation: ValidationResult;
    timestamp: Date;
    hitCount: number;
    lastAccessed: Date;
    contextHash?: string; // For context-sensitive caching
}

export interface PerformanceMetrics {
    queryProcessingTime: number;
    retrievalTime: number;
    synthesisTime: number;
    validationTime: number;
    totalTime: number;
    cacheHitRate: number;
    documentsRetrieved: number;
    qualityScore: number;
}

export interface OptimizationSuggestion {
    type: 'caching' | 'retrieval' | 'synthesis' | 'validation';
    priority: 'low' | 'medium' | 'high';
    description: string;
    expectedImprovement: string;
    implementation: string;
}

export class PerformanceOptimizer {
    private responseCache: Map<string, CachedResponse> = new Map();
    private queryPatternCache: Map<string, string[]> = new Map();
    private performanceHistory: PerformanceMetrics[] = [];
    private precomputedResponses: Map<string, ResponseSynthesis> = new Map();

    // Cache configuration
    private readonly MAX_CACHE_SIZE = 1000;
    private readonly CACHE_TTL_HOURS = 24;
    private readonly SIMILARITY_THRESHOLD = 0.85;

    async optimizeQuery(
        query: string,
        queryAnalysis: QueryAnalysis,
        chatHistory?: string
    ): Promise<{
        optimizedQuery: string;
        cacheKey: string;
        shouldCache: boolean;
        estimatedTime: number;
    }> {
        const startTime = Date.now();

        // Generate cache key
        const cacheKey = this.generateCacheKey(query, chatHistory);

        // Check for cached response
        const cached = this.getCachedResponse(cacheKey, query);
        if (cached) {
            console.log(`💾 Cache hit for query: "${query.slice(0, 50)}..."`);
            cached.hitCount++;
            cached.lastAccessed = new Date();

            return {
                optimizedQuery: query,
                cacheKey,
                shouldCache: false,
                estimatedTime: 50 // Fast cache retrieval
            };
        }

        // Optimize query for better performance
        const optimizedQuery = await this.optimizeQueryForSpeed(query, queryAnalysis);

        // Estimate processing time
        const estimatedTime = this.estimateProcessingTime(queryAnalysis);

        // Determine if we should cache this response
        const shouldCache = this.shouldCacheQuery(query, queryAnalysis);

        console.log(`🚀 Query optimized. Estimated time: ${estimatedTime}ms`);

        return {
            optimizedQuery,
            cacheKey,
            shouldCache,
            estimatedTime
        };
    }

    private generateCacheKey(query: string, chatHistory?: string): string {
        const queryNormalized = query.toLowerCase().trim().replace(/\s+/g, ' ');
        const contextHash = chatHistory
            ? this.hashString(chatHistory.slice(-200)) // Use recent context
            : '';

        return this.hashString(queryNormalized + contextHash);
    }

    private hashString(str: string): string {
        let hash = 0;
        if (str.length === 0) return hash.toString();

        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }

        return Math.abs(hash).toString(36);
    }

    private getCachedResponse(cacheKey: string, query: string): CachedResponse | null {
        // Direct cache hit
        const direct = this.responseCache.get(cacheKey);
        if (direct && this.isCacheValid(direct)) {
            return direct;
        }

        // Semantic similarity check for near-matches
        for (const [key, cached] of this.responseCache.entries()) {
            if (this.isCacheValid(cached) && this.calculateQuerySimilarity(query, cached.query) > this.SIMILARITY_THRESHOLD) {
                console.log(`🎯 Semantic cache hit: "${cached.query}" ≈ "${query}"`);
                return cached;
            }
        }

        return null;
    }

    private isCacheValid(cached: CachedResponse): boolean {
        const ageHours = (Date.now() - cached.timestamp.getTime()) / (1000 * 60 * 60);
        return ageHours < this.CACHE_TTL_HOURS;
    }

    private calculateQuerySimilarity(query1: string, query2: string): number {
        // Simple similarity based on common words and structure
        const words1 = new Set(query1.toLowerCase().split(/\s+/));
        const words2 = new Set(query2.toLowerCase().split(/\s+/));

        const intersection = new Set([...words1].filter(x => words2.has(x)));
        const union = new Set([...words1, ...words2]);

        return intersection.size / union.size;
    }

    private async optimizeQueryForSpeed(query: string, analysis: QueryAnalysis): Promise<string> {
        // For simple queries, no optimization needed
        if (analysis.complexity <= 2) {
            return query;
        }

        // For complex queries, try to make them more specific
        const optimizedQuery = query
            .replace(/\b(please|could you|can you|would you)\b/gi, '') // Remove politeness words
            .replace(/\s+/g, ' ') // Normalize whitespace
            .trim();

        // Add key terms that might improve retrieval speed
        if (analysis.keyEntities.length > 0) {
            const keyTerms = analysis.keyEntities.slice(0, 2).join(' ');
            return `${keyTerms} ${optimizedQuery}`;
        }

        return optimizedQuery;
    }

    private estimateProcessingTime(analysis: QueryAnalysis): number {
        // Base time estimates in milliseconds
        const baseTime = 1000;
        const complexityMultiplier = analysis.complexity * 500;
        const retrievalTime = analysis.suggestedK * 50;
        const crossRefTime = analysis.requiresCrossReference ? 2000 : 0;

        return baseTime + complexityMultiplier + retrievalTime + crossRefTime;
    }

    private shouldCacheQuery(query: string, analysis: QueryAnalysis): boolean {
        // Cache criteria
        const isComplexEnough = analysis.complexity >= 3;
        const isNotTooPersonal = !query.toLowerCase().includes('my ') && !query.toLowerCase().includes('i ');
        const isReusable = !query.toLowerCase().includes('current') && !query.toLowerCase().includes('latest');

        return isComplexEnough && isNotTooPersonal && isReusable;
    }

    async cacheResponse(
        cacheKey: string,
        query: string,
        response: ResponseSynthesis,
        validation: ValidationResult,
        chatHistory?: string
    ): Promise<void> {
        // Only cache high-quality responses
        if (validation.overallScore < 0.7) {
            console.log(`⚠️  Not caching low-quality response (score: ${validation.overallScore.toFixed(2)})`);
            return;
        }

        const cached: CachedResponse = {
            query,
            queryHash: cacheKey,
            response,
            validation,
            timestamp: new Date(),
            hitCount: 0,
            lastAccessed: new Date(),
            contextHash: chatHistory ? this.hashString(chatHistory.slice(-200)) : undefined
        };

        this.responseCache.set(cacheKey, cached);

        // Cleanup old cache entries if needed
        if (this.responseCache.size > this.MAX_CACHE_SIZE) {
            this.cleanupCache();
        }

        console.log(`💾 Cached response for: "${query.slice(0, 50)}..."`);
    }

    private cleanupCache(): void {
        const entries = Array.from(this.responseCache.entries());

        // Sort by last accessed time and hit count
        entries.sort((a, b) => {
            const scoreA = a[1].hitCount + (Date.now() - a[1].lastAccessed.getTime()) / 1000000;
            const scoreB = b[1].hitCount + (Date.now() - b[1].lastAccessed.getTime()) / 1000000;
            return scoreB - scoreA;
        });

        // Remove oldest 20% of entries
        const toRemove = Math.floor(entries.length * 0.2);
        for (let i = entries.length - toRemove; i < entries.length; i++) {
            this.responseCache.delete(entries[i][0]);
        }

        console.log(`🧹 Cleaned up ${toRemove} old cache entries`);
    }

    async precomputeFrequentQueries(): Promise<void> {
        // Identify frequently asked question patterns
        const frequentPatterns = this.identifyFrequentPatterns();

        console.log(`🔮 Precomputing ${frequentPatterns.length} frequent query patterns...`);

        for (const pattern of frequentPatterns.slice(0, 10)) { // Limit precomputation
            if (!this.precomputedResponses.has(pattern)) {
                try {
                    // This would trigger the full pipeline for common queries
                    console.log(`   Precomputing: "${pattern}"`);
                    // Implementation would call the full chain here
                } catch (error) {
                    console.warn(`Failed to precompute: ${pattern}`, error);
                }
            }
        }
    }

    private identifyFrequentPatterns(): string[] {
        const patterns = new Map<string, number>();

        // Analyze cached queries for patterns
        for (const cached of this.responseCache.values()) {
            if (cached.hitCount > 2) { // Queries accessed multiple times
                const pattern = this.extractPattern(cached.query);
                patterns.set(pattern, (patterns.get(pattern) || 0) + cached.hitCount);
            }
        }

        // Return top patterns
        return Array.from(patterns.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 20)
            .map(([pattern]) => pattern);
    }

    private extractPattern(query: string): string {
        // Extract general pattern from specific query
        return query
            .toLowerCase()
            .replace(/\b\d+\b/g, '[NUMBER]') // Replace numbers
            .replace(/\b(kerala|mumbai|delhi|bangalore)\b/g, '[PLACE]') // Replace place names
            .replace(/\b(2020|2021|2022|2023|2024)\b/g, '[YEAR]') // Replace years
            .trim();
    }

    trackPerformance(metrics: PerformanceMetrics): void {
        this.performanceHistory.push({
            ...metrics,
            cacheHitRate: this.calculateCacheHitRate()
        });

        // Keep only recent history
        if (this.performanceHistory.length > 1000) {
            this.performanceHistory = this.performanceHistory.slice(-1000);
        }
    }

    private calculateCacheHitRate(): number {
        if (this.responseCache.size === 0) return 0;

        const totalHits = Array.from(this.responseCache.values())
            .reduce((sum, cached) => sum + cached.hitCount, 0);

        const totalQueries = this.responseCache.size + totalHits;
        return totalQueries > 0 ? totalHits / totalQueries : 0;
    }

    generateOptimizationSuggestions(): OptimizationSuggestion[] {
        const suggestions: OptimizationSuggestion[] = [];
        const recentMetrics = this.performanceHistory.slice(-10);

        if (recentMetrics.length === 0) return suggestions;

        const avgTime = recentMetrics.reduce((sum, m) => sum + m.totalTime, 0) / recentMetrics.length;
        const cacheHitRate = this.calculateCacheHitRate();

        // Caching suggestions
        if (cacheHitRate < 0.3) {
            suggestions.push({
                type: 'caching',
                priority: 'high',
                description: 'Low cache hit rate detected',
                expectedImprovement: '30-50% faster response times',
                implementation: 'Increase cache size and improve semantic similarity matching'
            });
        }

        // Retrieval optimization
        if (avgTime > 5000) {
            suggestions.push({
                type: 'retrieval',
                priority: 'medium',
                description: 'Slow retrieval times detected',
                expectedImprovement: '20-30% faster queries',
                implementation: 'Optimize vector search parameters and implement query preprocessing'
            });
        }

        // Quality vs speed balance
        const avgQuality = recentMetrics.reduce((sum, m) => sum + m.qualityScore, 0) / recentMetrics.length;
        if (avgQuality > 0.9 && avgTime > 3000) {
            suggestions.push({
                type: 'synthesis',
                priority: 'low',
                description: 'High quality but slow synthesis',
                expectedImprovement: '15-25% faster synthesis',
                implementation: 'Implement quality-aware early stopping for simple queries'
            });
        }

        return suggestions;
    }

    getPerformanceStats(): any {
        const recent = this.performanceHistory.slice(-50);
        if (recent.length === 0) return null;

        return {
            avgTotalTime: recent.reduce((sum, m) => sum + m.totalTime, 0) / recent.length,
            avgQualityScore: recent.reduce((sum, m) => sum + m.qualityScore, 0) / recent.length,
            cacheHitRate: this.calculateCacheHitRate(),
            cacheSize: this.responseCache.size,
            totalQueries: this.performanceHistory.length,
            recentTrend: this.calculatePerformanceTrend(recent)
        };
    }

    private calculatePerformanceTrend(metrics: PerformanceMetrics[]): 'improving' | 'declining' | 'stable' {
        if (metrics.length < 10) return 'stable';

        const firstHalf = metrics.slice(0, Math.floor(metrics.length / 2));
        const secondHalf = metrics.slice(Math.floor(metrics.length / 2));

        const firstAvgTime = firstHalf.reduce((sum, m) => sum + m.totalTime, 0) / firstHalf.length;
        const secondAvgTime = secondHalf.reduce((sum, m) => sum + m.totalTime, 0) / secondHalf.length;

        const improvement = (firstAvgTime - secondAvgTime) / firstAvgTime;

        if (improvement > 0.1) return 'improving';
        if (improvement < -0.1) return 'declining';
        return 'stable';
    }

    // Cleanup methods
    clearCache(): void {
        this.responseCache.clear();
        this.queryPatternCache.clear();
        this.precomputedResponses.clear();
        console.log('🧹 All caches cleared');
    }

    clearPerformanceHistory(): void {
        this.performanceHistory = [];
        console.log('📊 Performance history cleared');
    }
}
