import { Pinecone } from "@pinecone-database/pinecone";
import { Document } from "langchain/document";
import { OpenAIEmbeddings } from "@langchain/openai";
import { PineconeStore } from "@langchain/pinecone";
import { env } from "./env";

export interface DatabaseOptimizationConfig {
    // Index Configuration
    indexName: string;
    dimension: number;
    metric: 'cosine' | 'euclidean' | 'dotproduct';
    cloud: 'aws' | 'gcp' | 'azure';
    region: string;

    // Performance Settings
    batchSize: number;
    maxRetries: number;
    requestTimeout: number;

    // Embedding Configuration
    embeddingModel: string;
    embeddingDimensions?: number;

    // Chunking Strategy
    chunkSize: number;
    chunkOverlap: number;
    maxChunksPerDocument: number;

    // Namespace Strategy
    useNamespaces: boolean;
    namespaceStrategy: 'content_type' | 'document_source' | 'hybrid' | 'none';

    // Metadata Optimization
    includeFullText: boolean;
    metadataFields: string[];
    maxMetadataSize: number;
}

export interface DatabaseMetrics {
    totalVectors: number;
    indexUtilization: number;
    averageQueryLatency: number;
    embeddingCost: number;
    storageCost: number;
    queryThroughput: number;
}

export class DatabaseOptimizer {
    private client: Pinecone;
    private config: DatabaseOptimizationConfig;
    private embeddings: OpenAIEmbeddings;

    constructor(config?: Partial<DatabaseOptimizationConfig>) {
        this.config = {
            // Optimal defaults based on analysis
            indexName: env.PINECONE_INDEX_NAME,
            dimension: env.EMBEDDING_DIMENSIONS,
            metric: 'cosine', // Best for semantic similarity
            cloud: 'aws',
            region: 'us-east-1',

            // Performance optimizations
            batchSize: 100, // Optimal batch size for Pinecone
            maxRetries: 3,
            requestTimeout: 30000,

            // Embedding settings
            embeddingModel: env.EMBEDDING_MODEL,
            embeddingDimensions: env.EMBEDDING_DIMENSIONS,

            // Chunking optimization
            chunkSize: 1500, // Balanced for context vs performance
            chunkOverlap: 300, // 20% overlap for continuity
            maxChunksPerDocument: 50, // Prevent document explosion

            // Namespace strategy
            useNamespaces: true,
            namespaceStrategy: 'hybrid', // content_type + document_source

            // Metadata optimization
            includeFullText: false, // Store in metadata only if needed
            metadataFields: ['source', 'pageNumber', 'chunkType', 'hasVisuals', 'hasTables', 'hasCharts'],
            maxMetadataSize: 8000, // Pinecone limit is 40KB, keep reasonable

            ...config
        };

        this.client = new Pinecone({ apiKey: env.PINECONE_API_KEY });
        this.embeddings = new OpenAIEmbeddings({
            openAIApiKey: env.OPENAI_API_KEY,
            modelName: this.config.embeddingModel,
            dimensions: this.config.embeddingDimensions
        });
    }

    /**
     * Get configuration
     */
    getConfig(): DatabaseOptimizationConfig {
        return this.config;
    }

    async analyzeCurrentDatabase(): Promise<{
        recommendations: string[];
        metrics: DatabaseMetrics;
        issues: string[];
        optimizations: string[];
    }> {
        console.log("🔍 Analyzing current database configuration...");

        const recommendations: string[] = [];
        const issues: string[] = [];
        const optimizations: string[] = [];

        try {
            const index = this.client.Index(this.config.indexName);
            const stats = await index.describeIndexStats();

            // Analyze index configuration
            const indexInfo = await this.client.describeIndex(this.config.indexName);

            console.log("📊 Current Index Stats:", {
                totalVectorCount: stats.totalRecordCount || 0,
                dimension: stats.dimension,
                indexFullness: stats.indexFullness
            });

            // Check dimension optimization based on current embedding model
            const expectedDimensions = env.EMBEDDING_DIMENSIONS;
            if (stats.dimension !== expectedDimensions) {
                issues.push(`Using ${stats.dimension} dimensions instead of configured ${expectedDimensions} for ${env.EMBEDDING_MODEL}`);
                recommendations.push(`Ensure index dimensions match embedding model: ${env.EMBEDDING_MODEL} (${expectedDimensions} dimensions)`);
            }

            // Check index fullness
            if (stats.indexFullness && stats.indexFullness > 0.8) {
                issues.push("Index is over 80% full - performance may degrade");
                recommendations.push("Consider upgrading index tier or implementing data archival strategy");
            }

            // Check namespace usage
            const namespaceCount = Object.keys(stats.namespaces || {}).length;
            if (namespaceCount === 0) {
                optimizations.push("Implement namespace strategy to organize vectors by content type");
            }

            // Performance recommendations
            const totalRecords = stats.totalRecordCount || 0;
            if (totalRecords > 100000) {
                optimizations.push("Consider implementing vector compression for large datasets");
                optimizations.push("Implement query result caching for frequently accessed vectors");
            }

            const metrics: DatabaseMetrics = {
                totalVectors: totalRecords,
                indexUtilization: stats.indexFullness || 0,
                averageQueryLatency: 0, // Would need query logs to calculate
                embeddingCost: this.estimateEmbeddingCost(totalRecords),
                storageCost: this.estimateStorageCost(totalRecords),
                queryThroughput: 0 // Would need query logs to calculate
            };

            return { recommendations, metrics, issues, optimizations };

        } catch (error) {
            console.error("Database analysis failed:", error);
            issues.push("Failed to analyze database - check connection and permissions");
            return { recommendations, metrics: this.getDefaultMetrics(), issues, optimizations };
        }
    }

