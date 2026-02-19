import 'server-only';
// import { createRetrievalChain } from "langchain/chains/retrieval";
// import { createStuffDocumentsChain } from "langchain/chains/combine_documents";
// import { createHistoryAwareRetriever } from "langchain/chains/history_aware_retriever";
// import { ChatPromptTemplate, MessagesPlaceholder } from "@langchain/core/prompts";
// import { HumanMessage, AIMessage } from "@langchain/core/messages";
// import { streamingModel, nonStreamingModel } from "./llm";
// import { QA_TEMPLATE } from "./prompt-templates";
// Enhanced LangChain integration for Malayalam system with chat history context
// Features: Reference resolution, follow-up detection, context-aware caching

import { getPinecone } from "./pinecone-client";
import {
    // isEnvironmentalQuery,
    // executeEnvironmentalDataTool,
    // extractParametersFromQuery,
    // type EnvironmentalToolResult
} from "./ai-tools";
import { getCachedQuery, setCachedQuery, logCachePerformance } from "./query-cache";
import { env } from "./env";

// Chat history utility functions
function extractRecentContext(chatHistory: string, maxLines: number = 4): string {
    if (!chatHistory) return '';
    const lines = chatHistory.split('\n').filter(line => line.trim());
    return lines.slice(-maxLines).join('\n');
}

function hasConversationalReferences(query: string): boolean {
    const referenceWords = ['അത്', 'ഇത്', 'അവിടെ', 'ഇവിടെ', 'അവർ', 'അവൻ', 'അവൾ', 'it', 'that', 'there', 'they', 'he', 'she', 'more', 'കൂടുതൽ', 'വീണ്ടും', 'again'];
    return referenceWords.some(ref => query.toLowerCase().includes(ref.toLowerCase()));
}

// Simplified interfaces for streamlined system
interface ValidationResult {
    overallScore: number;
    factualAccuracy: number;
    completeness: number;
    coherence: number;
    sourceReliability: number;
    responseQuality: number;
    issues: Array<{
        type: 'factual_error' | 'missing_info' | 'coherence_issue' | 'source_problem' | 'tone_issue';
        severity: 'low' | 'medium' | 'high';
        description: string;
        suggestion: string;
        affectedSection?: string;
    }>;
    improvements: string[];
    confidence: number;
}

// Mock query analysis for simplified system
interface QueryAnalysis {
    queryType: string;
    complexity: number;
    keyEntities: string[];
    requiresCrossReference: boolean;
    dataTypesNeeded: string[];
    reasoningSteps: string[];
    suggestedK: number;
}

// Simplified query analyzer
class SimpleQueryAnalyzer {
    private extractEntitiesFromHistory(chatHistory: string): string[] {
        const entities = [];
        const historyLower = chatHistory.toLowerCase();

        // Extract previously mentioned entities
        if (historyLower.includes('കാട്ടക്കട') || historyLower.includes('kattakada')) entities.push('Kattakada');
        if (historyLower.includes('മലയിൻകീഴ്') || historyLower.includes('malayinkeezhu')) entities.push('Malayinkeezhu');
        if (historyLower.includes('മാറനല്ലൂർ') || historyLower.includes('maranalloor')) entities.push('Maranalloor');
        if (historyLower.includes('പള്ളിച്ചൽ') || historyLower.includes('pallichal')) entities.push('Pallichal');
        if (historyLower.includes('വിളപ്പിൽ') || historyLower.includes('vilappil')) entities.push('Vilappil');
        if (historyLower.includes('വിളവൂർക്കൽ') || historyLower.includes('vilavoorkal')) entities.push('Vilavoorkal');
        if (historyLower.includes('കപ്പ') || historyLower.includes('tapioca')) entities.push('Tapioca');
        if (historyLower.includes('കൃഷി') || historyLower.includes('cultivation')) entities.push('Agriculture');
        if (historyLower.includes('തിരുവനന്തപുരം') || historyLower.includes('thiruvananthapuram')) entities.push('Thiruvananthapuram');
        if (historyLower.includes('ആശുപത്രി') || historyLower.includes('hospital')) entities.push('Hospital');
        if (historyLower.includes('എം.എൽ.എ') || historyLower.includes('mla')) entities.push('MLA');

        return entities;
    }

