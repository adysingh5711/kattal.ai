import { ChatOpenAI } from "@langchain/openai";
import { env } from "./env";
import { QueryAnalysis } from "./query-analyzer";
import { extractJSONFromString } from "./json-utils";
import { DocumentNode } from "./document-graph";

const expanderModel = new ChatOpenAI({
    modelName: env.LLM_MODEL,
    temperature: 0.3, // Slightly more creative for expansions
    openAIApiKey: env.OPENAI_API_KEY,
});

export interface QueryExpansion {
    originalQuery: string;
    expandedQueries: string[];
    synonyms: string[];
    relatedConcepts: string[];
    contextualVariations: string[];
    subQueries: string[];
    translatedQueries?: string[]; // For Malayalam support
}

export interface ContextualInsight {
    insight: string;
    relevantDocuments: string[];
    confidence: number;
    reasoning: string;
}

export class QueryExpander {
    private conceptCache: Map<string, string[]> = new Map();
    private synonymCache: Map<string, string[]> = new Map();

    async expandQuery(
        originalQuery: string,
        analysis: QueryAnalysis,
        chatHistory?: string,
        availableNodes?: DocumentNode[]
    ): Promise<QueryExpansion> {
        console.log(`🔍 Expanding query: "${originalQuery}"`);

        const [
            synonyms,
            relatedConcepts,
            contextualVariations,
            subQueries,
            translatedQueries
        ] = await Promise.all([
            this.generateSynonyms(originalQuery),
            this.generateRelatedConcepts(originalQuery, availableNodes),
            this.generateContextualVariations(originalQuery, chatHistory),
            this.generateSubQueries(originalQuery, analysis),
            this.generateTranslatedQueries(originalQuery)
        ]);

        // Combine all expansions
        const expandedQueries = [
            originalQuery,
            ...synonyms.slice(0, 2),
            ...relatedConcepts.slice(0, 3),
            ...contextualVariations.slice(0, 2),
            ...subQueries.slice(0, 3)
        ].filter((query, index, array) => array.indexOf(query) === index); // Remove duplicates

        return {
            originalQuery,
            expandedQueries,
            synonyms,
            relatedConcepts,
            contextualVariations,
            subQueries,
            translatedQueries
        };
    }

    private async generateSynonyms(query: string): Promise<string[]> {
        if (this.synonymCache.has(query)) {
            return this.synonymCache.get(query)!;
        }

        const synonymPrompt = `Generate 3-5 alternative phrasings for this query that preserve the same meaning:

Original Query: "${query}"

Generate variations that:
1. Use different words but same meaning
2. Rephrase the question structure
3. Use more specific or general terms
4. Include domain-specific terminology if applicable

Return as JSON array: ["variation1", "variation2", ...]

Examples:
"What is the population?" → ["How many people live there?", "What are the demographic numbers?", "Population statistics"]
"Compare A and B" → ["What are the differences between A and B?", "How do A and B differ?", "A versus B analysis"]`;

        try {
            const response = await expanderModel.invoke(synonymPrompt);
            const synonyms = extractJSONFromString(response.content as string);
            const result = Array.isArray(synonyms) ? synonyms : [];
            this.synonymCache.set(query, result);
            return result;
        } catch (error) {
            console.warn('Synonym generation failed:', error);
            return [];
        }
    }

    private async generateRelatedConcepts(query: string, availableNodes?: DocumentNode[]): Promise<string[]> {
        const cacheKey = query + (availableNodes ? '_with_nodes' : '');
        if (this.conceptCache.has(cacheKey)) {
            return this.conceptCache.get(cacheKey)!;
        }

        let conceptPrompt = `Generate related concepts and topics for this query:

Query: "${query}"

Generate concepts that:
1. Are closely related to the main topic
2. Might contain relevant information
3. Include broader and narrower concepts
4. Consider cause-effect relationships
5. Include contextual factors

Return as JSON array: ["concept1", "concept2", ...]`;

        // If we have document nodes, use them for context
        if (availableNodes && availableNodes.length > 0) {
            const availableConcepts = new Set<string>();
            availableNodes.forEach(node => {
                node.concepts.forEach(concept => availableConcepts.add(concept));
                node.keyTopics.forEach(topic => availableConcepts.add(topic));
            });

            conceptPrompt += `\n\nAvailable concepts in the document collection:\n${Array.from(availableConcepts).slice(0, 20).join(', ')}

Focus on concepts that exist in the available documents.`;
        }

        try {
            const response = await expanderModel.invoke(conceptPrompt);
            const concepts = extractJSONFromString(response.content as string);
            const result = Array.isArray(concepts) ? concepts : [];
            this.conceptCache.set(cacheKey, result);
            return result;
        } catch (error) {
            console.warn('Concept generation failed:', error);
            return [];
        }
    }