    async optimizeIndexConfiguration(): Promise<void> {
        console.log("⚡ Optimizing index configuration...");

        try {
            // Check if index exists and get current config
            const indexList = await this.client.listIndexes();
            const existingIndex = indexList.indexes?.find(idx => idx.name === this.config.indexName);

            if (existingIndex) {
                console.log("📋 Current index configuration:", existingIndex);

                // Check if reconfiguration is needed
                const needsRecreation =
                    existingIndex.dimension !== this.config.dimension ||
                    existingIndex.metric !== this.config.metric;

                if (needsRecreation) {
                    console.log("⚠️  Index needs recreation for optimal configuration");
                    console.log("   Current:", {
                        dimension: existingIndex.dimension,
                        metric: existingIndex.metric
                    });
                    console.log("   Optimal:", {
                        dimension: this.config.dimension,
                        metric: this.config.metric
                    });

                    // Note: In production, you'd want to backup data first
                    console.log("💡 Recommendation: Backup data, delete index, recreate with optimal settings");
                }
            } else {
                // Create optimized index
                await this.createOptimizedIndex();
            }

        } catch (error) {
            console.error("Index optimization failed:", error);
            throw new Error("Failed to optimize index configuration");
        }
    }

    private async createOptimizedIndex(): Promise<void> {
        console.log("🏗️  Creating optimized index...");

        const indexConfig = {
            name: this.config.indexName,
            dimension: this.config.dimension,
            metric: this.config.metric,
            spec: {
                serverless: {
                    cloud: this.config.cloud,
                    region: this.config.region
                }
            }
        };

        await this.client.createIndex(indexConfig);
        console.log("✅ Optimized index created successfully");

        // Wait for index to be ready
        await this.waitForIndexReady();
    }

    private async waitForIndexReady(): Promise<void> {
        console.log("⏳ Waiting for index to be ready...");

        let attempts = 0;
        const maxAttempts = 30; // 5 minutes max

        while (attempts < maxAttempts) {
            try {
                const indexInfo = await this.client.describeIndex(this.config.indexName);
                if (indexInfo.status?.ready) {
                    console.log("✅ Index is ready!");
                    return;
                }

                console.log(`   Index status: ${indexInfo.status?.state}, attempt ${attempts + 1}/${maxAttempts}`);
                await new Promise(resolve => setTimeout(resolve, 10000)); // Wait 10 seconds
                attempts++;

            } catch (error) {
                console.log(`   Checking index status... (${attempts + 1}/${maxAttempts})`);
                await new Promise(resolve => setTimeout(resolve, 10000));
                attempts++;
            }
        }

        throw new Error("Index failed to become ready within timeout period");
    }

    async optimizeDocumentIngestion(documents: Document[]): Promise<Document[]> {
        console.log(`🔄 Optimizing ${documents.length} documents for ingestion...`);

        const optimizedDocs: Document[] = [];

        for (const doc of documents) {
            // Optimize metadata
            const optimizedMetadata = this.optimizeMetadata(doc.metadata || {});

            // Optimize content length
            let content = doc.pageContent;
            if (content.length > this.config.chunkSize * 2) {
                console.log(`📏 Content too long (${content.length} chars), splitting...`);
                const chunks = this.splitLongContent(content, doc.metadata || {});
                optimizedDocs.push(...chunks);
            } else {
                optimizedDocs.push(new Document({
                    pageContent: content,
                    metadata: optimizedMetadata
                }));
            }
        }

        console.log(`✅ Optimized to ${optimizedDocs.length} documents`);
        return optimizedDocs;
    }