    private resolveReferences(query: string, chatHistory?: string): string {
        if (!chatHistory) return query;

        const referenceWords = ['അത്', 'ഇത്', 'അവിടെ', 'ഇവിടെ', 'അവർ', 'അവൻ', 'അവൾ', 'it', 'that', 'there', 'they', 'he', 'she'];
        const queryLower = query.toLowerCase();

        // Check if query contains references
        const hasReferences = referenceWords.some(ref => queryLower.includes(ref));

        if (hasReferences) {
            // Extract last mentioned entities from chat history for context
            const historyEntities = this.extractEntitiesFromHistory(chatHistory);

            // Create enriched query with context
            const contextualQuery = `${query} [Previous context: ${historyEntities.join(', ')}]`;
            return contextualQuery;
        }

        return query;
    }

    async expandQuery(query: string, chatHistory?: string): Promise<string> {
        // Skip expansion for very short queries without history
        if (query.split(' ').length < 3 && !chatHistory) return query;

        try {
            const { nonStreamingModel } = await import('./llm');

            const systemPrompt = `You are an expert query optimizer for a RAG (Retrieval Augmented Generation) system specializing in Kerala Legislative Assembly data.
            
Your task is to REWRITE and EXPAND the user's query to improve valid document retrieval.
1. Resolve any pronouns (it, he, she, they, etc.) using the Chat History.
2. Add relevant context keywords (e.g., "Kattakada constituency", "MLA I.B. Sateesh", "Kerala", "Official Report") if implied.
3. If the query is in Malayalam, keep it in Malayalam but add English keywords in parentheses if helpful for search.
4. If the query is in English, keep it in English.
5. DO NOT answer the question. ONLY output the optimized query string.

Chat History:
${chatHistory || 'None'}

User Query: ${query}

Optimized Search Query:`;

            // Add timeout of 5 seconds to ensure quick response
            const responsePromise = nonStreamingModel.invoke(systemPrompt);
            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Expansion timeout after 5000ms')), 5000)
            );

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const response = await Promise.race([responsePromise, timeoutPromise]) as any;
            const expanded = response.content.trim();

            // Safety check: if expansion is too long or completely different, revert to original
            if (expanded.length > query.length * 5 && query.length > 10) {
                return query;
            }

            return expanded;
        } catch (e) {
            console.warn('⚠️ Query expansion skipped:', e instanceof Error ? e.message : String(e));
            return query;
        }
    }

    async classifyQuery(query: string, chatHistory?: string): Promise<QueryAnalysis> {
        // Resolve references using chat history
        const resolvedQuery = this.resolveReferences(query, chatHistory);
        const lowerQuery = resolvedQuery.toLowerCase();

        // Enhanced classification for better document retrieval
        let queryType = 'FACTUAL';
        let complexity = 2; // Start with higher baseline for better retrieval

        // Enhanced Malayalam query analysis
        const malayalamQuestionWords = ['എന്ത്', 'എങ്ങനെ', 'എവിടെ', 'എപ്പോൾ', 'ആര്', 'എന്തുകൊണ്ട്', 'ചെയ്യാമോ', 'ഉണ്ടോ'];
        const analyticalWords = ['how', 'why', 'explain', 'എങ്ങനെ', 'എന്തുകൊണ്ട്', 'വിശദീകരിക്കുക'];
        const complexWords = ['compare', 'analyze', 'relationship', 'തുലനം', 'വിശകലനം', 'ബന്ധം'];
        const followUpWords = ['more', 'കൂടുതൽ', 'വീണ്ടും', 'again', 'also', 'കൂടെ', 'additionally', 'further'];

        // Political/administrative query detection
        const politicalWords = ['mla', 'എം.എൽ.എ', 'എം.എല്.എ', 'minister', 'മന്ത്രി', 'മുഖ്യമന്ത്രി', 'ആര്', 'aaranu', 'who is', 'representative', 'പ്രതിനിധി'];

        // Extract entities from both current query and chat history
        const entities: string[] = [];
        if (lowerQuery.includes('കാട്ടക്കട') || lowerQuery.includes('kattakada') || lowerQuery.includes('kaattaka')) entities.push('Kattakada');
        if (lowerQuery.includes('മലയിൻകീഴ്') || lowerQuery.includes('malayinkeezhu')) entities.push('Malayinkeezhu');
        if (lowerQuery.includes('മാറനല്ലൂർ') || lowerQuery.includes('maranalloor')) entities.push('Maranalloor');
        if (lowerQuery.includes('പള്ളിച്ചൽ') || lowerQuery.includes('pallichal')) entities.push('Pallichal');
        if (lowerQuery.includes('വിളപ്പിൽ') || lowerQuery.includes('vilappil')) entities.push('Vilappil');
        if (lowerQuery.includes('വിളവൂർക്കൽ') || lowerQuery.includes('vilavoorkal')) entities.push('Vilavoorkal');
        if (lowerQuery.includes('കപ്പ') || lowerQuery.includes('tapioca')) entities.push('Tapioca');
        if (lowerQuery.includes('കൃഷി') || lowerQuery.includes('cultivation')) entities.push('Agriculture');
        if (lowerQuery.includes('തിരുവനന്തപുരം') || lowerQuery.includes('thiruvananthapuram')) entities.push('Thiruvananthapuram');
        if (lowerQuery.includes('ആശുപത്രി') || lowerQuery.includes('hospital')) entities.push('Hospital');
        if (lowerQuery.includes('എം.എൽ.എ') || lowerQuery.includes('mla')) entities.push('MLA');

        // Add entities from chat history for context continuity
        if (chatHistory) {
            const historyEntities = this.extractEntitiesFromHistory(chatHistory);
            entities.push(...historyEntities.filter(e => !entities.includes(e)));
        }

        // Detect follow-up queries
        const isFollowUp = Boolean(followUpWords.some(word => lowerQuery.includes(word)) ||
            (chatHistory && chatHistory.length > 100)); // Has substantial history

        if (isFollowUp) {
            queryType = 'FOLLOW_UP';
            complexity = Math.max(complexity, 3); // Follow-ups need more context
        }

        // Statistical/Quantitative queries need precise retrieval
        const statisticalWords = ['amount', 'count', 'number', 'area', 'land', 'hectare', 'population', 'density', 'literacy', 'rate', 'percentage', 'statistics', 'data', 'വിസ്തൃതി', 'ഭൂവിസ്തൃതി', 'ജനസംഖ്യ', 'എണ്ണം', 'ആകെ', 'ഹെക്ടർ', 'how much', 'how many', 'total'];
        if (statisticalWords.some(word => lowerQuery.includes(word))) {
            queryType = 'STATISTICAL';
            complexity = 4; // High complexity to ensure we find the exact numbers
        } else if (politicalWords.some(word => lowerQuery.includes(word))) {
            queryType = 'POLITICAL_ADMINISTRATIVE';
            complexity = 4; // High complexity to get more documents for accurate facts
        } else if (lowerQuery.includes('compare') || lowerQuery.includes('difference') || lowerQuery.includes('തുലനം')) {
            queryType = 'COMPARATIVE';
            complexity = 3;
        } else if (analyticalWords.some(word => lowerQuery.includes(word))) {
            queryType = 'INFERENTIAL';
            complexity = 4;
        } else if (complexWords.some(word => lowerQuery.includes(word))) {
            queryType = 'ANALYTICAL';
            complexity = 4;
        }

        // Agricultural queries need more context
        if (lowerQuery.includes('കൃഷി') || lowerQuery.includes('cultivation') || lowerQuery.includes('farming')) {
            complexity = Math.max(complexity, 3);
        }

        return {
            queryType,
            complexity,
            keyEntities: entities,
            requiresCrossReference: complexity > 2 || isFollowUp,
            dataTypesNeeded: ['text'],
            reasoningSteps: isFollowUp ? ['Reference resolution from chat history'] : [],
            suggestedK: Math.max(6, Math.min(12, complexity * 3)) // Minimum 6, maximum 12 documents
        };
    }
}

