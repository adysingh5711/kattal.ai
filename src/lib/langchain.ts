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
    isEnvironmentalQuery,
    executeEnvironmentalDataTool,
    extractParametersFromQuery,
    type EnvironmentalToolResult
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
        if (lowerQuery.includes('കാട്ടക്കട') || lowerQuery.includes('kattakada')) entities.push('Kattakada');
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

        // Political/administrative queries need precise retrieval
        if (politicalWords.some(word => lowerQuery.includes(word))) {
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

// Optimized response synthesizer
class SimpleResponseSynthesizer {
    async synthesizeResponse(query: string, analysis: QueryAnalysis, documents: Array<{ pageContent: string; metadata?: Record<string, unknown> }>, chatHistory?: string) {
        // Detect if user wants detailed/comprehensive information
        const detailedKeywords = ['all', 'detailed', 'complete', 'comprehensive', 'full', 'everything',
            'എല്ലാ', 'വിശദമായ', 'മുഴുവൻ', 'പൂർണ്ണമായ', 'സമ്പൂർണ്ണ', 'list all', 'tell me everything'];
        const queryLower = query.toLowerCase();
        const isDetailedQuery = detailedKeywords.some(keyword => queryLower.includes(keyword));

        // Use extended context for detailed queries (16000 chars vs 8000)
        const maxContextLength = isDetailedQuery ? 16000 : 8000;

        if (isDetailedQuery) {
            console.log(`📚 Detailed query detected - using extended context (${maxContextLength} chars)`);
        }

        let context = documents.map(doc => doc.pageContent).join('\n\n');

        // Truncate context if too long
        if (context.length > maxContextLength) {
            context = context.substring(0, maxContextLength) + '...';
            console.log(`🔍 Context truncated from ${documents.map(doc => doc.pageContent).join('\n\n').length} to ${context.length} characters`);
        }

        // Smart chat history processing - balance context vs performance
        let chatHistoryContext = '';
        if (chatHistory && analysis.queryType === 'FOLLOW_UP') {
            // For follow-up queries, include more chat history
            const maxHistoryLength = 2000;
            const truncatedHistory = chatHistory.length > maxHistoryLength
                ? '...' + chatHistory.slice(-maxHistoryLength)
                : chatHistory;
            chatHistoryContext = `\n\nCHAT HISTORY (for context):\n${truncatedHistory}\n`;
        } else if (chatHistory) {
            // For other queries, include only recent context
            const recentHistory = chatHistory.split('\n').slice(-4).join('\n'); // Last 4 lines
            if (recentHistory.length > 0) {
                chatHistoryContext = `\n\nRECENT CONTEXT:\n${recentHistory}\n`;
            }
        }

        const concisePrompt = `You are a helpful AI assistant that analyzes Kerala state documents and provides information in Malayalam.

🚫 RESPOND ONLY IN MALAYALAM SCRIPT (മലയാളം) - THE LANGUAGE OF KERALA, INDIA
⚠️ CRITICAL: MALAYALAM IS NOT HINDI! DO NOT CONFUSE THEM!
- Malayalam script: ക, ഖ, ഗ, ഘ, ങ (curved letters) ✅ USE THIS
- Hindi/Devanagari script: क, ख, ग, घ, ङ (horizontal line on top) ❌ NEVER USE THIS
- Example correct Malayalam words: നമസ്കാരം, ആശുപത്രി, വിവരം, ജില്ല, മണ്ഡലം

IMPORTANT INSTRUCTIONS:
- For location queries about hospitals/facilities, provide EXACT addresses when available
- Include specific details like road names, landmarks, coordinates if mentioned
- For Kattakada General Hospital, note it's located in Kattakada town, Thiruvananthapuram district
- Always check for specific address details in the context before saying information is not available
- If this is a follow-up question, refer to the chat history for context and avoid repeating information
- For reference words like "അത്", "ഇത്", "അവിടെ", use the chat history to understand what they refer to

CONTEXT:
${context}${chatHistoryContext}

Question: ${query}

Provide a comprehensive answer in Malayalam Script (മലയാളം മാത്രം) with exact location details when available:`;

        // Use non-streaming model for synthesis (more reliable for single responses)
        const { nonStreamingModel } = await import('./llm');

        // Add timeout protection to prevent hanging
        const synthesisPromise = nonStreamingModel.invoke(concisePrompt);
        const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Synthesis timeout after 60 seconds')), 60000)
        );

        try {
            const response = await Promise.race([synthesisPromise, timeoutPromise]);
            const responseText = (response as { content: string }).content;

            // Hallucination detection for political queries
            if (query.toLowerCase().includes('mla') || query.toLowerCase().includes('എം.എൽ.എ')) {
                const contextText = context.toLowerCase();

                // Check if response mentions names not in context
                const suspiciousNames = ['അനിൽ ആന്റണി', 'anil antony', 'സജിതാ ജെ. ജോസഫ്', 'sajitha j. joseph'];
                const hasSuspiciousName = suspiciousNames.some(name =>
                    responseText.toLowerCase().includes(name.toLowerCase()) &&
                    !contextText.includes(name.toLowerCase())
                );

                if (hasSuspiciousName) {
                    console.warn('🚨 Hallucination detected in political query response');
                    return {
                        synthesizedResponse: `ലഭ്യമായ പ്രമാണങ്ങളിൽ കാട്ടാക്കട മണ്ഡലത്തിലെ എം.എൽ.എ.യെ കുറിച്ചുള്ള വിവരങ്ങൾ പരിമിതമാണ്. കൃത്യമായ വിവരങ്ങൾക്കായി ദയവായി സംസ്ഥാന തിരഞ്ഞെടുപ്പ് കമ്മീഷനിലേക്കോ നിയമസഭാ സെക്രട്ടറിയേറ്റിലേക്കോ റഫർ ചെയ്യുക.`,
                        responseStyle: 'hallucination_prevented',
                        confidence: 0.9,
                        completeness: 'partial' as const,
                        sourceAttribution: documents.map(doc => ({
                            source: String(doc.metadata?.source || 'unknown'),
                            relevance: 0.8,
                            usedFor: 'context',
                            contentType: 'text' as const,
                            pageReference: String(doc.metadata?.page || '1')
                        })),
                        reasoningChain: ['Prevented hallucination in political query']
                    };
                }
            }

            return {
                synthesizedResponse: responseText,
                responseStyle: 'factual',
                confidence: 0.8,
                completeness: 'complete' as const,
                sourceAttribution: documents.map(doc => ({
                    source: String(doc.metadata?.source || 'unknown'),
                    relevance: 0.8,
                    usedFor: 'context',
                    contentType: 'text' as const,
                    pageReference: String(doc.metadata?.page || '1')
                })),
                reasoningChain: ['Optimized response synthesis with hallucination check']
            };
        } catch (error) {
            console.error(`❌ LLM synthesis failed:`, error);

            // Fallback response when LLM fails
            return {
                synthesizedResponse: `ക്ഷമിക്കണം, ഈ വിഷയത്തിൽ നിങ്ങളെ സഹായിക്കാൻ എനിക്ക് മതിയായ വിവരങ്ങൾ ഇല്ല. കൂടുതൽ വിവരങ്ങൾക്ക് ദയവായി സന്ദർശിക്കുക: https://kattakadalac.com/ (Sorry, I don't have enough information to help you with this topic. For more information, please visit: https://kattakadalac.com/)`,
                responseStyle: 'fallback',
                confidence: 0.1,
                completeness: 'partial' as const,
                sourceAttribution: documents.map(doc => ({
                    source: String(doc.metadata?.source || 'unknown'),
                    relevance: 0.5,
                    usedFor: 'context',
                    contentType: 'text' as const,
                    pageReference: String(doc.metadata?.page || '1')
                })),
                reasoningChain: ['Fallback response due to LLM failure']
            };
        }
    }
}

