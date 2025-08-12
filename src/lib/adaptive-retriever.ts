import { Document } from "langchain/document";
import { VectorStore } from "@langchain/core/vectorstores";
import { QueryAnalysis } from "./query-analyzer";
import { DocumentGraphBuilder, DocumentNode } from "./document-graph";
import { QueryExpander, QueryExpansion } from "./query-expander";
import { ConversationMemory } from "./conversation-memory";

export interface RetrievalResult {
    documents: Document[];
    retrievalStrategy: string;
    confidence: number;
    crossReferences: string[];
    queryExpansion?: QueryExpansion;
    relatedNodes?: DocumentNode[];
    contextualInsights?: string[];
}

export class AdaptiveRetriever {
    private documentGraph?: DocumentGraphBuilder;
    private queryExpander: QueryExpander;
    private conversationMemory?: ConversationMemory;

    constructor(
        private vectorStore: VectorStore,
        documentGraph?: DocumentGraphBuilder,
        conversationMemory?: ConversationMemory
    ) {
        this.documentGraph = documentGraph;
        this.queryExpander = new QueryExpander();
        this.conversationMemory = conversationMemory;
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
        const strategy = this.selectRetrievalStrategy(analysis);
        let result: RetrievalResult;

        switch (strategy) {
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

    private selectRetrievalStrategy(analysis: QueryAnalysis): string {
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
                k: Math.ceil(analysis.suggestedK / queriesToUse.length),
            });

            const docs = await retriever.invoke(expandedQuery);
            allDocuments.push(...docs);
        }

        // Remove duplicates and prioritize
        const uniqueDocuments = this.prioritizeMultimodalContent(
            this.removeDuplicateDocuments(allDocuments)
        );

        return {
            documents: uniqueDocuments.slice(0, analysis.suggestedK + 4),
            retrievalStrategy: 'graph-enhanced',
            confidence: 0.95,
            crossReferences: queryExpansion.relatedConcepts,
            contextualInsights
        };
    }

    private async standardRetrieval(query: string, analysis: QueryAnalysis): Promise<RetrievalResult> {
        const retriever = this.vectorStore.asRetriever({
            searchType: "similarity",
            k: analysis.suggestedK,
        });

        const documents = await retriever.invoke(query);

        return {
            documents,
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
            documents: allDocuments.slice(0, analysis.suggestedK + 4), // Cap total documents
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
            documents: uniqueDocuments.slice(0, analysis.suggestedK + 2),
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
            documents: sortedDocs.slice(0, analysis.suggestedK + 4),
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
}