// Enhanced performance optimizer with chat history awareness
class SimplePerformanceOptimizer {
    private chatHistoryCache = new Map<string, { timestamp: number; entities: string[] }>();

    async optimizeQuery(query: string, analysis: QueryAnalysis, chatHistory?: string) {
        // Cache chat history entities for faster subsequent queries
        if (chatHistory) {
            const historyHash = this.hashString(chatHistory);
            const cached = this.chatHistoryCache.get(historyHash);

            if (!cached || Date.now() - cached.timestamp > 300000) { // 5 minute cache
                const entities = this.extractEntitiesFromHistory(chatHistory);
                this.chatHistoryCache.set(historyHash, {
                    timestamp: Date.now(),
                    entities
                });
            }
        }

        // Optimize based on query type and history
        const shouldCache = analysis.queryType === 'FACTUAL' && !analysis.requiresCrossReference;
        const estimatedTime = analysis.complexity * 1000;

        return {
            shouldCache,
            estimatedTime,
            useHistoryContext: !!chatHistory && analysis.queryType === 'FOLLOW_UP'
        };
    }

    private hashString(str: string): string {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32bit integer
        }
        return hash.toString();
    }

    private extractEntitiesFromHistory(chatHistory: string): string[] {
        const entities = [];
        const historyLower = chatHistory.toLowerCase();

        if (historyLower.includes('കാട്ടക്കട') || historyLower.includes('kattakada')) entities.push('Kattakada');
        if (historyLower.includes('കപ്പ') || historyLower.includes('tapioca')) entities.push('Tapioca');
        if (historyLower.includes('കൃഷി') || historyLower.includes('cultivation')) entities.push('Agriculture');
        if (historyLower.includes('തിരുവനന്തപുരം') || historyLower.includes('thiruvananthapuram')) entities.push('Thiruvananthapuram');
        if (historyLower.includes('ആശുപത്രി') || historyLower.includes('hospital')) entities.push('Hospital');
        if (historyLower.includes('എം.എൽ.എ') || historyLower.includes('mla')) entities.push('MLA');

        return entities;
    }

    trackPerformance(metrics: Record<string, unknown>) {
        console.log('Performance metrics:', metrics);
    }
}

