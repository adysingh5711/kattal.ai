import { Document } from "langchain/document";
import { VectorStore } from "@langchain/core/vectorstores";
import { QueryAnalysis } from "./query-analyzer";
import { DocumentGraphBuilder, DocumentNode } from "./document-graph";
import { QueryExpander, QueryExpansion } from "./query-expander";
import { ConversationMemory } from "./conversation-memory";
import { HybridSearchEngine } from "./hybrid-search-engine";
import { OptimizedVectorStore } from "./optimized-vector-store";

export interface RetrievalResult {
    documents: Document[];
    retrievalStrategy: string;
    confidence: number;
    crossReferences: string[];
    queryExpansion?: QueryExpansion;
    relatedNodes?: DocumentNode[];
    contextualInsights?: string[];
    hybridSearchMetadata?: {
        searchTime: number;
        bm25Results: number;
        semanticResults: number;
        fuseResults: number;
        searchStrategy: string;
    };
}

export class AdaptiveRetriever {
    private documentGraph?: DocumentGraphBuilder;
    private queryExpander: QueryExpander;
    private conversationMemory?: ConversationMemory;
    private hybridSearchEngine?: HybridSearchEngine;

    constructor(
        private vectorStore: VectorStore,
        documentGraph?: DocumentGraphBuilder,
        conversationMemory?: ConversationMemory,
        hybridSearchEngine?: HybridSearchEngine
    ) {
        this.documentGraph = documentGraph;
        this.queryExpander = new QueryExpander();
        this.conversationMemory = conversationMemory;
        this.hybridSearchEngine = hybridSearchEngine;

        // Initialize hybrid search if vector store is OptimizedVectorStore
        if (!this.hybridSearchEngine && vectorStore instanceof OptimizedVectorStore) {
            this.hybridSearchEngine = new HybridSearchEngine(vectorStore);
        }
    }

    async retrieve(query: string, analysis: QueryAnalysis, chatHistory?: string): Promise<RetrievalResult> {
        console.log(`🔍 Starting enhanced retrieval for: "${query}"`);

        // Step 1: Expand the query with related concepts and variations
        const availableNodes = this.documentGraph ? await this.getAvailableNodes() : undefined;
        const queryExpansion = await this.queryExpander.expandQuery(
            query,
            analysis,
            chatHistory,
            availableNodes
        );

        console.log(`📝 Query expanded to ${queryExpansion.expandedQueries.length} variations`);

        // Step 2: Select and execute retrieval strategy
        const strategy = await this.selectRetrievalStrategy(analysis);
        let result: RetrievalResult;

        switch (strategy) {
            case 'hybrid-intelligent':
                result = await this.hybridIntelligentRetrieval(query, analysis, queryExpansion);
                break;
            case 'graph-enhanced':
                result = await this.graphEnhancedRetrieval(query, analysis, queryExpansion);
                break;
            case 'multi-hop':
                result = await this.multiHopRetrieval(query, analysis, queryExpansion);
                break;
            case 'comparative':
                result = await this.comparativeRetrieval(query, analysis, queryExpansion);
                break;
            case 'comprehensive':
                result = await this.comprehensiveRetrieval(query, analysis, queryExpansion);
                break;
            default:
                result = await this.standardRetrieval(query, analysis);
        }

        // Step 3: Enhance result with expansion data
        result.queryExpansion = queryExpansion;

        console.log(`✅ Retrieved ${result.documents.length} documents using ${result.retrievalStrategy}`);
        return result;
    }

    private async getAvailableNodes(): Promise<DocumentNode[]> {
        // This would typically be cached or stored
        // For now, return empty array - in real implementation,
        // you'd maintain the document graph
        return [];
    }

    private async selectRetrievalStrategy(analysis: QueryAnalysis): Promise<string> {
        // Prioritize hybrid search when available
        if (this.hybridSearchEngine) {
            try {
                const healthCheck = await this.hybridSearchEngine.healthCheck();
                if (healthCheck.status === 'healthy') {
                    return 'hybrid-intelligent';
                }
            } catch (error) {
                console.warn('Hybrid search health check failed, falling back to other strategies:', error);
            }
        }

        if (this.documentGraph && analysis.complexity >= 4) {
            return 'graph-enhanced';
        }
        if (analysis.complexity >= 4 && analysis.requiresCrossReference) {
            return 'multi-hop';
        }
        if (analysis.queryType === 'COMPARATIVE') {
            return 'comparative';
        }
        if (analysis.queryType === 'SYNTHETIC' || analysis.queryType === 'INFERENTIAL') {
            return 'comprehensive';
        }
        return 'standard';
    }

