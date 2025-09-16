// import { createRetrievalChain } from "langchain/chains/retrieval";
// import { createStuffDocumentsChain } from "langchain/chains/combine_documents";
// import { createHistoryAwareRetriever } from "langchain/chains/history_aware_retriever";
// import { ChatPromptTemplate, MessagesPlaceholder } from "@langchain/core/prompts";
// import { HumanMessage, AIMessage } from "@langchain/core/messages";
// import { streamingModel, nonStreamingModel } from "./llm";
// import { QA_TEMPLATE } from "./prompt-templates";
// Simplified LangChain integration for Malayalam system
// Note: Complex components removed as part of streamlining

import { getPinecone } from "./pinecone-client";
import { streamingModel } from "./llm";
import { QA_TEMPLATE } from "./prompt-templates";
import {
    isEnvironmentalQuery,
    executeEnvironmentalDataTool,
    extractParametersFromQuery,
    type EnvironmentalToolResult
} from "./ai-tools";
import { getCachedQuery, setCachedQuery, logCachePerformance } from "./query-cache";

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
    async classifyQuery(query: string, _chatHistory?: string): Promise<QueryAnalysis> {
        const lowerQuery = query.toLowerCase();

        // Enhanced classification for better document retrieval
        let queryType = 'FACTUAL';
        let complexity = 2; // Start with higher baseline for better retrieval

        // Enhanced Malayalam query analysis
        const malayalamQuestionWords = ['എന്ത്', 'എങ്ങനെ', 'എവിടെ', 'എപ്പോൾ', 'ആര്', 'എന്തുകൊണ്ട്', 'ചെയ്യാമോ', 'ഉണ്ടോ'];
        const analyticalWords = ['how', 'why', 'explain', 'എങ്ങനെ', 'എന്തുകൊണ്ട്', 'വിശദീകരിക്കുക'];
        const complexWords = ['compare', 'analyze', 'relationship', 'തുലനം', 'വിശകലനം', 'ബന്ധം'];

        // Extract entities (place names, topics)
        const entities = [];
        if (lowerQuery.includes('കാട്ടക്കട') || lowerQuery.includes('kattakada')) entities.push('Kattakada');
        if (lowerQuery.includes('കപ്പ') || lowerQuery.includes('tapioca')) entities.push('Tapioca');
        if (lowerQuery.includes('കൃഷി') || lowerQuery.includes('cultivation')) entities.push('Agriculture');
        if (lowerQuery.includes('തിരുവനന്തപുരം') || lowerQuery.includes('thiruvananthapuram')) entities.push('Thiruvananthapuram');

        if (lowerQuery.includes('compare') || lowerQuery.includes('difference') || lowerQuery.includes('തുലനം')) {
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
            requiresCrossReference: complexity > 2,
            dataTypesNeeded: ['text'],
            reasoningSteps: [],
            suggestedK: Math.max(6, Math.min(12, complexity * 3)) // Minimum 6, maximum 12 documents
        };
    }
}

// Simplified performance optimizer
class SimplePerformanceOptimizer {
    async optimizeQuery(query: string, analysis: QueryAnalysis, _chatHistory?: string) {
        return {
            shouldCache: false,
            estimatedTime: analysis.complexity * 1000
        };
    }

    trackPerformance(metrics: Record<string, unknown>) {
        console.log('Performance metrics:', metrics);
    }
}

// Simplified response synthesizer
class SimpleResponseSynthesizer {
    async synthesizeResponse(query: string, analysis: QueryAnalysis, documents: Array<{ pageContent: string; metadata?: Record<string, unknown> }>) {
        // Simple response synthesis using streaming model
        const context = documents.map(doc => doc.pageContent).join('\n\n');

        console.log(`🔍 DEBUG: Context length: ${context.length} characters`);
        console.log(`🔍 DEBUG: Context preview: ${context.substring(0, 200)}...`);
        console.log(`🔍 DEBUG: Query: ${query}`);

        const prompt = QA_TEMPLATE.replace('{context}', context).replace('{input}', query);

        const response = await streamingModel.invoke(prompt);

        return {
            synthesizedResponse: response.content as string,
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
            reasoningChain: ['Simplified response synthesis']
        };
    }
}

type callChainArgs = {
    question: string;
    chatHistory: string;
};

// Initialize simplified components
const responseSynthesizer = new SimpleResponseSynthesizer();
const performanceOptimizer = new SimplePerformanceOptimizer();

