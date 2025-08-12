import { env } from './env';
import { OpenAIEmbeddings } from "@langchain/openai";
import { PineconeStore } from "@langchain/pinecone";
import { Pinecone } from "@pinecone-database/pinecone";
import { Document } from 'langchain/document';
import { DatabaseOptimizer } from './database-optimizer';

// Connection pool for better performance
class PineconeConnectionPool {
    private static instance: PineconeConnectionPool;
    private client: Pinecone | null = null;
    private lastUsed: number = 0;
    private readonly IDLE_TIMEOUT = 5 * 60 * 1000; // 5 minutes

    static getInstance(): PineconeConnectionPool {
        if (!PineconeConnectionPool.instance) {
            PineconeConnectionPool.instance = new PineconeConnectionPool();
        }
        return PineconeConnectionPool.instance;
    }

    async getClient(): Promise<Pinecone> {
        const now = Date.now();

        // Reuse existing connection if recent
        if (this.client && (now - this.lastUsed) < this.IDLE_TIMEOUT) {
            this.lastUsed = now;
            return this.client;
        }

        // Create new connection
        this.client = new Pinecone({
            apiKey: env.PINECONE_API_KEY,
        });

        this.lastUsed = now;
        return this.client;
    }
}

export class OptimizedVectorStore {
    private connectionPool: PineconeConnectionPool;
    private embeddings: OpenAIEmbeddings;
    private optimizer: DatabaseOptimizer;
    private cache: Map<string, any> = new Map();
    private readonly CACHE_TTL = 10 * 60 * 1000; // 10 minutes

    constructor() {
        this.connectionPool = PineconeConnectionPool.getInstance();
        this.embeddings = new OpenAIEmbeddings({
            openAIApiKey: env.OPENAI_API_KEY,
            modelName: "text-embedding-3-large",
            dimensions: 3072,
            // Performance optimizations
            maxConcurrency: 5, // Limit concurrent requests
            maxRetries: 3,
        });

        this.optimizer = new DatabaseOptimizer({
            embeddingModel: "text-embedding-3-large",
            embeddingDimensions: 3072,
            batchSize: 100,
            useNamespaces: true,
            namespaceStrategy: 'hybrid'
        });
    }

    async embedAndStoreDocs(docs: Document[]): Promise<void> {
        console.log(`🚀 Starting optimized document embedding for ${docs.length} documents...`);
        const startTime = Date.now();

        try {
            // Step 1: Optimize documents for ingestion
            const optimizedDocs = await this.optimizer.optimizeDocumentIngestion(docs);
            console.log(`📊 Optimized ${docs.length} → ${optimizedDocs.length} documents`);

            // Step 2: Get optimized client
            const client = await this.connectionPool.getClient();

            // Step 3: Batch upsert with optimization
            await this.optimizer.batchUpsertOptimized(optimizedDocs);

            const totalTime = Date.now() - startTime;
            console.log(`✅ Embedding complete in ${(totalTime / 1000).toFixed(2)}s`);

            // Clear cache after new data ingestion
            this.clearCache();

        } catch (error) {
            console.error('❌ Optimized embedding failed:', error);
            throw new Error('Failed to embed and store documents optimally');
        }
    }

    async getVectorStore(namespace?: string): Promise<PineconeStore> {
        const cacheKey = `vectorstore_${namespace || 'default'}`;
        const cached = this.getCachedItem(cacheKey);

        if (cached) {
            console.log(`💾 Using cached vector store for namespace: ${namespace || 'default'}`);
            return cached;
        }

        try {
            const client = await this.connectionPool.getClient();
            const index = client.Index(env.PINECONE_INDEX_NAME);

            // Use namespace if specified
            const pineconeIndex = namespace ? index.namespace(namespace) : index;

            const vectorStore = await PineconeStore.fromExistingIndex(this.embeddings, {
                pineconeIndex,
                textKey: 'text',
                namespace: namespace
            });

            // Cache the vector store
            this.setCachedItem(cacheKey, vectorStore);

            return vectorStore;
        } catch (error) {
            console.error('❌ Failed to get optimized vector store:', error);
            throw new Error('Failed to initialize optimized vector store');
        }
    }

