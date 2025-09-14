import { Document } from 'langchain/document';
import { OptimizedVectorStore } from './optimized-vector-store';
import { QueryAnalysis } from './query-analyzer';
import Fuse from 'fuse.js';
// Removed dependency on 'natural' to avoid build-time imports of optional native modules

interface BM25Document {
    id: string;
    content: string;
    metadata: Record<string, unknown>;
    tokens: string[];
    termFreqs: Map<string, number>;
    length: number;
}

interface HybridSearchOptions {
    k?: number; // Enhanced default: 12-15 for better content coverage
    bm25Weight?: number;
    semanticWeight?: number;
    fuseWeight?: number;
    namespace?: string;
    filter?: Record<string, unknown>;
    scoreThreshold?: number;
    enableFuse?: boolean;
}

interface SearchResult {
    document: Document;
    bm25Score: number;
    semanticScore: number;
    fuseScore: number;
    hybridScore: number;
    searchMethod: 'bm25' | 'semantic' | 'fuse' | 'hybrid';
}

interface HybridSearchResult {
    documents: Document[];
    results: SearchResult[];
    searchMetadata: {
        totalResults: number;
        bm25Results: number;
        semanticResults: number;
        fuseResults: number;
        searchTime: number;
        searchStrategy: string;
    };
}

export class HybridSearchEngine {
    private vectorStore: OptimizedVectorStore;
    private bm25Documents: Map<string, BM25Document> = new Map();
    private termDocFreqs: Map<string, number> = new Map();
    private totalDocuments: number = 0;
    private averageDocLength: number = 0;
    private fuse: Fuse<BM25Document> | null = null;
    // Removed TfIdf and WordTokenizer; using internal tokenizer

    // BM25 parameters
    private readonly k1: number = 1.2;
    private readonly b: number = 0.75;

    // Index status
    private isIndexBuilt: boolean = false;
    private lastIndexUpdate: number = 0;

    constructor(vectorStore: OptimizedVectorStore) {
        this.vectorStore = vectorStore;
    }

    /**
     * Build comprehensive search index from documents
     */
    async buildSearchIndex(documents: Document[]): Promise<void> {
        console.log(`🔨 Building hybrid search index for ${documents.length} documents...`);
        const startTime = Date.now();

        // Clear existing indices
        this.bm25Documents.clear();
        this.termDocFreqs.clear();
        // TF-IDF index removed

        // Process documents for BM25 and Fuse
        const processedDocs: BM25Document[] = [];
        let totalLength = 0;

        for (let i = 0; i < documents.length; i++) {
            const doc = documents[i];
            const docId = this.generateDocId(doc, i);

            // Tokenize content
            const tokens = this.tokenizeAdvanced(doc.pageContent);
            const termFreqs = this.calculateTermFrequencies(tokens);

            const bm25Doc: BM25Document = {
                id: docId,
                content: doc.pageContent,
                metadata: doc.metadata || {},
                tokens,
                termFreqs,
                length: tokens.length
            };

            this.bm25Documents.set(docId, bm25Doc);
            processedDocs.push(bm25Doc);
            totalLength += tokens.length;

            // TF-IDF removed

            // Calculate document frequencies
            const uniqueTerms = new Set(tokens);
            for (const term of uniqueTerms) {
                this.termDocFreqs.set(term, (this.termDocFreqs.get(term) || 0) + 1);
            }
        }

        this.totalDocuments = documents.length;
        this.averageDocLength = totalLength / this.totalDocuments;

        // Build Fuse.js index for fuzzy search
        this.fuse = new Fuse(processedDocs, {
            keys: [
                { name: 'content', weight: 0.7 },
                { name: 'metadata.title', weight: 0.2 },
                { name: 'metadata.source', weight: 0.1 }
            ],
            threshold: 0.4,
            includeScore: true,
            includeMatches: true,
            minMatchCharLength: 3,
            ignoreLocation: true
        });

        this.isIndexBuilt = true;
        this.lastIndexUpdate = Date.now();

        const buildTime = Date.now() - startTime;
        console.log(`✅ Hybrid search index built in ${buildTime}ms`);
        console.log(`📊 Index stats: ${this.totalDocuments} docs, ${this.termDocFreqs.size} unique terms, avg length: ${this.averageDocLength.toFixed(1)}`);
    }