    private async graphEnhancedRetrieval(
        query: string,
        analysis: QueryAnalysis,
        queryExpansion: QueryExpansion
    ): Promise<RetrievalResult> {
        const allDocuments: Document[] = [];
        const contextualInsights: string[] = [];

        if (!this.documentGraph) {
            // Fallback to multi-hop if no graph available
            return await this.multiHopRetrieval(query, analysis, queryExpansion);
        }

        // Use multiple expanded queries for comprehensive retrieval
        const queriesToUse = queryExpansion.expandedQueries.slice(0, 4);

        for (const expandedQuery of queriesToUse) {
            const retriever = this.vectorStore.asRetriever({
                searchType: "similarity",
                k: Math.ceil(analysis.suggestedK * 1.8 / queriesToUse.length), // Increased for more content (already rounded)
            });

            const docs = await retriever.invoke(expandedQuery);
            allDocuments.push(...docs);
        }

        // Remove duplicates and prioritize
        const uniqueDocuments = this.prioritizeMultimodalContent(
            this.removeDuplicateDocuments(allDocuments)
        );

        return {
            documents: uniqueDocuments.slice(0, analysis.suggestedK * 2 + 6), // More documents for reasoning
            retrievalStrategy: 'graph-enhanced',
            confidence: 0.95,
            crossReferences: queryExpansion.relatedConcepts,
            contextualInsights
        };
    }

    private async standardRetrieval(query: string, analysis: QueryAnalysis): Promise<RetrievalResult> {
        console.log(`🔍 Starting enhanced retrieval for: "${query}"`);

        // Check if this is a person query (like IB Sateesh)
        const isPersonQuery = query.toLowerCase().includes('സതീഷ്') || query.toLowerCase().includes('sateesh');

        let documents: Document[] = [];

        // If we have an OptimizedVectorStore, use its namespace features
        if ('optimizedRetrieval' in this.vectorStore) {
            console.log(`✅ Using OptimizedVectorStore with namespace support`);
            const optimizedStore = this.vectorStore as any; // Cast to access optimizedRetrieval

            if (isPersonQuery) {
                console.log(`👤 Person query detected for "${query}", searching prioritized namespaces`);

                // Priority namespaces for person queries
                const priorityNamespaces = [
                    'table_public_docs_pdf_md_website_scraped_pdfs_md_activityreport2018_2019_md',
                    'table_public_docs_pdf_md_website_scraped_pdfs_md_activityreport2017_2018_md',
                    'table_public_docs_pdf_md_website_scraped_pdfs_md_waterqualityreport_md',
                    'table_public_docs_pdf_md_website_scraped_site_content_md',
                    'heading_public_docs_pdf_md_website_scraped_pdfs_md_activityreport2018_2019_md',
                    'text_public_docs_pdf_md_website_scraped_pdfs_md_activityreport2018_2019_md',
                    'text_public_docs_pdf_md_website_scraped_pdfs_md_activityreport2017_2018_md',
                    'list_public_docs_pdf_md_website_scraped_pdfs_md_activityreport2018_2019_md'
                ];

                // Search across priority namespaces
                console.log(`🎯 Searching ${priorityNamespaces.length} priority namespaces for IB Sateesh`);
                for (const namespace of priorityNamespaces.slice(0, 6)) {
                    try {
                        console.log(`   🔍 Searching: ${namespace.slice(-50)}...`);
                        const namespaceDocs = await optimizedStore.optimizedRetrieval(query, {
                            k: 3,
                            namespace,
                            scoreThreshold: 0.01,
                            includeMetadata: true
                        });
                        console.log(`   📄 Found ${namespaceDocs.length} docs in this namespace`);
                        documents.push(...namespaceDocs);

                        if (documents.length >= analysis.suggestedK) break;
                    } catch (error) {
                        console.warn(`❌ Failed to search namespace ${namespace}:`, error);
                    }
                }

                console.log(`📚 Total documents found: ${documents.length}`);
            } else {
                // Standard optimized retrieval
                documents = await optimizedStore.optimizedRetrieval(query, {
                    k: Math.round(analysis.suggestedK * 1.5),
                    scoreThreshold: 0.3,
                    includeMetadata: true
                });
            }
        } else {
            // Fallback to standard vector store retrieval
            const retriever = this.vectorStore.asRetriever({
                searchType: "similarity",
                k: Math.round(analysis.suggestedK * 1.5),
            });
            documents = await retriever.invoke(query);
        }

        return {
            documents: documents.slice(0, analysis.suggestedK),
            retrievalStrategy: 'standard',
            confidence: 0.8,
            crossReferences: []
        };
    }