    async optimizedRetrieval(
        query: string,
        options: {
            k?: number;
            namespace?: string;
            filter?: Record<string, any>;
            includeMetadata?: boolean;
            scoreThreshold?: number;
        } = {}
    ): Promise<Document[]> {
        const {
            k = 6,
            namespace,
            filter,
            includeMetadata = true,
            scoreThreshold = 0.7
        } = options;

        // Check cache first
        const cacheKey = `query_${this.hashQuery(query, options)}`;
        const cached = this.getCachedItem(cacheKey);
        if (cached) {
            console.log(`💾 Cache hit for query: "${query.slice(0, 50)}..."`);
            return cached;
        }

        console.log(`🔍 Optimized retrieval: "${query.slice(0, 50)}..." (k=${k}, namespace=${namespace || 'default'})`);

        try {
            const vectorStore = await this.getVectorStore(namespace);

            // Create optimized retriever
            const retriever = vectorStore.asRetriever({
                searchType: "similarity",
                k: k * 1.5, // Retrieve more, then filter
                filter: filter
            });

            // Get results
            const results = await retriever.invoke(query);

            // Post-process results
            let filteredResults = results;

            // Apply score threshold if available
            if (scoreThreshold > 0) {
                filteredResults = results.filter((doc: any) => {
                    const score = doc.metadata?._score || 1;
                    return score >= scoreThreshold;
                });
            }

            // Limit to requested k
            filteredResults = filteredResults.slice(0, k);

            // Enhance metadata
            if (includeMetadata) {
                filteredResults = filteredResults.map(doc => ({
                    ...doc,
                    metadata: {
                        ...doc.metadata,
                        retrievalTimestamp: new Date().toISOString(),
                        namespace: namespace || 'default',
                        queryHash: this.hashQuery(query, options)
                    }
                }));
            }

            // Cache results
            this.setCachedItem(cacheKey, filteredResults);

            console.log(`✅ Retrieved ${filteredResults.length} documents`);
            return filteredResults;

        } catch (error) {
            console.error('❌ Optimized retrieval failed:', error);
            throw new Error('Failed to retrieve documents optimally');
        }
    }

    async hybridSearch(
        query: string,
        options: {
            k?: number;
            namespaces?: string[];
            contentTypes?: string[];
            boostFactors?: Record<string, number>;
        } = {}
    ): Promise<Document[]> {
        const {
            k = 6,
            namespaces = ['default'],
            contentTypes = ['text', 'table', 'chart', 'multimodal'],
            boostFactors = { table: 1.2, chart: 1.1, multimodal: 1.3 }
        } = options;

        console.log(`🔄 Hybrid search across ${namespaces.length} namespaces for: "${query.slice(0, 50)}..."`);

        const allResults: Document[] = [];
        const resultsPerNamespace = Math.ceil(k / namespaces.length);

        // Search across multiple namespaces
        for (const namespace of namespaces) {
            try {
                const results = await this.optimizedRetrieval(query, {
                    k: resultsPerNamespace,
                    namespace,
                    includeMetadata: true
                });

                // Apply content type boosting
                const boostedResults = results.map(doc => {
                    const contentType = doc.metadata?.chunkType || 'text';
                    const boost = boostFactors[contentType] || 1.0;

                    return {
                        ...doc,
                        metadata: {
                            ...doc.metadata,
                            relevanceBoost: boost,
                            searchNamespace: namespace
                        }
                    };
                });

                allResults.push(...boostedResults);
            } catch (error) {
                console.warn(`⚠️  Search failed for namespace ${namespace}:`, error);
            }
        }

        // Sort by relevance (considering boosts)
        const sortedResults = allResults.sort((a, b) => {
            const scoreA = (a.metadata?._score || 0) * (a.metadata?.relevanceBoost || 1);
            const scoreB = (b.metadata?._score || 0) * (b.metadata?.relevanceBoost || 1);
            return scoreB - scoreA;
        });

        // Remove duplicates and limit results
        const uniqueResults = this.removeDuplicateDocuments(sortedResults);
        const finalResults = uniqueResults.slice(0, k);

        console.log(`✅ Hybrid search returned ${finalResults.length} documents from ${namespaces.length} namespaces`);
        return finalResults;
    }

    async getDocumentsByMetadata(
        filter: Record<string, any>,
        options: {
            k?: number;
            namespace?: string;
        } = {}
    ): Promise<Document[]> {
        const { k = 10, namespace } = options;

        console.log(`📋 Metadata search:`, filter);

        try {
            const client = await this.connectionPool.getClient();
            const index = client.Index(env.PINECONE_INDEX_NAME);
            const pineconeIndex = namespace ? index.namespace(namespace) : index;

            // Query by metadata filter
            const queryResponse = await pineconeIndex.query({
                vector: new Array(3072).fill(0), // Dummy vector for metadata-only search
                topK: k,
                includeMetadata: true,
                filter: filter
            });

            // Convert to Document format
            const documents = queryResponse.matches?.map(match => new Document({
                pageContent: (match.metadata?.text as string) || '',
                metadata: match.metadata || {}
            })) || [];

            console.log(`✅ Found ${documents.length} documents matching metadata filter`);
            return documents;

        } catch (error) {
            console.error('❌ Metadata search failed:', error);
            return [];
        }
    }