/**
 * Smart context builder: keeps whole documents, sorted by relevance score,
 * de-duplicates overlapping chunks, and fits within the budget without
 * chopping mid-sentence.
 */
export function buildSmartContext(
    documents: Array<{ pageContent: string; metadata?: Record<string, unknown> }>,
    maxLength: number
): { context: string; docsUsed: number; docsDropped: number } {
    if (documents.length === 0) {
        return { context: '', docsUsed: 0, docsDropped: 0 };
    }

    // 1. Sort by relevance score (highest first) — Pinecone score is in metadata
    const sorted = [...documents].sort((a, b) => {
        const scoreA = Number(a.metadata?.score ?? 0);
        const scoreB = Number(b.metadata?.score ?? 0);
        return scoreB - scoreA;
    });

    // 2. De-duplicate overlapping chunks (>60% overlap = skip the lower-scored one)
    const deduped: typeof sorted = [];
    for (const doc of sorted) {
        const content = doc.pageContent.trim();
        if (!content) continue;

        const isDuplicate = deduped.some(existing => {
            const existingContent = existing.pageContent.trim();
            const shorter = content.length < existingContent.length ? content : existingContent;
            const longer = content.length >= existingContent.length ? content : existingContent;
            if (shorter.length < 50) return false;
            const checkLen = Math.floor(shorter.length * 0.6);
            const checkStr = shorter.substring(0, checkLen);
            return longer.includes(checkStr);
        });

        if (!isDuplicate) {
            deduped.push(doc);
        }
    }

    const dedupedCount = sorted.length - deduped.length;
    if (dedupedCount > 0) {
        console.log(`🧹 De-duplicated ${dedupedCount} overlapping chunks`);
    }

    // 3. Greedily pack whole documents until budget is exhausted
    const separator = '\n\n---\n\n';
    let totalLength = 0;
    const selected: string[] = [];

    for (const doc of deduped) {
        const piece = doc.pageContent.trim();
        const addedLength = piece.length + (selected.length > 0 ? separator.length : 0);

        if (totalLength + addedLength > maxLength) {
            if (selected.length === 0) {
                selected.push(piece.substring(0, maxLength));
                console.log(`⚠️ Top document alone exceeded budget, truncated to ${maxLength} chars`);
            }
            break;
        }

        selected.push(piece);
        totalLength += addedLength;
    }

    const docsDropped = deduped.length - selected.length;
    if (docsDropped > 0) {
        console.log(`📄 Context budget: kept ${selected.length}/${deduped.length} documents (${totalLength} chars), dropped ${docsDropped} lowest-relevance docs`);
    }

    return {
        context: selected.join(separator),
        docsUsed: selected.length,
        docsDropped
    };
}