    private optimizeMetadata(metadata: Record<string, any>): Record<string, any> {
        const optimized: Record<string, any> = {};

        // Only include configured fields
        for (const field of this.config.metadataFields) {
            if (metadata[field] !== undefined) {
                optimized[field] = metadata[field];
            }
        }

        // Add namespace information
        if (this.config.useNamespaces) {
            optimized.namespace = this.generateNamespace(metadata);
        }

        // Ensure metadata size limit
        const metadataStr = JSON.stringify(optimized);
        if (metadataStr.length > this.config.maxMetadataSize) {
            console.warn("⚠️  Metadata too large, truncating...");
            // Remove less important fields if needed
            delete optimized.fullText;
            delete optimized.summary;
        }

        return optimized;
    }

    private generateNamespace(metadata: Record<string, any>): string {
        switch (this.config.namespaceStrategy) {
            case 'content_type':
                return metadata.chunkType || 'text';

            case 'document_source':
                const source = metadata.source || 'unknown';
                return source.replace(/[^a-zA-Z0-9-_]/g, '_').toLowerCase();

            case 'hybrid':
                const contentType = metadata.chunkType || 'text';
                const sourceShort = (metadata.source || 'doc').split('/').pop()?.split('.')[0] || 'unknown';
                return `${contentType}_${sourceShort}`.toLowerCase();

            default:
                return 'default';
        }
    }

    private splitLongContent(content: string, metadata: Record<string, any>): Document[] {
        const chunks: Document[] = [];
        const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);

        let currentChunk = '';
        let chunkIndex = 0;

        for (const sentence of sentences) {
            if (currentChunk.length + sentence.length > this.config.chunkSize && currentChunk.length > 0) {
                chunks.push(new Document({
                    pageContent: currentChunk.trim(),
                    metadata: {
                        ...metadata,
                        chunkIndex: chunkIndex++,
                        isLongContentSplit: true
                    }
                }));
                currentChunk = sentence;
            } else {
                currentChunk += sentence + '. ';
            }

            // Prevent too many chunks from single document
            if (chunks.length >= this.config.maxChunksPerDocument) {
                break;
            }
        }

        // Add final chunk
        if (currentChunk.trim().length > 0) {
            chunks.push(new Document({
                pageContent: currentChunk.trim(),
                metadata: {
                    ...metadata,
                    chunkIndex: chunkIndex++,
                    isLongContentSplit: true
                }
            }));
        }