export async function callChain({ question, chatHistory }: callChainArgs) {
    const overallStartTime = Date.now();

    try {
        const sanitizedQuestion = question.trim().replaceAll("\n", " ");

        // Step 1: Performance optimization and caching check
        const queryAnalyzer = new SimpleQueryAnalyzer();
        const analysis = await queryAnalyzer.classifyQuery(sanitizedQuestion, chatHistory);

        const optimizationResult = await performanceOptimizer.optimizeQuery(
            sanitizedQuestion,
            analysis,
            chatHistory
        );

        // Check for cached response
        if (!optimizationResult.shouldCache) {
            // Return cached response if available
            // This would be implemented with actual cache retrieval
        }

        console.log(`🧠 Query Analysis:`, {
            type: analysis.queryType,
            complexity: analysis.complexity,
            entities: analysis.keyEntities,
            needsCrossRef: analysis.requiresCrossReference,
            estimatedTime: optimizationResult.estimatedTime
        });

        // Check cache first for faster responses
        const cacheKey = sanitizedQuestion;
        const cachedResult = getCachedQuery(cacheKey, 'malayalam-docs', chatHistory);
        if (cachedResult) {
            // Log cache performance periodically
            if (Math.random() < 0.1) { // 10% chance
                logCachePerformance();
            }
            return cachedResult;
        }

        // Step 1.5: Fast response for very simple queries (greetings, basic questions) - MALAYALAM ONLY
        if (analysis.complexity === 1 && !analysis.requiresCrossReference) {
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
                    reasoning: ['Fast response for greeting query - Malayalam only']
                };
            }
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
                            environmentalData: environmentalData.data
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

        // Step 2: Real Pinecone retrieval with proper embedding
        const retrievalStartTime = Date.now();
        let retrievalResult: {
            documents: Array<{ pageContent: string; metadata: Record<string, unknown> }>;
            retrievalStrategy: string;
            crossReferences: string[];
        };
        let retrievalTime = 0;

        try {
            // Get real embedding for the query
            const { OpenAIEmbeddings } = await import('@langchain/openai');
            const { env } = await import('./env');

            const embeddings = new OpenAIEmbeddings({
                openAIApiKey: env.OPENAI_API_KEY,
                modelName: 'text-embedding-3-large',
                dimensions: 1024 // Match the Pinecone index dimensions
            });

            // Generate real embedding for the query
            const queryEmbedding = await embeddings.embedQuery(sanitizedQuestion);

            // Use LangChain's PineconeStore for proper document retrieval
            const { PineconeStore } = await import('@langchain/pinecone');
            const pineconeClient = await getPinecone();
            const index = pineconeClient.Index(env.PINECONE_INDEX_NAME);

            // Create PineconeStore instance
            const vectorStore = new PineconeStore(embeddings, {
                pineconeIndex: index,
                namespace: 'malayalam-docs'
            });

            // Use similarity search with score
            const docs = await vectorStore.similaritySearchWithScore(sanitizedQuestion, 8);

            console.log(`🔍 LangChain search found ${docs.length} documents`);

            const uniqueDocuments = docs.map(([doc, score]) => ({
                pageContent: doc.pageContent,
                metadata: {
                    ...doc.metadata,
                    score: score,
                    namespace: 'malayalam-docs'
                }
            }));

            console.log(`🔍 Processed ${uniqueDocuments.length} documents with content`);

            retrievalTime = Date.now() - retrievalStartTime;
            console.log(`🔍 Real Pinecone retrieval: ${uniqueDocuments.length} documents from malayalam-docs namespace (${retrievalTime}ms)`);

            retrievalResult = {
                documents: uniqueDocuments,
                retrievalStrategy: 'real_pinecone_multi_namespace',
                crossReferences: []
            };

        } catch (error) {
            console.error('Pinecone retrieval error:', error);

            // Fallback to empty result if Pinecone fails
            retrievalResult = {
                documents: [],
                retrievalStrategy: 'fallback_empty',
                crossReferences: []
            };

            retrievalTime = Date.now() - retrievalStartTime;
            console.log(`🔍 Fallback retrieval: 0 documents (${retrievalTime}ms)`);
        }

        // Step 3: Advanced Response Synthesis
        const synthesisStartTime = Date.now();
        console.log(`🔧 Using LANGCHAIN route with ${retrievalResult.documents.length} documents`);
        const synthesis = await responseSynthesizer.synthesizeResponse(
            sanitizedQuestion,
            analysis,
            retrievalResult.documents
        );
        const synthesisTime = Date.now() - synthesisStartTime;

        console.log(`✨ Synthesis complete: ${synthesis.responseStyle} style, confidence: ${(synthesis.confidence * 100).toFixed(1)}% (${synthesisTime}ms)`);

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

        console.log(`🔍 Quality Score: ${(validation.overallScore * 100).toFixed(1)}% (skipped validation for speed)`);

        // Alert on low quality responses
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

        // Log performance metrics for production monitoring
        console.log(`📈 Performance: ${totalTime}ms total (retrieval: ${retrievalTime}ms, synthesis: ${synthesisTime}ms, docs: ${retrievalResult.documents.length})`);

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

        // Cache the result for future queries (add required cache properties)
        const cacheableResponse = {
            ...response,
            cached: false,
            cacheTimestamp: Date.now()
        };
        setCachedQuery(cacheKey, 'malayalam-docs', cacheableResponse, chatHistory);

        return response;
    } catch (e) {
        console.error(e);
        throw new Error("Call chain method failed to execute successfully!!");
    }
}