    private async multiHopRetrieval(query: string, analysis: QueryAnalysis, queryExpansion?: QueryExpansion): Promise<RetrievalResult> {
        const allDocuments: Document[] = [];
        const crossReferences: string[] = [];

        // Step 1: Initial retrieval
        const initialRetriever = this.vectorStore.asRetriever({
            searchType: "similarity",
            k: Math.min(analysis.suggestedK, 8),
        });

        const initialDocs = await initialRetriever.invoke(query);
        allDocuments.push(...initialDocs);

        // Step 2: Extract key entities and concepts from initial results
        const keyTerms = this.extractKeyTerms(initialDocs, analysis.keyEntities);

        // Step 3: Secondary retrieval based on discovered terms
        for (const term of keyTerms.slice(0, 3)) { // Limit to top 3 terms
            const secondaryQuery = `${term} related to ${query}`;
            const secondaryDocs = await initialRetriever.invoke(secondaryQuery);

            // Add unique documents only
            const uniqueDocs = secondaryDocs.filter(doc =>
                !allDocuments.some(existing =>
                    existing.pageContent === doc.pageContent
                )
            );

            allDocuments.push(...uniqueDocs.slice(0, 2)); // Limit secondary docs
            crossReferences.push(term);
        }

        return {
            documents: allDocuments.slice(0, analysis.suggestedK * 2 + 8), // More documents for reasoning
            retrievalStrategy: 'multi-hop',
            confidence: 0.9,
            crossReferences
        };
    }

    private async comparativeRetrieval(query: string, analysis: QueryAnalysis, queryExpansion?: QueryExpansion): Promise<RetrievalResult> {
        const allDocuments: Document[] = [];

        // Extract comparison entities from the query
        const entities = analysis.keyEntities.length > 0
            ? analysis.keyEntities
            : this.extractComparisonEntities(query);

        // Retrieve documents for each entity separately
        for (const entity of entities.slice(0, 3)) { // Limit to 3 entities
            const entityQuery = `${entity} ${query}`;
            const retriever = this.vectorStore.asRetriever({
                searchType: "similarity",
                k: Math.ceil(analysis.suggestedK / entities.length),
            });

            const entityDocs = await retriever.invoke(entityQuery);
            allDocuments.push(...entityDocs);
        }

        // Also do a general retrieval
        const generalRetriever = this.vectorStore.asRetriever({
            searchType: "similarity",
            k: Math.ceil(analysis.suggestedK / 2),
        });

        const generalDocs = await generalRetriever.invoke(query);
        allDocuments.push(...generalDocs);

        // Remove duplicates
        const uniqueDocuments = this.removeDuplicateDocuments(allDocuments);

        return {
            documents: uniqueDocuments.slice(0, analysis.suggestedK * 1.8 + 4), // More for comparisons
            retrievalStrategy: 'comparative',
            confidence: 0.85,
            crossReferences: entities
        };
    }

    private async comprehensiveRetrieval(query: string, analysis: QueryAnalysis, queryExpansion?: QueryExpansion): Promise<RetrievalResult> {
        const allDocuments: Document[] = [];

        // Use multiple retrieval approaches
        const approaches = [
            { query: query, weight: 1.0 },
            { query: `background context ${query}`, weight: 0.7 },
            { query: `implications of ${query}`, weight: 0.6 },
            { query: `factors affecting ${query}`, weight: 0.5 }
        ];

        for (const approach of approaches) {
            const retriever = this.vectorStore.asRetriever({
                searchType: "similarity",
                k: Math.ceil(analysis.suggestedK * approach.weight),
            });

            const docs = await retriever.invoke(approach.query);
            allDocuments.push(...docs);
        }

        // Prioritize documents with multiple content types
        const sortedDocs = this.prioritizeMultimodalContent(
            this.removeDuplicateDocuments(allDocuments)
        );

        return {
            documents: sortedDocs.slice(0, analysis.suggestedK * 2 + 6), // More for synthesis
            retrievalStrategy: 'comprehensive',
            confidence: 0.92,
            crossReferences: analysis.keyEntities
        };
    }