        return chunks;
    }

    async batchUpsertOptimized(documents: Document[]): Promise<void> {
        console.log(`📤 Starting optimized batch upsert for ${documents.length} documents...`);

        const index = this.client.Index(this.config.indexName);
        const batches = this.createBatches(documents, this.config.batchSize);

        let processedCount = 0;
        const startTime = Date.now();

        for (let i = 0; i < batches.length; i++) {
            const batch = batches[i];
            console.log(`   Processing batch ${i + 1}/${batches.length} (${batch.length} documents)...`);

            try {
                // Generate embeddings for batch
                const texts = batch.map(doc => doc.pageContent);
                const embeddings = await this.embeddings.embedDocuments(texts);

                // Prepare vectors for upsert
                const vectors = batch.map((doc, idx) => ({
                    id: this.generateVectorId(doc, idx + processedCount),
                    values: embeddings[idx],
                    metadata: doc.metadata
                }));

                // Group by namespace for efficient upsert
                const namespaceGroups = this.groupByNamespace(vectors);

                for (const [namespace, namespaceVectors] of namespaceGroups.entries()) {
                    const namespaceIndex = namespace === 'default' ? index : index.namespace(namespace);
                    await namespaceIndex.upsert(namespaceVectors);
                }

                processedCount += batch.length;

                // Rate limiting to avoid overwhelming the service
                if (i < batches.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, 100));
                }

            } catch (error) {
                console.error(`❌ Batch ${i + 1} failed:`, error);

                // Retry with smaller batch size
                if (batch.length > 10) {
                    console.log("   Retrying with smaller batches...");
                    const smallerBatches = this.createBatches(batch, 10);
                    for (const smallBatch of smallerBatches) {
                        await this.batchUpsertOptimized(smallBatch);
                    }
                }
            }
        }

        const totalTime = Date.now() - startTime;
        const avgTimePerDoc = totalTime / processedCount;

        console.log(`✅ Batch upsert completed:`);
        console.log(`   Documents processed: ${processedCount}`);
        console.log(`   Total time: ${(totalTime / 1000).toFixed(2)}s`);
        console.log(`   Average time per document: ${avgTimePerDoc.toFixed(2)}ms`);
    }

    private createBatches<T>(items: T[], batchSize: number): T[][] {
        const batches: T[][] = [];
        for (let i = 0; i < items.length; i += batchSize) {
            batches.push(items.slice(i, i + batchSize));
        }
        return batches;
    }

    private generateVectorId(doc: Document, index: number): string {
        const source = doc.metadata?.source || 'unknown';
        const sourceId = source.replace(/[^a-zA-Z0-9]/g, '_');
        const chunkIndex = doc.metadata?.chunkIndex || index;
        return `${sourceId}_chunk_${chunkIndex}`;
    }

    private groupByNamespace(vectors: any[]): Map<string, any[]> {
        const groups = new Map<string, any[]>();

        for (const vector of vectors) {
            const namespace = vector.metadata?.namespace || 'default';
            if (!groups.has(namespace)) {
                groups.set(namespace, []);
            }
            groups.get(namespace)!.push(vector);
        }

        return groups;
    }

    private estimateEmbeddingCost(vectorCount: number): number {
        // Embedding costs vary by model - use environment configured model
        const costPer1MTokens = env.EMBEDDING_MODEL.includes('3-large') ? 0.13 :
            env.EMBEDDING_MODEL.includes('3-small') ? 0.02 :
                env.EMBEDDING_MODEL.includes('ada-002') ? 0.0001 : 0.13;

        // Assume average 500 tokens per chunk
        const totalTokens = vectorCount * 500;
        return (totalTokens / 1000000) * costPer1MTokens;
    }

    private estimateStorageCost(vectorCount: number): number {
        // Pinecone serverless: ~$0.000005 per vector per hour
        // Monthly cost for 3072-dimensional vectors
        const monthlyHours = 24 * 30;
        return vectorCount * 0.000005 * monthlyHours;
    }

    private getDefaultMetrics(): DatabaseMetrics {
        return {
            totalVectors: 0,
            indexUtilization: 0,
            averageQueryLatency: 0,
            embeddingCost: 0,
            storageCost: 0,
            queryThroughput: 0
        };
    }

    async generateOptimizationReport(): Promise<string> {
        const analysis = await this.analyzeCurrentDatabase();

        let report = "# Database Optimization Report\n\n";

        report += "## Current Metrics\n";
        report += `- Total Vectors: ${analysis.metrics.totalVectors.toLocaleString()}\n`;
        report += `- Index Utilization: ${(analysis.metrics.indexUtilization * 100).toFixed(1)}%\n`;
        report += `- Estimated Monthly Embedding Cost: $${analysis.metrics.embeddingCost.toFixed(2)}\n`;
        report += `- Estimated Monthly Storage Cost: $${analysis.metrics.storageCost.toFixed(2)}\n\n`;

        if (analysis.issues.length > 0) {
            report += "## Issues Found\n";
            analysis.issues.forEach((issue, i) => {
                report += `${i + 1}. ⚠️  ${issue}\n`;
            });
            report += "\n";
        }

        if (analysis.recommendations.length > 0) {
            report += "## Recommendations\n";
            analysis.recommendations.forEach((rec, i) => {
                report += `${i + 1}. ✅ ${rec}\n`;
            });
            report += "\n";
        }

        if (analysis.optimizations.length > 0) {
            report += "## Optimization Opportunities\n";
            analysis.optimizations.forEach((opt, i) => {
                report += `${i + 1}. 🚀 ${opt}\n`;
            });
            report += "\n";
        }

        report += "## Best Practices Summary\n";
        report += `- ✅ Using ${env.EMBEDDING_MODEL} (${env.EMBEDDING_DIMENSIONS} dimensions) for embeddings\n`;
        report += "- ✅ Implement namespace strategy for better organization\n";
        report += "- ✅ Optimize chunk sizes (1500-2000 chars) for context vs performance\n";
        report += "- ✅ Use batch operations for efficient ingestion\n";
        report += "- ✅ Implement caching for frequently accessed queries\n";
        report += "- ✅ Monitor index utilization and upgrade when needed\n";
        report += "- ✅ Use cosine similarity for semantic search\n";
        report += "- ✅ Optimize metadata to include only necessary fields\n";

        return report;
    }
}