    /**
     * Perform intelligent hybrid search
     */
    async intelligentSearch(
        query: string,
        queryAnalysis: QueryAnalysis,
        options: HybridSearchOptions = {}
    ): Promise<HybridSearchResult> {
        if (!this.isIndexBuilt) {
            throw new Error('Search index not built. Call buildSearchIndex() first.');
        }

        const startTime = Date.now();
        const {
            k = 6,
            namespace,
            filter,
            scoreThreshold = 0.1,
            enableFuse = true
        } = options;

        // Determine search strategy based on query analysis
        const searchStrategy = this.determineSearchStrategy(queryAnalysis);
        const weights = this.calculateOptimalWeights(queryAnalysis, searchStrategy);

        console.log(`🔍 Intelligent hybrid search: "${query.slice(0, 50)}..." (strategy: ${searchStrategy})`);
        console.log(`⚖️  Weights - BM25: ${weights.bm25Weight}, Semantic: ${weights.semanticWeight}, Fuse: ${weights.fuseWeight}`);

        // Execute parallel searches
        const searchPromises = [];

        // 1. BM25 Search
        searchPromises.push(this.performBM25Search(query, Math.round(k * 2)));

        // 2. Semantic Search
        searchPromises.push(
            this.vectorStore.optimizedRetrieval(query, {
                k: Math.round(k * 3), // Retrieve more documents for enhanced reasoning (ensure integer)
                namespace,
                filter,
                includeMetadata: true,
                scoreThreshold: 0.5
            })
        );

        // 3. Fuse.js Search (if enabled)
        if (enableFuse) {
            searchPromises.push(this.performFuseSearch(query, Math.round(k * 2)));
        } else {
            searchPromises.push(Promise.resolve([]));
        }

        const [bm25Results, semanticResults, fuseResults] = await Promise.all(searchPromises);

        // Combine and rank results
        const combinedResults = this.combineAndRankResults(
            bm25Results as SearchResult[],
            semanticResults as Document[],
            fuseResults as SearchResult[],
            weights,
            scoreThreshold
        );

        // Select top k results
        const finalResults = combinedResults.slice(0, k);
        const finalDocuments = finalResults.map(result => result.document);

        const searchTime = Date.now() - startTime;
        const searchMetadata = {
            totalResults: combinedResults.length,
            bm25Results: bm25Results.length,
            semanticResults: semanticResults.length,
            fuseResults: (fuseResults as SearchResult[]).length,
            searchTime,
            searchStrategy
        };

        console.log(`✅ Hybrid search complete: ${finalResults.length} results in ${searchTime}ms`);

        return {
            documents: finalDocuments,
            results: finalResults,
            searchMetadata
        };
    }

    /**
     * Determine optimal search strategy based on query analysis
     */
    private determineSearchStrategy(analysis: QueryAnalysis): string {
        const { queryType, complexity, keyEntities } = analysis;

        if (queryType === 'FACTUAL' && keyEntities.length > 0) {
            return 'keyword-heavy'; // Favor BM25
        }

        if (queryType === 'ANALYTICAL' || complexity > 3) {
            return 'semantic-heavy'; // Favor semantic search
        }

        if (queryType === 'COMPARATIVE' || complexity === 2) {
            return 'balanced'; // Equal weights
        }

        return 'adaptive'; // Let the system decide
    }

    /**
     * Calculate optimal weights based on query analysis
     */
    private calculateOptimalWeights(analysis: QueryAnalysis, strategy: string): {
        bm25Weight: number;
        semanticWeight: number;
        fuseWeight: number;
    } {
        switch (strategy) {
            case 'keyword-heavy':
                return { bm25Weight: 0.6, semanticWeight: 0.3, fuseWeight: 0.1 };

            case 'semantic-heavy':
                return { bm25Weight: 0.2, semanticWeight: 0.7, fuseWeight: 0.1 };

            case 'balanced':
                return { bm25Weight: 0.4, semanticWeight: 0.4, fuseWeight: 0.2 };

            case 'adaptive':
            default:
                // Adaptive weighting based on query characteristics
                const entityRatio = analysis.keyEntities.length / Math.max(10, 1); // Assume average query length
                const bm25Weight = Math.min(0.6, 0.3 + entityRatio * 0.3);
                const semanticWeight = Math.min(0.7, 0.4 + (analysis.complexity > 3 ? 0.3 : 0.1));
                const fuseWeight = Math.max(0.1, 1 - bm25Weight - semanticWeight);

                return { bm25Weight, semanticWeight, fuseWeight };
        }
    }