    async analyzePerformance(): Promise<any> {
        console.log("📊 Analyzing vector store performance...");

        const report = await this.optimizer.generateOptimizationReport();

        // Additional performance metrics
        const cacheStats = {
            cacheSize: this.cache.size,
            cacheHitRate: this.calculateCacheHitRate(),
            oldestCacheEntry: this.getOldestCacheEntry()
        };

        return {
            optimizationReport: report,
            cacheStats,
            recommendations: this.getPerformanceRecommendations()
        };
    }

    private getCachedItem(key: string): any {
        const cached = this.cache.get(key);
        if (!cached) return null;

        const { data, timestamp } = cached;
        const now = Date.now();

        if (now - timestamp > this.CACHE_TTL) {
            this.cache.delete(key);
            return null;
        }

        return data;
    }

    private setCachedItem(key: string, data: any): void {
        this.cache.set(key, {
            data,
            timestamp: Date.now()
        });

        // Cleanup old entries periodically
        if (this.cache.size > 100) {
            this.cleanupCache();
        }
    }

    private hashQuery(query: string, options: any): string {
        const combined = JSON.stringify({ query, options });
        let hash = 0;
        for (let i = 0; i < combined.length; i++) {
            const char = combined.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return Math.abs(hash).toString(36);
    }

    private removeDuplicateDocuments(documents: Document[]): Document[] {
        const seen = new Set<string>();
        return documents.filter(doc => {
            const key = doc.pageContent.slice(0, 100);
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    }

    private cleanupCache(): void {
        const now = Date.now();
        const entries = Array.from(this.cache.entries());

        // Remove expired entries
        entries.forEach(([key, value]) => {
            if (now - value.timestamp > this.CACHE_TTL) {
                this.cache.delete(key);
            }
        });

        // If still too large, remove oldest entries
        if (this.cache.size > 100) {
            const sortedEntries = entries
                .sort((a, b) => a[1].timestamp - b[1].timestamp)
                .slice(0, this.cache.size - 80); // Keep newest 80 entries

            sortedEntries.forEach(([key]) => this.cache.delete(key));
        }

        console.log(`🧹 Cache cleanup: ${this.cache.size} entries remaining`);
    }

    private calculateCacheHitRate(): number {
        // This would need hit/miss tracking in a real implementation
        return 0.75; // Placeholder
    }

    private getOldestCacheEntry(): number {
        let oldest = Date.now();
        for (const [, value] of this.cache.entries()) {
            if (value.timestamp < oldest) {
                oldest = value.timestamp;
            }
        }
        return Date.now() - oldest;
    }

    private getPerformanceRecommendations(): string[] {
        const recommendations = [];

        if (this.cache.size > 50) {
            recommendations.push("Consider implementing Redis for distributed caching");
        }

        if (this.calculateCacheHitRate() < 0.5) {
            recommendations.push("Improve query caching strategy - low hit rate detected");
        }

        recommendations.push("Monitor embedding costs and consider batch processing");
        recommendations.push("Implement query result pre-warming for common queries");

        return recommendations;
    }

    clearCache(): void {
        this.cache.clear();
        console.log("🧹 Vector store cache cleared");
    }

    async healthCheck(): Promise<{
        status: 'healthy' | 'degraded' | 'unhealthy';
        metrics: any;
        issues: string[];
    }> {
        const issues: string[] = [];
        let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

        try {
            // Test connection
            const client = await this.connectionPool.getClient();
            const indexStats = await client.Index(env.PINECONE_INDEX_NAME).describeIndexStats();

            // Check index health
            if (indexStats.indexFullness && indexStats.indexFullness > 0.9) {
                issues.push("Index is over 90% full");
                status = 'degraded';
            }

            // Test query performance
            const testStart = Date.now();
            await this.optimizedRetrieval("test query", { k: 1 });
            const queryTime = Date.now() - testStart;

            if (queryTime > 5000) {
                issues.push("Query response time is slow (>5s)");
                status = status === 'healthy' ? 'degraded' : status;
            }

            return {
                status,
                metrics: {
                    totalVectors: indexStats.totalRecordCount || 0,
                    indexFullness: indexStats.indexFullness,
                    queryLatency: queryTime,
                    cacheSize: this.cache.size,
                    cacheHitRate: this.calculateCacheHitRate()
                },
                issues
            };

        } catch (error) {
            return {
                status: 'unhealthy',
                metrics: {},
                issues: [`Database connection failed: ${error}`]
            };
        }
    }
}