    private async generateContextualVariations(query: string, chatHistory?: string): Promise<string[]> {
        if (!chatHistory || chatHistory.trim().length === 0) {
            return [];
        }

        const contextPrompt = `Based on the conversation history, generate contextual variations of this query:

Current Query: "${query}"

Recent Conversation:
${chatHistory.slice(-800)}

Generate 2-3 variations that:
1. Incorporate context from previous questions
2. Build on previously discussed topics
3. Reference earlier mentioned entities or concepts
4. Clarify ambiguous terms based on context

Return as JSON array: ["variation1", "variation2", ...]

If the query doesn't benefit from conversation context, return an empty array.`;

        try {
            const response = await expanderModel.invoke(contextPrompt);
            const variations = extractJSONFromString(response.content as string);
            return Array.isArray(variations) ? variations : [];
        } catch (error) {
            console.warn('Contextual variation generation failed:', error);
            return [];
        }
    }

    private async generateSubQueries(query: string, analysis: QueryAnalysis): Promise<string[]> {
        if (analysis.complexity < 3) {
            return []; // Simple queries don't need sub-queries
        }

        const subQueryPrompt = `Break down this complex query into 2-4 simpler sub-questions:

Main Query: "${query}"
Query Type: ${analysis.queryType}
Complexity: ${analysis.complexity}

Generate sub-questions that:
1. Address different aspects of the main question
2. Can be answered independently
3. Build toward answering the main query
4. Cover both direct facts and supporting context

Return as JSON array: ["sub-question1", "sub-question2", ...]

Example:
Main: "Why did the project succeed despite initial challenges?"
Sub: ["What were the initial challenges?", "What strategies were used to overcome them?", "What factors contributed to success?", "How were resources allocated?"]`;

        try {
            const response = await expanderModel.invoke(subQueryPrompt);
            const subQueries = extractJSONFromString(response.content as string);
            return Array.isArray(subQueries) ? subQueries : [];
        } catch (error) {
            console.warn('Sub-query generation failed:', error);
            return [];
        }
    }

    private async generateTranslatedQueries(query: string): Promise<string[]> {
        // Check if query contains English that might benefit from Malayalam context
        const hasEnglishTerms = /[a-zA-Z]/.test(query);
        if (!hasEnglishTerms) {
            return [];
        }

        const translationPrompt = `Generate Malayalam concept variations for this query to help find relevant information in multilingual documents:

Query: "${query}"

Generate 2-3 variations that:
1. Include key Malayalam terms that might appear in documents
2. Use Malayalam administrative/governmental terminology
3. Include common Malayalam phrases for the concepts mentioned

Return as JSON array: ["variation1", "variation2", ...]

Focus on terms commonly used in Kerala government documents, reports, and official communications.`;

        try {
            const response = await expanderModel.invoke(translationPrompt);
            const translated = extractJSONFromString(response.content as string);
            return Array.isArray(translated) ? translated : [];
        } catch (error) {
            console.warn('Translation generation failed:', error);
            return [];
        }
    }

    async generateContextualInsights(
        query: string,
        relatedNodes: DocumentNode[],
        expansion: QueryExpansion
    ): Promise<ContextualInsight[]> {
        if (relatedNodes.length === 0) {
            return [];
        }

        const insightPrompt = `Based on the related documents and query expansion, generate contextual insights:

Original Query: "${query}"
Expanded Concepts: ${expansion.relatedConcepts.join(', ')}

Related Documents:
${relatedNodes.slice(0, 5).map((node, i) =>
            `${i + 1}. ${node.summary} (Topics: ${node.keyTopics.join(', ')})`
        ).join('\n')}

Generate 2-4 insights that:
1. Connect information across multiple documents
2. Identify patterns or trends
3. Highlight important relationships
4. Suggest additional context worth exploring

Return as JSON array:
[
  {
    "insight": "description of the insight",
    "relevantDocuments": ["doc_1", "doc_3"],
    "confidence": 0.8,
    "reasoning": "why this insight is important"
  }
]`;

        try {
            const response = await expanderModel.invoke(insightPrompt);
            const insights = extractJSONFromString(response.content as string);
            return Array.isArray(insights) ? insights : [];
        } catch (error) {
            console.warn('Insight generation failed:', error);
            return [];
        }
    }

    async optimizeQueryForRetrieval(
        originalQuery: string,
        expansion: QueryExpansion,
        documentTypes: string[]
    ): Promise<string> {
        const optimizationPrompt = `Optimize this query for semantic similarity search:

Original Query: "${originalQuery}"
Available Document Types: ${documentTypes.join(', ')}
Related Concepts: ${expansion.relatedConcepts.join(', ')}
Synonyms: ${expansion.synonyms.join(', ')}

Create an optimized search query that:
1. Includes key terms most likely to appear in relevant documents
2. Uses terminology appropriate for the document types
3. Balances specificity with broad coverage
4. Incorporates the most important related concepts

Return just the optimized query string, not JSON.`;

        try {
            const response = await expanderModel.invoke(optimizationPrompt);
            return response.content as string;
        } catch (error) {
            console.warn('Query optimization failed:', error);
            return originalQuery;
        }
    }

    // Utility method to clear caches periodically
    clearCache(): void {
        this.conceptCache.clear();
        this.synonymCache.clear();
    }

    // Get cache statistics for monitoring
    getCacheStats(): { conceptCacheSize: number; synonymCacheSize: number } {
        return {
            conceptCacheSize: this.conceptCache.size,
            synonymCacheSize: this.synonymCache.size
        };
    }
}