    /**
     * Perform BM25 search
     */
    private async performBM25Search(query: string, k: number): Promise<SearchResult[]> {
        const queryTokens = this.tokenizeAdvanced(query);
        const scores = new Map<string, number>();

        for (const [docId, doc] of this.bm25Documents.entries()) {
            let score = 0;

            for (const term of queryTokens) {
                const tf = doc.termFreqs.get(term) || 0;
                const df = this.termDocFreqs.get(term) || 0;

                if (tf > 0 && df > 0) {
                    const idf = Math.log((this.totalDocuments - df + 0.5) / (df + 0.5));
                    const bm25Score = idf * (tf * (this.k1 + 1)) /
                        (tf + this.k1 * (1 - this.b + this.b * (doc.length / this.averageDocLength)));
                    score += bm25Score;
                }
            }

            if (score > 0) {
                scores.set(docId, score);
            }
        }

        // Sort and return top results
        return Array.from(scores.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, k)
            .map(([docId, score]) => {
                const doc = this.bm25Documents.get(docId)!;
                return {
                    document: new Document({
                        pageContent: doc.content,
                        metadata: {
                            ...doc.metadata,
                            _bm25Score: score,
                            _searchMethod: 'bm25'
                        }
                    }),
                    bm25Score: score,
                    semanticScore: 0,
                    fuseScore: 0,
                    hybridScore: score,
                    searchMethod: 'bm25' as const
                };
            });
    }

    /**
     * Perform Fuse.js fuzzy search
     */
    private async performFuseSearch(query: string, k: number): Promise<SearchResult[]> {
        if (!this.fuse) return [];

        const results = this.fuse.search(query, { limit: k });

        return results.map(result => {
            const doc = result.item;
            const fuseScore = 1 - (result.score || 1); // Invert Fuse score (lower is better)

            return {
                document: new Document({
                    pageContent: doc.content,
                    metadata: {
                        ...doc.metadata,
                        _fuseScore: fuseScore,
                        _searchMethod: 'fuse',
                        _fuseMatches: result.matches
                    }
                }),
                bm25Score: 0,
                semanticScore: 0,
                fuseScore,
                hybridScore: fuseScore,
                searchMethod: 'fuse' as const
            };
        });
    }

    /**
     * Combine and rank all search results
     */
    private combineAndRankResults(
        bm25Results: SearchResult[],
        semanticResults: Document[],
        fuseResults: SearchResult[],
        weights: { bm25Weight: number; semanticWeight: number; fuseWeight: number },
        scoreThreshold: number
    ): SearchResult[] {
        const combinedResults = new Map<string, SearchResult>();

        // Normalize scores
        const bm25Max = Math.max(...bm25Results.map(r => r.bm25Score), 1);
        const semanticMax = Math.max(...semanticResults.map(d => d.metadata?._score as number || 0), 1);
        const fuseMax = Math.max(...fuseResults.map(r => r.fuseScore), 1);

        // Process BM25 results
        for (const result of bm25Results) {
            const key = this.getDocumentKey(result.document);
            const normalizedBM25 = result.bm25Score / bm25Max;

            combinedResults.set(key, {
                ...result,
                bm25Score: normalizedBM25,
                hybridScore: weights.bm25Weight * normalizedBM25
            });
        }

        // Process semantic results
        for (const doc of semanticResults) {
            const key = this.getDocumentKey(doc);
            const semanticScore = (doc.metadata?._score as number || 0) / semanticMax;

            if (combinedResults.has(key)) {
                const existing = combinedResults.get(key)!;
                existing.semanticScore = semanticScore;
                existing.hybridScore = weights.bm25Weight * existing.bm25Score +
                    weights.semanticWeight * semanticScore +
                    weights.fuseWeight * existing.fuseScore;
                existing.searchMethod = 'hybrid';
            } else {
                combinedResults.set(key, {
                    document: doc,
                    bm25Score: 0,
                    semanticScore,
                    fuseScore: 0,
                    hybridScore: weights.semanticWeight * semanticScore,
                    searchMethod: 'semantic'
                });
            }
        }

        // Process Fuse results
        for (const result of fuseResults) {
            const key = this.getDocumentKey(result.document);
            const normalizedFuse = result.fuseScore / fuseMax;

            if (combinedResults.has(key)) {
                const existing = combinedResults.get(key)!;
                existing.fuseScore = normalizedFuse;
                existing.hybridScore = weights.bm25Weight * existing.bm25Score +
                    weights.semanticWeight * existing.semanticScore +
                    weights.fuseWeight * normalizedFuse;
                existing.searchMethod = 'hybrid';
            } else {
                combinedResults.set(key, {
                    document: result.document,
                    bm25Score: 0,
                    semanticScore: 0,
                    fuseScore: normalizedFuse,
                    hybridScore: weights.fuseWeight * normalizedFuse,
                    searchMethod: 'fuse'
                });
            }
        }

        // Filter by score threshold and sort
        return Array.from(combinedResults.values())
            .filter(result => result.hybridScore >= scoreThreshold)
            .sort((a, b) => b.hybridScore - a.hybridScore)
            .map(result => ({
                ...result,
                document: {
                    ...result.document,
                    metadata: {
                        ...result.document.metadata,
                        _hybridScore: result.hybridScore,
                        _bm25Score: result.bm25Score,
                        _semanticScore: result.semanticScore,
                        _fuseScore: result.fuseScore,
                        _searchMethod: result.searchMethod
                    }
                }
            }));
    }