type callChainArgs = {
    question: string;
    chatHistory: string;
};

// Initialize simplified components
const performanceOptimizer = new SimplePerformanceOptimizer();


// Cache expensive objects to avoid recreation on every request
let cachedEmbeddings: any = null; // eslint-disable-line @typescript-eslint/no-explicit-any
let cachedVectorStore: any = null; // eslint-disable-line @typescript-eslint/no-explicit-any

// Add detailed timing to see exactly where the 11+ seconds are going:
export async function callChain({ question, chatHistory }: callChainArgs) {
    const overallStartTime = Date.now();

    try {
        const sanitizedQuestion = question.trim().replaceAll("\n", " ");

        // Smart caching with chat history consideration
        const cacheKey = sanitizedQuestion;
        const cachedResult = getCachedQuery(cacheKey, env.PINECONE_NAMESPACE || '', chatHistory);

        // Only use cache for non-follow-up queries to ensure context accuracy
        if (cachedResult && (!chatHistory || chatHistory.length < 100)) {
            return { ...cachedResult, cached: true };
        }

        // Step 1: Enhanced query analysis with chat history context
        const queryAnalyzer = new SimpleQueryAnalyzer();
        const analysis = await queryAnalyzer.classifyQuery(sanitizedQuestion, chatHistory);

        const optimizationResult = await performanceOptimizer.optimizeQuery(
            sanitizedQuestion,
            analysis,
            chatHistory
        );

        // Log context-aware analysis for debugging
        if (analysis.queryType === 'FOLLOW_UP' && chatHistory) {
            console.log(`🔄 Follow-up query detected with ${analysis.keyEntities.length} entities from history`);
        }

        // Check for cached response
        if (!optimizationResult.shouldCache) {
            // Return cached response if available
            // This would be implemented with actual cache retrieval
        }

        // Query analysis completed - no need to log normal operation

        // Step 1.6: Environmental query pathway — DISABLED
        // The environmental tool (ai-tools.ts) returns hardcoded zeroes because
        // fetchWeatherData is a stub with no real API behind it. Keeping it active
        // would short-circuit the RAG pipeline and return fake data.
        // Re-enable this block once a real weather/environmental API is integrated.
        // See: src/lib/ai-tools.ts

        // Step 1.7: Expand query for better retrieval
        let searchParam = sanitizedQuestion;

        // Manual expansion for Statistical Queries to ensure Malayalam Keywords are included
        if (analysis.queryType === 'STATISTICAL') {
            console.log('📊 Statistical query detected, appending Malayalam statistical terms...');
            if (/area|land|how much/i.test(sanitizedQuestion)) searchParam += " ആകെ ഭൂവിസ്തൃതി വിസ്തൃതി ഹെക്ടർ റിപ്പോർട്ട് (Total Area in Hectares Report)";
            if (/population|people|how many/i.test(sanitizedQuestion)) searchParam += " ആകെ ജനസംഖ്യ റിപ്പോർട്ട് (Total Population Report)";
            if (/literacy/i.test(sanitizedQuestion)) searchParam += " സാക്ഷരത (Literacy)";
            if (/density/i.test(sanitizedQuestion)) searchParam += " ജനസാന്ദ്രത (Density)";
            if (/house|home/i.test(sanitizedQuestion)) searchParam += " വീടുകൾ ഭവനങ്ങൾ (Houses)";
        }

        try {
            // Only expand if it's not a simple query we already handled
            // and if we have time/resources (complexity > 1)
            // Skip automated expansion if we manually expanded statistics to avoid dilution
            if ((analysis.complexity > 1 || analysis.queryType === 'FOLLOW_UP') && analysis.queryType !== 'STATISTICAL') {
                console.log('🧠 Expanding query for better understanding...');
                const expandedQuery = await queryAnalyzer.expandQuery(sanitizedQuestion, chatHistory);
                if (expandedQuery !== sanitizedQuestion) {
                    console.log(`✨ Query Expanded: "${sanitizedQuestion}" -> "${expandedQuery}"`);
                    searchParam = expandedQuery;
                }
            }
        } catch (error) {
            console.warn('⚠️ Query expansion failed, using original query:', error);
        }

        // Step 2: Enhanced Pinecone retrieval with location-aware search
        const retrievalStartTime = Date.now();
        let retrievalResult: {
            documents: Array<{ pageContent: string; metadata: Record<string, unknown> }>;
            retrievalStrategy: string;
            crossReferences: string[];
        };
        let retrievalTime = 0;

        // Detect if user wants detailed/comprehensive information for increased retrieval
        const detailedKeywords = ['all', 'detailed', 'complete', 'comprehensive', 'full', 'everything',
            'എല്ലാ', 'വിശദമായ', 'മുഴുവൻ', 'പൂർണ്ണമായ', 'സമ്പൂർണ്ണ', 'list all', 'tell me everything'];
        const isDetailedQuery = detailedKeywords.some(keyword => searchParam.toLowerCase().includes(keyword));
        const retrievalK = isDetailedQuery ? 20 : 12; // More documents for detailed queries

        if (isDetailedQuery) {
            console.log(`📚 Detailed query detected - retrieving ${retrievalK} documents`);
        }

        try {
            // Check if this is a location-based query (hospital, facility, etc.)
            const isLocationQuery = /hospital|ആശുപത്രി|clinic|ക്ലിനിക്|medical|മെഡിക്കൽ|health|ആരോഗ്യ|where|എവിടെ|location|സ്ഥലം/i.test(searchParam);
            const isKattakadaHospitalQuery = /kattakada.*hospital|കാട്ടക്കട.*ആശുപത്രി|general.*hospital.*kattakada|ജനറൽ.*ആശുപത്രി.*കാട്ടക്കട/i.test(searchParam);

            if (isKattakadaHospitalQuery) {
                console.log('🏥 Kattakada hospital query detected, using specialized search...');

                // Import Document class for synthetic document creation
                const { Document } = await import('@langchain/core/documents');

                // Use specialized Kattakada hospital search
                const { searchKattakadaHospitalInfo } = await import('./malayalam-pinecone-processor');
                const hospitalResult = await searchKattakadaHospitalInfo(
                    searchParam,
                    [env.PINECONE_NAMESPACE || '']
                );

                // Add known location info as a synthetic document
                const locationDocument = new Document({
                    pageContent: `കാട്ടക്കട നിയോജക മണ്ഡലത്തിലെ ആരോഗ്യ കേന്ദ്രങ്ങൾ (Hospitals in Kattakada Constituency)

**ആകെ ആശുപത്രികൾ (അലോപ്പതി):** 6 (റിപ്പോർട്ട് പ്രകാരം 7 എന്ന് രേഖപ്പെടുത്തിയിട്ടുണ്ടെങ്കിലും പ്രധാന കേന്ദ്രങ്ങൾ 6 ആണ്)
- **മലയിൻകീഴ്:** താലൂക്ക് ആശുപത്രി (Taluk Hospital)
- **വിളപ്പിൽ:** കമ്മയൂണിറ്റി ഹെൽത്ത് സെന്റർ (CHC)
- **വിളവൂർക്കൽ:** കമ്മയൂണിറ്റി ഹെൽത്ത് സെന്റർ (CHC)
- **കാട്ടക്കട:** കുടുംബാരോഗ്യ കേന്ദ്രം (FHC)
- **മാറനല്ലൂർ:** കുടുംബാരോഗ്യ കേന്ദ്രം (FHC)
- **പള്ളിച്ചൽ:** കുടുംബാരോഗ്യ കേന്ദ്രം (FHC)

**ജീവനക്കാർ:** 26 ഡോക്ടർമാരും 128 പാരാമെഡിക്കൽ ജീവനക്കാരും മണ്ഡലത്തിലെ ആശുപത്രികളിൽ സേവനമനുഷ്ഠിക്കുന്നു.
**ആയുഷ് (AYUSH):** എല്ലാ പഞ്ചായത്തുകളിലും ആയുർവേദ, ഹോമിയോ ആശുപത്രികൾ/ഡിസ്പെൻസറികൾ ലഭ്യമാണ്.

**സൗകര്യങ്ങൾ:** ആംബുലൻസ്, ക്ലിനിക്കൽ ലാബ്, ഫാർമസി സൗകര്യങ്ങൾ ലഭ്യമാണ്. മലയിൻകീഴ് താലൂക്ക് ആശുപത്രിയിൽ ഡയാലിസിസ് സേവനവും ലഭ്യമാണ്.`,
                    metadata: {
                        source: 'Kattakada Assembly Report 2024',
                        type: 'medical_statistics',
                        accuracy: 'high'
                    }
                });

                // Combine with search results
                const allDocuments = [locationDocument, ...hospitalResult.documents];

                retrievalTime = Date.now() - retrievalStartTime;

                retrievalResult = {
                    documents: allDocuments,
                    retrievalStrategy: 'kattakada_hospital_specialized_search',
                    crossReferences: ['known_location_data', 'document_search']
                };

                console.log(`✅ Kattakada hospital search found ${allDocuments.length} documents with location data`);

            } else if (isLocationQuery) {
                console.log('🏥 Location-based query detected, using enhanced search...');

                // Use enhanced location search
                const { searchLocationBasedQuery } = await import('./malayalam-pinecone-processor');
                const locationResult = await searchLocationBasedQuery(
                    searchParam,
                    [env.PINECONE_NAMESPACE || ''],
                    { k: retrievalK, scoreThreshold: 0.2 } // Dynamic K based on query type
                );

                retrievalTime = Date.now() - retrievalStartTime;

                retrievalResult = {
                    documents: locationResult.documents,
                    retrievalStrategy: 'enhanced_location_search',
                    crossReferences: locationResult.searchMetadata.searchStrategies
                };

                console.log(`✅ Enhanced location search found ${locationResult.documents.length} documents`);

            } else if (analysis.queryType === 'STATISTICAL') {
                console.log('📊 Statistical query detected, using expanded search for summary data...');

                // For statistics, we need many documents to ensure we find summary chunks
                const { searchMalayalamDocuments } = await import('./malayalam-pinecone-processor');
                const statisticalDocs = await searchMalayalamDocuments(
                    searchParam,
                    [env.PINECONE_NAMESPACE || ''],
                    {
                        k: Math.max(16, retrievalK * 2), // High K to ensure we don't miss summary chunks
                        scoreThreshold: 0.15 // Lower threshold for statistical discovery
                    }
                );

                retrievalTime = Date.now() - retrievalStartTime;
                retrievalResult = {
                    documents: statisticalDocs,
                    retrievalStrategy: 'statistical_enhanced_summary_search',
                    crossReferences: ['summary_statistics']
                };

                console.log(`✅ Statistical enhanced search found ${statisticalDocs.length} documents`);

            } else {
                // Use standard search for non-location queries
                // Reuse cached embeddings instance (saves 1-2 seconds)
                if (!cachedEmbeddings) {
                    const { OpenAIEmbeddings } = await import('@langchain/openai');
                    cachedEmbeddings = new OpenAIEmbeddings({
                        openAIApiKey: env.OPENAI_API_KEY,
                        modelName: env.EMBEDDING_MODEL,
                        dimensions: env.EMBEDDING_DIMENSIONS
                    });
                }

                // Generate embedding (this is the expensive part - keep it)
                await cachedEmbeddings.embedQuery(searchParam);

                // Reuse cached vector store (saves 1-2 seconds)
                if (!cachedVectorStore) {
                    const { PineconeStore } = await import('@langchain/pinecone');
                    const pineconeClient = await getPinecone();
                    const index = pineconeClient.Index(env.PINECONE_INDEX_NAME);

                    cachedVectorStore = new PineconeStore(cachedEmbeddings, {
                        pineconeIndex: index,
                        namespace: env.PINECONE_NAMESPACE
                    });
                }

                // Perform Pinecone search with dynamic K
                const docs = await cachedVectorStore.similaritySearchWithScore(searchParam, retrievalK);

                const uniqueDocuments = docs.map(([doc, score]: [any, any]) => ({ // eslint-disable-line @typescript-eslint/no-explicit-any
                    pageContent: doc.pageContent,
                    metadata: {
                        ...doc.metadata,
                        score: score,
                        namespace: env.PINECONE_NAMESPACE
                    }
                }));

                retrievalTime = Date.now() - retrievalStartTime;

                retrievalResult = {
                    documents: uniqueDocuments,
                    retrievalStrategy: 'standard_pinecone_search',
                    crossReferences: []
                };
            }

        } catch (error) {
            // Log only when there's an actual error
            console.error('Pinecone retrieval error:', error);

            // Fallback to empty result if Pinecone fails
            retrievalResult = {
                documents: [],
                retrievalStrategy: 'fallback_empty',
                crossReferences: []
            };

            retrievalTime = Date.now() - retrievalStartTime;
        }

        // Step 3: Build smart context from retrieved documents (NO LLM CALL)
        // The streaming model in route.ts handles the actual response generation.
        // This eliminates the previous double-LLM-call bottleneck.
        // Reuses isDetailedQuery from retrieval step above
        const maxContextLength = isDetailedQuery ? 28000 : 16000;

        const { context, docsUsed, docsDropped } = buildSmartContext(retrievalResult.documents, maxContextLength);
        console.log(`📄 Context ready: ${docsUsed} docs, ${context.length} chars${docsDropped > 0 ? `, ${docsDropped} dropped` : ''}`);

        // Step 4: Track performance metrics
        const totalTime = Date.now() - overallStartTime;
        performanceOptimizer.trackPerformance({
            queryProcessingTime: totalTime - retrievalTime,
            retrievalTime,
            synthesisTime: 0, // No synthesis LLM call — streaming model handles it
            totalTime,
            cacheHitRate: 0,
            documentsRetrieved: retrievalResult.documents.length,
            qualityScore: 0.9
        });

        // Production performance monitoring
        if (totalTime > 3000) {
            console.warn(`⚠️ Slow retrieval: ${totalTime}ms for "${sanitizedQuestion.substring(0, 50)}..."`);
        }

        // Build source attribution from documents
        const enhancedSources = retrievalResult.documents.map(doc => ({
            source: String(doc.metadata?.source || 'unknown'),
            relevance: Number(doc.metadata?.score || 0.8),
            usedFor: 'context',
            contentType: 'text' as const,
            pageReference: String(doc.metadata?.page || '1')
        }));

        const response: {
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
            // environmentalData?: Record<string, unknown>;
            // environmentalSummary?: string;
        } = {
            text: context, // Raw document context — streaming model will interpret this
            sources: enhancedSources,
            analysis: {
                queryType: analysis.queryType,
                complexity: analysis.complexity,
                retrievalStrategy: retrievalResult.retrievalStrategy,
                documentsUsed: docsUsed,
                crossReferences: retrievalResult.crossReferences,
                responseStyle: 'single_pass_streaming',
                qualityScore: 0.9,
                confidence: docsUsed > 0 ? 0.85 : 0.1,
                completeness: docsDropped > 0 ? 'partial' : 'complete',
                processingTime: totalTime
            },
            quality: {
                overallScore: 0.9,
                factualAccuracy: 0.9,
                completeness: 0.9,
                coherence: 0.9,
                issues: [],
                improvements: []
            },
            reasoning: [`Single-pass: ${docsUsed}/${retrievalResult.documents.length} docs, ${context.length} chars, retrieval ${retrievalTime}ms`]
        };

        // Environmental data pathway — DISABLED (see Step 1.6 comment above)

        // Smart caching — cache the raw context for faster re-retrieval
        const cacheableResponse = {
            ...response,
            cached: false,
            cacheTimestamp: Date.now()
        };

        // Only cache if it's not a follow-up query and chat history is minimal
        if (analysis.queryType !== 'FOLLOW_UP' && (!chatHistory || chatHistory.length < 200)) {
            setCachedQuery(cacheKey, env.PINECONE_NAMESPACE || '', cacheableResponse, chatHistory);
        }

        return cacheableResponse;
    } catch (e) {
        console.error(e);
        throw new Error("Call chain method failed to execute successfully!!");
    }
}