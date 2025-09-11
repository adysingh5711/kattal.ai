import { env } from './env';
import { OpenAIEmbeddings } from "@langchain/openai";
import { PineconeStore } from "@langchain/pinecone";
import { Pinecone, Index, RecordMetadata } from "@pinecone-database/pinecone";
import { Document } from 'langchain/document';
import { DatabaseOptimizer } from './database-optimizer';
import { withRetry, batchExecuteWithRetry, CircuitBreaker, isRetryableError } from './retry-utils';

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
    private cache: Map<string, { data: unknown; timestamp: number }> = new Map();
    private readonly CACHE_TTL = 10 * 60 * 1000; // 10 minutes
    private circuitBreaker: CircuitBreaker;

    constructor() {
        this.connectionPool = PineconeConnectionPool.getInstance();
        this.embeddings = new OpenAIEmbeddings({
            openAIApiKey: env.OPENAI_API_KEY,
            modelName: env.EMBEDDING_MODEL,
            dimensions: env.EMBEDDING_DIMENSIONS,
            // Performance optimizations
            maxConcurrency: 5, // Limit concurrent requests
            maxRetries: 3,
        });

        this.optimizer = new DatabaseOptimizer({
            embeddingModel: env.EMBEDDING_MODEL,
            embeddingDimensions: env.EMBEDDING_DIMENSIONS,
            batchSize: 100,
            useNamespaces: true,
            namespaceStrategy: 'hybrid'
        });

        this.circuitBreaker = new CircuitBreaker(5, 60000); // 5 failures, 1 minute reset
    }

    /**
     * Validate vector before storage
     */
    private validateVector(vector: number[], docId: string): boolean {
        if (!vector || vector.length === 0) {
            console.warn(`⚠️  Empty vector for document: ${docId}`);
            return false;
        }

        // Check for zero vector (all values are 0)
        const isZeroVector = vector.every(val => val === 0);
        if (isZeroVector) {
            console.warn(`⚠️  Zero vector detected for document: ${docId}`);
            return false;
        }

        // Check for NaN or infinite values
        const hasInvalidValues = vector.some(val => !isFinite(val));
        if (hasInvalidValues) {
            console.warn(`⚠️  Invalid values (NaN/Infinity) in vector for document: ${docId}`);
            return false;
        }

        // Check vector magnitude (should not be too small)
        const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
        if (magnitude < 1e-8) {
            console.warn(`⚠️  Vector magnitude too small for document: ${docId}`);
            return false;
        }

        return true;
    }

    /**
     * Sanitize metadata for Pinecone storage
     */
    private sanitizeMetadata(metadata: Record<string, unknown>): Record<string, string | number | boolean | string[]> {
        const sanitized: Record<string, string | number | boolean | string[]> = {};

        for (const [key, value] of Object.entries(metadata)) {
            // Only allow simple data types that Pinecone supports
            if (value === null || value === undefined) {
                continue;
            } else if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
                sanitized[key] = value;
            } else if (Array.isArray(value)) {
                // Only allow arrays of strings
                const stringArray = value.filter(item => typeof item === 'string');
                if (stringArray.length > 0) {
                    sanitized[key] = stringArray;
                }
            } else {
                // Convert complex objects to string representation
                try {
                    sanitized[key] = JSON.stringify(value);
                } catch (error) {
                    console.warn(`Failed to serialize metadata field '${key}':`, error);
                    sanitized[key] = String(value);
                }
            }
        }

        return sanitized;
    }

    async embedAndStoreDocs(docs: Document[]): Promise<void> {
        console.log(`🚀 Starting optimized document embedding for ${docs.length} documents...`);
        const startTime = Date.now();

        try {
            // Step 1: Validate documents have content
            const validDocs = docs.filter(doc => {
                if (!doc.pageContent || doc.pageContent.trim().length === 0) {
                    console.warn(`⚠️  Skipping document with empty content: ${doc.metadata?.source || 'unknown'}`);
                    return false;
                }
                return true;
            });

            if (validDocs.length === 0) {
                throw new Error('No valid documents to embed');
            }

            console.log(`📋 Processing ${validDocs.length} valid documents (${docs.length - validDocs.length} skipped)`);

            // Step 2: Optimize documents for ingestion
            const optimizedDocs = await this.optimizer.optimizeDocumentIngestion(validDocs);
            console.log(`📆 Optimized ${validDocs.length} → ${optimizedDocs.length} documents`);

            // Step 3: Generate embeddings with retry logic
            const client = await this.connectionPool.getClient();
            const index = client.Index(env.PINECONE_INDEX_NAME);

            // Use batch processing with retry logic
            const batchResult = await batchExecuteWithRetry(
                optimizedDocs,
                25, // Smaller batch size for better reliability
                async (batch: Document[]) => {
                    return await this.circuitBreaker.execute(async () => {
                        return await this.processBatchWithRetry(batch, index);
                    });
                },
                {
                    maxRetries: 3,
                    baseDelay: 2000,
                    onProgress: (completed, total, currentBatch) => {
                        console.log(`📊 Progress: ${completed}/${total} documents (batch ${currentBatch})`);
                    },
                    onBatchError: (batch, error, batchIndex) => {
                        console.error(`❌ Batch ${batchIndex + 1} failed permanently:`, error.message);
                    }
                }
            );

            const totalTime = Date.now() - startTime;
            console.log(`✅ Embedding complete in ${(totalTime / 1000).toFixed(2)}s`);
            console.log(`📈 Results: ${batchResult.results.length} processed, ${batchResult.errors.length} failed batches`);

            if (batchResult.errors.length > 0) {
                console.warn(`⚠️  ${batchResult.errors.length} batches failed - some documents may not be indexed`);
            }

            // Clear cache after new data ingestion
            this.clearCache();

        } catch (error) {
            console.error('❌ Optimized embedding failed:', error);
            throw new Error(`Failed to embed and store documents: ${error}`);
        }
    }

    /**
     * Process a batch of documents with retry logic
     */
    private async processBatchWithRetry(
        batch: Document[],
        index: Index<RecordMetadata>
    ): Promise<string[]> {
        const results: string[] = [];

        // Generate embeddings with retry
        const embeddings = await withRetry(
            () => this.embeddings.embedDocuments(batch.map(doc => doc.pageContent)),
            {
                maxRetries: 3,
                baseDelay: 1000,
                retryCondition: isRetryableError
            }
        );

        if (!embeddings.success || !embeddings.result) {
            throw embeddings.error || new Error('Failed to generate embeddings');
        }

        // Validate vectors and prepare for upsert
        const validVectors: Array<{ id: string; values: number[]; metadata: Record<string, string | number | boolean | string[]> }> = [];

        for (let j = 0; j < batch.length; j++) {
            const doc = batch[j];
            const embedding = embeddings.result[j];
            const docId = `${doc.metadata?.source || 'unknown'}_${Date.now()}_${j}`;

            // Validate vector before storing
            if (this.validateVector(embedding, docId)) {
                const sanitizedMetadata = this.sanitizeMetadata({
                    text: doc.pageContent,
                    ...doc.metadata
                });

                validVectors.push({
                    id: docId,
                    values: embedding,
                    metadata: sanitizedMetadata
                });
                results.push(docId);
            }
        }

        // Upsert with retry
        if (validVectors.length > 0) {
            const upsertResult = await withRetry(
                () => index.upsert(validVectors as any), // Fixed: Type conversion issue
                {
                    maxRetries: 3,
                    baseDelay: 2000,
                    retryCondition: isRetryableError
                }
            );

            if (!upsertResult.success) {
                throw upsertResult.error || new Error('Failed to upsert vectors');
            }

            console.log(`✅ Batch complete: ${validVectors.length} vectors stored`);
        }

        return results;
    }

    async getVectorStore(namespace?: string): Promise<PineconeStore> {
        const cacheKey = `vectorstore_${namespace || 'default'}`;
        const cached = this.getCachedItem(cacheKey);

        if (cached) {
            console.log(`💾 Using cached vector store for namespace: ${namespace || 'default'}`);
            return cached.data as PineconeStore;
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
            filter?: Record<string, unknown>;
            includeMetadata?: boolean;
            scoreThreshold?: number;
        } = {}
    ): Promise<Document<Record<string, unknown>>[]> {
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
            return cached.data as Document<Record<string, unknown>>[];
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
                filteredResults = results.filter((doc: Document) => {
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
            boostFactors?: Record<string, number>;
        } = {}
    ): Promise<Document[]> {
        const {
            k = 6,
            namespaces = ['default'],
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
                    // Fixed: Type '{}' cannot be used as an index type
                    // Create a new object with the default values to ensure proper typing
                    const defaultFactors: Record<string, number> = { table: 1.2, chart: 1.1, multimodal: 1.3 };
                    const factors = { ...defaultFactors, ...boostFactors };
                    // Use a safer approach to access the boost factor
                    const boost = factors[contentType as keyof typeof factors] || 1.0;

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
        filter: Record<string, unknown>,
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

    async analyzePerformance(): Promise<unknown> {
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

    private getCachedItem(key: string): { data: unknown; timestamp: number } | null {
        const cached = this.cache.get(key);
        if (!cached) return null;

        const { data, timestamp } = cached;
        const now = Date.now();

        if (now - timestamp > this.CACHE_TTL) {
            this.cache.delete(key);
            return null;
        }

        return { data, timestamp };
    }

    private setCachedItem(key: string, data: unknown): void {
        this.cache.set(key, {
            data,
            timestamp: Date.now()
        });

        // Cleanup old entries periodically
        if (this.cache.size > 100) {
            this.cleanupCache();
        }
    }

    private hashQuery(query: string, options: Record<string, unknown>): string {
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
        metrics: unknown;
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