    /**
     * Advanced tokenization with preprocessing
     */
    private tokenizeAdvanced(text: string): string[] {
        // Basic cleanup
        const cleaned = text.toLowerCase()
            .replace(/[^\w\s]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();

        // Simple whitespace tokenizer
        const tokens = cleaned.length > 0 ? cleaned.split(' ') : [];

        // Filter tokens
        return tokens.filter(token =>
            token.length >= 2 &&
            token.length <= 50 &&
            !/^\d+$/.test(token) // Remove pure numbers
        );
    }

    /**
     * Calculate term frequencies
     */
    private calculateTermFrequencies(tokens: string[]): Map<string, number> {
        const freqs = new Map<string, number>();
        for (const token of tokens) {
            freqs.set(token, (freqs.get(token) || 0) + 1);
        }
        return freqs;
    }

    /**
     * Generate unique document ID
     */
    private generateDocId(doc: Document, index: number): string {
        const source = doc.metadata?.source || 'unknown';
        const hash = this.simpleHash(doc.pageContent);
        return `${source}_${index}_${hash}`;
    }

    /**
     * Get document key for deduplication
     */
    private getDocumentKey(doc: Document): string {
        return doc.pageContent.slice(0, 100).replace(/\s+/g, '_');
    }

    /**
     * Simple hash function
     */
    private simpleHash(str: string): string {
        let hash = 0;
        for (let i = 0; i < Math.min(str.length, 50); i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return Math.abs(hash).toString(36);
    }

    /**
     * Get index statistics
     */
    getIndexStats(): {
        isBuilt: boolean;
        totalDocuments: number;
        uniqueTerms: number;
        averageDocLength: number;
        lastUpdate: number;
    } {
        return {
            isBuilt: this.isIndexBuilt,
            totalDocuments: this.totalDocuments,
            uniqueTerms: this.termDocFreqs.size,
            averageDocLength: this.averageDocLength,
            lastUpdate: this.lastIndexUpdate
        };
    }

    /**
     * Health check
     */
    async healthCheck(): Promise<{
        status: 'healthy' | 'degraded' | 'unhealthy';
        issues: string[];
        stats: {
            isBuilt: boolean;
            totalDocuments: number;
            uniqueTerms: number;
            averageDocLength: number;
            lastUpdate: number;
        };
    }> {
        const issues: string[] = [];
        let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

        if (!this.isIndexBuilt) {
            issues.push('Search index not built');
            status = 'unhealthy';
        }

        if (this.totalDocuments === 0) {
            issues.push('No documents indexed');
            status = 'unhealthy';
        }

        if (Date.now() - this.lastIndexUpdate > 24 * 60 * 60 * 1000) {
            issues.push('Index is older than 24 hours');
            if (status === 'healthy') status = 'degraded';
        }

        return {
            status,
            issues,
            stats: this.getIndexStats()
        };
    }
}