    private extractKeyTerms(documents: Document[], existingEntities: string[]): string[] {
        // Simple keyword extraction from document content
        const allText = documents.map(doc => doc.pageContent).join(' ');
        const words = allText.toLowerCase().split(/\s+/);

        // Count word frequency (excluding common words)
        const stopWords = new Set(['the', 'is', 'at', 'which', 'on', 'and', 'or', 'but', 'in', 'with', 'a', 'an', 'as', 'are', 'was', 'were', 'been', 'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'should', 'could', 'can', 'may', 'might', 'must', 'shall', 'to', 'of', 'for', 'by', 'from', 'up', 'about', 'into', 'through', 'during', 'before', 'after', 'above', 'below', 'between', 'among', 'this', 'that', 'these', 'those']);

        const wordFreq = new Map<string, number>();
        words.forEach(word => {
            if (word.length > 3 && !stopWords.has(word)) {
                wordFreq.set(word, (wordFreq.get(word) || 0) + 1);
            }
        });

        // Get top frequent terms not already in entities
        const topTerms = Array.from(wordFreq.entries())
            .sort((a, b) => b[1] - a[1])
            .map(([word]) => word)
            .filter(word => !existingEntities.some(entity =>
                entity.toLowerCase().includes(word) || word.includes(entity.toLowerCase())
            ))
            .slice(0, 5);

        return topTerms;
    }

    private extractComparisonEntities(query: string): string[] {
        // Simple entity extraction for comparison queries
        const comparisonWords = ['vs', 'versus', 'compared to', 'compare', 'between', 'and'];
        const lowerQuery = query.toLowerCase();

        // Look for patterns like "A vs B" or "compare A and B"
        for (const word of comparisonWords) {
            if (lowerQuery.includes(word)) {
                const parts = query.split(new RegExp(word, 'i'));
                if (parts.length >= 2) {
                    return parts.map(part => part.trim()).filter(part => part.length > 0);
                }
            }
        }

        // Fallback: split on common separators
        return query.split(/[,;]/).map(part => part.trim()).filter(part => part.length > 0);
    }

    private removeDuplicateDocuments(documents: Document[]): Document[] {
        const seen = new Set<string>();
        return documents.filter(doc => {
            const key = doc.pageContent.slice(0, 100); // Use first 100 chars as key
            if (seen.has(key)) {
                return false;
            }
            seen.add(key);
            return true;
        });
    }

    private prioritizeMultimodalContent(documents: Document[]): Document[] {
        // Sort documents to prioritize those with tables, charts, or visual analysis
        return documents.sort((a, b) => {
            const aScore = this.getContentScore(a);
            const bScore = this.getContentScore(b);
            return bScore - aScore;
        });
    }

    private getContentScore(doc: Document): number {
        let score = 1; // Base score
        const content = doc.pageContent.toLowerCase();
        const metadata = doc.metadata || {};

        // Boost for multimodal content
        if (content.includes('visual analysis:')) score += 2;
        if (content.includes('table')) score += 1.5;
        if (content.includes('chart') || content.includes('graph')) score += 1.5;
        if (metadata.hasTables) score += 1;
        if (metadata.hasCharts) score += 1;
        if (metadata.hasVisuals) score += 1;

        // Boost for longer, more detailed content
        if (doc.pageContent.length > 1000) score += 0.5;
        if (doc.pageContent.length > 2000) score += 0.5;

        return score;
    }

    /**
     * Hybrid intelligent retrieval using BM25 + semantic search
     */
    private async hybridIntelligentRetrieval(
        query: string,
        analysis: QueryAnalysis,
        queryExpansion?: QueryExpansion
    ): Promise<RetrievalResult> {
        if (!this.hybridSearchEngine) {
            console.warn('Hybrid search engine not available, falling back to standard retrieval');
            return this.standardRetrieval(query, analysis);
        }

        console.log(`🔀 Performing hybrid intelligent retrieval`);

        try {
            const startTime = Date.now();

            // Use the intelligent search with query expansion
            const primaryQuery = query;
            const expandedQueries = queryExpansion?.expandedQueries || [query];

            // Execute hybrid search with the primary query
            const hybridResult = await this.hybridSearchEngine.intelligentSearch(
                primaryQuery,
                analysis,
                {
                    k: analysis.suggestedK + 2,
                    scoreThreshold: 0.1,
                    enableFuse: true,
                    // Don't specify namespace to search across all namespaces
                }
            );

            // If we have query expansion, also search with expanded queries
            const additionalDocs: Document[] = [];
            if (expandedQueries.length > 1 && hybridResult.documents.length < analysis.suggestedK) {
                console.log(`📚 Searching with ${expandedQueries.length - 1} expanded queries`);

                for (const expandedQuery of expandedQueries.slice(1, 3)) { // Limit to 2 additional queries
                    try {
                        const expandedResult = await this.hybridSearchEngine.intelligentSearch(
                            expandedQuery,
                            analysis,
                            {
                                k: Math.ceil(analysis.suggestedK / 2),
                                scoreThreshold: 0.15,
                                enableFuse: false, // Disable fuse for expanded queries to save time
                                // Don't specify namespace to search across all namespaces
                            }
                        );
                        additionalDocs.push(...expandedResult.documents);
                    } catch (error) {
                        console.warn(`Failed to search expanded query "${expandedQuery}":`, error);
                    }
                }
            }

            // Combine and deduplicate results
            const allDocs = [...hybridResult.documents, ...additionalDocs];
            const uniqueDocs = this.removeDuplicateDocuments(allDocs);
            const finalDocs = this.prioritizeMultimodalContent(uniqueDocs).slice(0, analysis.suggestedK * 1.8); // More content for reasoning

            // Extract cross-references from retrieved documents
            const crossReferences = this.extractKeyTerms(finalDocs, analysis.keyEntities);

            // Calculate confidence based on hybrid search results
            const avgHybridScore = hybridResult.results.reduce((sum, r) => sum + r.hybridScore, 0) /
                (hybridResult.results.length || 1);
            const confidence = Math.min(0.95, 0.7 + (avgHybridScore * 0.25));

            const retrievalTime = Date.now() - startTime;
            console.log(`✅ Hybrid intelligent retrieval complete: ${finalDocs.length} docs, confidence: ${(confidence * 100).toFixed(1)}%, time: ${retrievalTime}ms`);

            return {
                documents: finalDocs,
                retrievalStrategy: 'hybrid-intelligent',
                confidence,
                crossReferences,
                contextualInsights: this.generateContextualInsights(finalDocs, query, analysis),
                hybridSearchMetadata: {
                    searchTime: hybridResult.searchMetadata.searchTime,
                    bm25Results: hybridResult.searchMetadata.bm25Results,
                    semanticResults: hybridResult.searchMetadata.semanticResults,
                    fuseResults: hybridResult.searchMetadata.fuseResults,
                    searchStrategy: hybridResult.searchMetadata.searchStrategy
                }
            };

        } catch (error) {
            console.error('Hybrid intelligent retrieval failed:', error);
            console.log('Falling back to standard retrieval');
            return this.standardRetrieval(query, analysis);
        }
    }

    /**
     * Generate contextual insights from hybrid search results
     */
    private generateContextualInsights(documents: Document[], query: string, analysis: QueryAnalysis): string[] {
        const insights: string[] = [];

        // Analyze document sources
        const sources = new Set(documents.map(doc => doc.metadata?.source).filter(Boolean));
        if (sources.size > 1) {
            insights.push(`Information found across ${sources.size} different sources`);
        }

        // Analyze search method distribution
        const searchMethods = documents.map(doc => doc.metadata?._searchMethod).filter(Boolean);
        const bm25Count = searchMethods.filter(method => method === 'bm25').length;
        const semanticCount = searchMethods.filter(method => method === 'semantic').length;
        const hybridCount = searchMethods.filter(method => method === 'hybrid').length;

        if (bm25Count > semanticCount) {
            insights.push('Results primarily from keyword matching - highly specific content found');
        } else if (semanticCount > bm25Count) {
            insights.push('Results primarily from semantic understanding - conceptually related content found');
        } else if (hybridCount > 0) {
            insights.push('Results from combined search methods - comprehensive coverage achieved');
        }

        // Analyze content diversity
        const contentTypes = new Set();
        documents.forEach(doc => {
            if (doc.metadata?.chunkType) contentTypes.add(doc.metadata.chunkType);
        });

        if (contentTypes.size > 1) {
            insights.push(`Found diverse content types: ${Array.from(contentTypes).join(', ')}`);
        }

        return insights;
    }

}