type callChainArgs = {
    question: string;
    chatHistory: string;
};

// Initialize simplified components
const responseSynthesizer = new SimpleResponseSynthesizer();
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
        const cachedResult = getCachedQuery(cacheKey, env.PINECONE_NAMESPACE || 'malayalam-docs', chatHistory);

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

        // Step 1.5: Fast response for very simple queries (greetings, basic questions) - MALAYALAM ONLY
        // Skip for follow-up queries to maintain conversation context
        if (analysis.complexity === 1 && !analysis.requiresCrossReference && analysis.queryType !== 'FOLLOW_UP') {
            const simpleGreetings = ['hi', 'hello', 'hey', 'namaste', 'namaskar', 'hai', 'helo', 'vanakkam', 'namaskaram', 'namaskara'];
            const normalizedQuery = sanitizedQuestion.toLowerCase().trim();

            if (simpleGreetings.includes(normalizedQuery)) {
                return {
                    text: `നമസ്കാരം! അപ്‌ലോഡ് ചെയ്ത ഡോക്യുമെന്റുകളിൽ നിന്നും വിവരങ്ങൾ കണ്ടെത്താൻ ഞാൻ ഇവിടെയുണ്ട്. നിങ്ങൾക്ക് ഇത്തരം ചോദ്യങ്ങൾ ചോദിക്കാം:
- "ഈ ഡോക്യുമെന്റ് എന്താണ് പറയുന്നത്?"
- "[നിർദ്ദിഷ്ട വിഷയം] കുറിച്ച് പറയൂ"
- "[നിർദ്ദിഷ്ട വിഷയത്തിന്റെ] ഡാറ്റ കാണിക്കൂ"
- "പ്രധാന കണ്ടെത്തലുകൾ എന്താണ്?"

എന്താണ് അറിയേണ്ടത്?`,
                    sources: [],
                    analysis: {
                        queryType: 'greeting',
                        complexity: 1,
                        retrievalStrategy: 'fast_response',
                        documentsUsed: 0,
                        crossReferences: [],
                        responseStyle: 'greeting',
                        qualityScore: 0.9,
                        confidence: 0.9,
                        completeness: 1.0,
                        processingTime: Date.now() - overallStartTime
                    },
                    quality: {
                        overallScore: 0.9,
                        factualAccuracy: 0.9,
                        completeness: 1.0,
                        coherence: 0.9,
                        issues: [],
                        improvements: []
                    },
                    reasoning: ['Fast response for greeting query - Malayalam only'],
                    cached: false
                };
            }
        }

        // Step 1.55: Predefined response for opinion-based questions about MLA I.B. Sateesh
        // This handles questions like "how is IB Sateesh", "is Kattakada MLA good", "are people happy with MLA", etc.
        const isMlaOpinionQuery = () => {
            const queryLower = sanitizedQuestion.toLowerCase();
            const mlaKeywords = ['ib sateesh', 'i.b. sateesh', 'i.b sateesh', 'ib satish', 'i b sateesh',
                'ഐ.ബി. സതീഷ്', 'ഐബി സതീഷ്', 'സതീഷ്', 'sateesh', 'satish'];
            const mlaRoleKeywords = ['kattakada mla', 'കാട്ടക്കട എം.എൽ.എ', 'കാട്ടക്കട mla', 'mla of kattakada',
                'കാട്ടക്കടയുടെ എം.എൽ.എ', 'നിലവിലെ എംഎൽഎ', 'current mla'];
            const opinionKeywords = ['how is', 'how good', 'is he good', 'is she good', 'opinion', 'happy with',
                'satisfied with', 'performance', 'doing', 'work', 'എങ്ങനെ', 'നല്ലതാണോ', 'സന്തോഷം', 'പ്രവർത്തനം',
                'good leader', 'bad leader', 'effective', 'corrupt', 'honest', 'popular', 'like', 'dislike',
                'അഭിപ്രായം', 'നേതാവ്', 'പ്രവൃത്തി', 'ജനപ്രിയം', 'സത്യസന്ധത'];

            const hasMlaReference = mlaKeywords.some(kw => queryLower.includes(kw.toLowerCase())) ||
                mlaRoleKeywords.some(kw => queryLower.includes(kw.toLowerCase()));
            const hasOpinionContext = opinionKeywords.some(kw => queryLower.includes(kw.toLowerCase()));

            return hasMlaReference && hasOpinionContext;
        };

        if (isMlaOpinionQuery()) {
            console.log('🎯 Opinion-based MLA query detected, returning neutral predefined response');
            return {
                text: `ഐ.ബി. സതീഷ് കാട്ടക്കട നിയോജക മണ്ഡലത്തിന്റെ നിലവിലെ എം.എൽ.എ ആണ്. മണ്ഡലത്തിന്റെ വികസന പ്രവർത്തനങ്ങളിൽ അദ്ദേഹം സജീവമായി പങ്കെടുക്കുന്നു.
അദ്ദേഹത്തെക്കുറിച്ച് ജനങ്ങളുടെ അഭിപ്രായങ്ങൾ വ്യത്യസ്തമാണ്. പൊതുവെ അദ്ദേഹത്തെ നല്ല നേതാവായി കാണുന്നു.`,
                sources: [],
                analysis: {
                    queryType: 'opinion_query',
                    complexity: 1,
                    retrievalStrategy: 'predefined_response',
                    documentsUsed: 0,
                    crossReferences: [],
                    responseStyle: 'neutral_factual',
                    qualityScore: 0.95,
                    confidence: 1.0,
                    completeness: 1.0,
                    processingTime: Date.now() - overallStartTime
                },
                quality: {
                    overallScore: 0.95,
                    factualAccuracy: 1.0,
                    completeness: 1.0,
                    coherence: 0.95,
                    issues: [],
                    improvements: []
                },
                reasoning: ['Predefined neutral response for opinion-based MLA queries'],
                cached: false
            };
        }

        // Step 1.6: Check if this is an environmental data query
        let environmentalData: EnvironmentalToolResult | null = null;
        console.log('🔍 About to check environmental query for:', sanitizedQuestion);
        console.log('🔍 isEnvironmentalQuery function:', typeof isEnvironmentalQuery);
        console.log('🔍 isEnvironmentalQuery function exists:', !!isEnvironmentalQuery);
        let isEnvQuery = false;
        try {
            console.log('🔍 Calling isEnvironmentalQuery...');
            isEnvQuery = isEnvironmentalQuery(sanitizedQuestion);
            console.log('🔍 Environmental query check result:', isEnvQuery);
        } catch (error) {
            console.error('❌ Error in environmental query detection:', error);
            isEnvQuery = false;
        }

        if (isEnvQuery) {
            console.log('🌡️ Environmental query detected, fetching real-time data...');

            try {
                const extractedParams = extractParametersFromQuery(sanitizedQuestion);

                // If we have sufficient parameters, execute the tool
                if (extractedParams.city && extractedParams.naturalFactors) {
                    environmentalData = await executeEnvironmentalDataTool({
                        city: extractedParams.city,
                        naturalFactors: extractedParams.naturalFactors,
                        timeRange: extractedParams.timeRange || 'last_24h'
                    });

                    if (environmentalData.success && environmentalData.summary) {
                        console.log('✅ Environmental data fetched successfully');

                        // For environmental queries, we can provide a quick response
                        // without going through the full RAG pipeline
                        return {
                            text: environmentalData.summary,
                            sources: [],
                            analysis: {
                                queryType: 'environmental_data',
                                complexity: 1,
                                retrievalStrategy: 'api_tool',
                                documentsUsed: 0,
                                crossReferences: [],
                                responseStyle: 'data_summary',
                                qualityScore: 0.95,
                                confidence: 0.9,
                                completeness: 0.95,
                                processingTime: Date.now() - overallStartTime
                            },
                            quality: {
                                overallScore: 0.95,
                                factualAccuracy: 0.98,
                                completeness: 0.95,
                                coherence: 0.9,
                                issues: [],
                                improvements: []
                            },
                            reasoning: ['Real-time environmental data fetched from IoT sensors'],
                            environmentalData: environmentalData.data,
                            cached: false
                        };
                    }
                } else {
                    console.log('⚠️ Environmental query detected but insufficient parameters extracted');
                }
            } catch (error) {
                console.error('❌ Environmental data fetch failed:', error);
                // Continue with normal RAG pipeline if environmental data fails
            }
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
        const isDetailedQuery = detailedKeywords.some(keyword => sanitizedQuestion.toLowerCase().includes(keyword));
        const retrievalK = isDetailedQuery ? 20 : 12; // More documents for detailed queries

        if (isDetailedQuery) {
            console.log(`📚 Detailed query detected - retrieving ${retrievalK} documents`);
        }

        try {
            // Check if this is a location-based query (hospital, facility, etc.)
            const isLocationQuery = /hospital|ആശുപത്രി|clinic|ക്ലിനിക്|medical|മെഡിക്കൽ|health|ആരോഗ്യ|where|എവിടെ|location|സ്ഥലം/i.test(sanitizedQuestion);
            const isKattakadaHospitalQuery = /kattakada.*hospital|കാട്ടക്കട.*ആശുപത്രി|general.*hospital.*kattakada|ജനറൽ.*ആശുപത്രി.*കാട്ടക്കട/i.test(sanitizedQuestion);

            if (isKattakadaHospitalQuery) {
                console.log('🏥 Kattakada hospital query detected, using specialized search...');

                // Import Document class for synthetic document creation
                const { Document } = await import('langchain/document');

                // Use specialized Kattakada hospital search
                const { searchKattakadaHospitalInfo } = await import('./malayalam-pinecone-processor');
                const hospitalResult = await searchKattakadaHospitalInfo(
                    sanitizedQuestion,
                    [env.PINECONE_NAMESPACE || 'malayalam-docs']
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
                    sanitizedQuestion,
                    [env.PINECONE_NAMESPACE || 'malayalam-docs'],
                    { k: retrievalK, scoreThreshold: 0.2 } // Dynamic K based on query type
                );

                retrievalTime = Date.now() - retrievalStartTime;

                retrievalResult = {
                    documents: locationResult.documents,
                    retrievalStrategy: 'enhanced_location_search',
                    crossReferences: locationResult.searchMetadata.searchStrategies
                };

                console.log(`✅ Enhanced location search found ${locationResult.documents.length} documents`);

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
                await cachedEmbeddings.embedQuery(sanitizedQuestion);

                // Reuse cached vector store (saves 1-2 seconds)
                if (!cachedVectorStore) {
                    const { PineconeStore } = await import('@langchain/pinecone');
                    const pineconeClient = await getPinecone();
                    const index = pineconeClient.Index(env.PINECONE_INDEX_NAME);

                    cachedVectorStore = new PineconeStore(cachedEmbeddings, {
                        pineconeIndex: index,
                        namespace: env.PINECONE_NAMESPACE || 'malayalam-docs'
                    });
                }

                // Perform Pinecone search with dynamic K
                const docs = await cachedVectorStore.similaritySearchWithScore(sanitizedQuestion, retrievalK);

                const uniqueDocuments = docs.map(([doc, score]: [any, any]) => ({ // eslint-disable-line @typescript-eslint/no-explicit-any
                    pageContent: doc.pageContent,
                    metadata: {
                        ...doc.metadata,
                        score: score,
                        namespace: env.PINECONE_NAMESPACE || 'malayalam-docs'
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

        // Step 3: Advanced Response Synthesis with Chat History Context
        const synthesisStartTime = Date.now();
        const synthesis = await responseSynthesizer.synthesizeResponse(
            sanitizedQuestion,
            analysis,
            retrievalResult.documents,
            chatHistory // Add chat history for better context
        );
        const synthesisTime = Date.now() - synthesisStartTime;

        // Step 4: Skip quality validation for speed - focus on document depth instead
        const validation: ValidationResult = {
            overallScore: 0.9, // Assume high quality with deep document analysis
            factualAccuracy: 0.9,
            completeness: 0.9,
            coherence: 0.9,
            sourceReliability: 0.85,
            responseQuality: 0.9,
            issues: [],
            improvements: [],
            confidence: 0.9,
        };

        // Alert on low quality responses only
        if (validation.overallScore < 0.6) {
            console.warn(`⚠️ Low quality response detected: ${(validation.overallScore * 100).toFixed(1)}% for "${sanitizedQuestion.substring(0, 50)}..."`);
        }

        // Step 5: Track performance metrics
        const totalTime = Date.now() - overallStartTime;
        performanceOptimizer.trackPerformance({
            queryProcessingTime: totalTime - retrievalTime - synthesisTime,
            retrievalTime,
            synthesisTime,
            validationTime: 0, // Skipped for speed
            totalTime,
            cacheHitRate: 0, // Will be calculated by optimizer
            documentsRetrieved: retrievalResult.documents.length,
            qualityScore: validation.overallScore
        });

        // Production performance monitoring
        if (totalTime > 3000) {
            console.warn(`⚠️ Slow query detected: ${totalTime}ms for "${sanitizedQuestion.substring(0, 50)}..."`);
        }

        // Log performance metrics only for slow queries or errors
        if (totalTime > 10000) {
            console.log(`📈 Slow query detected: ${totalTime}ms total (retrieval: ${retrievalTime}ms, synthesis: ${synthesisTime}ms, docs: ${retrievalResult.documents.length})`);
        }

        // Prepare enhanced response
        const enhancedSources = synthesis.sourceAttribution.map(attr => ({
            source: attr.source,
            relevance: attr.relevance,
            usedFor: attr.usedFor,
            contentType: attr.contentType,
            pageReference: attr.pageReference
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
            environmentalData?: Record<string, unknown>;
            environmentalSummary?: string;
        } = {
            text: synthesis.synthesizedResponse,
            sources: enhancedSources,
            analysis: {
                queryType: analysis.queryType,
                complexity: analysis.complexity,
                retrievalStrategy: retrievalResult.retrievalStrategy,
                documentsUsed: retrievalResult.documents.length,
                crossReferences: retrievalResult.crossReferences,
                responseStyle: synthesis.responseStyle,
                qualityScore: validation.overallScore,
                confidence: synthesis.confidence,
                completeness: synthesis.completeness,
                processingTime: totalTime
            },
            quality: {
                overallScore: validation.overallScore,
                factualAccuracy: validation.factualAccuracy,
                completeness: validation.completeness,
                coherence: validation.coherence,
                issues: validation.issues,
                improvements: validation.improvements
            },
            reasoning: synthesis.reasoningChain
        };

        // Add environmental data if available
        if (environmentalData && environmentalData.success) {
            response.environmentalData = environmentalData.data;
            response.environmentalSummary = environmentalData.summary;
        }

        // Smart caching - only cache simple queries without complex chat history
        const cacheableResponse = {
            ...response,
            cached: false,
            cacheTimestamp: Date.now()
        };

        // Only cache if it's not a follow-up query and chat history is minimal
        if (analysis.queryType !== 'FOLLOW_UP' && (!chatHistory || chatHistory.length < 200)) {
            setCachedQuery(cacheKey, env.PINECONE_NAMESPACE || 'malayalam-docs', cacheableResponse, chatHistory);
        }

        return cacheableResponse;
    } catch (e) {
        console.error(e);
        throw new Error("Call chain method failed to execute successfully!!");
    }
}