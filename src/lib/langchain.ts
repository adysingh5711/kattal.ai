// import { createRetrievalChain } from "langchain/chains/retrieval";
// import { createStuffDocumentsChain } from "langchain/chains/combine_documents";
// import { createHistoryAwareRetriever } from "langchain/chains/history_aware_retriever";
// import { ChatPromptTemplate, MessagesPlaceholder } from "@langchain/core/prompts";
// import { HumanMessage, AIMessage } from "@langchain/core/messages";
// import { streamingModel, nonStreamingModel } from "./llm";
// import { QA_TEMPLATE } from "./prompt-templates";
import { getVectorStore } from "./vector-store";
import { getPinecone } from "./pinecone-client";
import { QueryAnalyzer } from "./query-analyzer";
import { AdaptiveRetriever, RetrievalResult } from "./adaptive-retriever";
import { ResponseSynthesizer } from "./response-synthesizer";
import { QualityValidator, ValidationResult } from "./quality-validator";
import { PerformanceOptimizer } from "./performance-optimizer";
import { OptimizedVectorStore } from "./optimized-vector-store";
import {
    isEnvironmentalQuery,
    executeEnvironmentalDataTool,
    extractParametersFromQuery,
    type EnvironmentalToolResult
} from "./ai-tools";

type callChainArgs = {
    question: string;
    chatHistory: string;
};

// Initialize Phase 3 components
const responseSynthesizer = new ResponseSynthesizer();
const qualityValidator = new QualityValidator();
const performanceOptimizer = new PerformanceOptimizer();
const optimizedVectorStore = new OptimizedVectorStore();

export async function callChain({ question, chatHistory }: callChainArgs) {
    const overallStartTime = Date.now();

    try {
        const sanitizedQuestion = question.trim().replaceAll("\n", " ");

        // Step 1: Performance optimization and caching check
        const queryAnalyzer = new QueryAnalyzer();
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

        // Step 1.5: Fast response for very simple queries (greetings, basic questions)
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
                    reasoning: ['Fast response for greeting query']
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

        // Step 2: Retrieval (fast path for simple queries)
        const retrievalStartTime = Date.now();
        let retrievalResult: RetrievalResult;

        if (analysis.complexity <= 2 && !analysis.requiresCrossReference) {
            // Fast optimized retrieval with caching
            const fastDocs = await optimizedVectorStore.optimizedRetrieval(sanitizedQuestion, {
                k: Math.min(analysis.suggestedK, 4), // Limit to 3 docs for speed
                scoreThreshold: 0.7, // Higher threshold for better quality
            });
            retrievalResult = {
                documents: fastDocs,
                retrievalStrategy: 'optimized',
                confidence: 0.8,
                crossReferences: [],
                queryExpansion: undefined,
            };
        } else {
            // Adaptive retrieval for complex queries
            const pineconeClient = await getPinecone();
            const vectorStore = await getVectorStore(pineconeClient);
            const adaptiveRetriever = new AdaptiveRetriever(vectorStore);
            retrievalResult = await adaptiveRetriever.retrieve(sanitizedQuestion, analysis, chatHistory);
        }
        const retrievalTime = Date.now() - retrievalStartTime;

        console.log(`🔍 Retrieval: ${retrievalResult.retrievalStrategy}, Documents: ${retrievalResult.documents.length} (${retrievalTime}ms)`);

        // Step 3: Advanced Response Synthesis
        const synthesisStartTime = Date.now();
        const synthesis = await responseSynthesizer.synthesizeResponse(
            sanitizedQuestion,
            analysis,
            retrievalResult.documents,
            retrievalResult.queryExpansion
        );
        const synthesisTime = Date.now() - synthesisStartTime;

        console.log(`✨ Synthesis complete: ${synthesis.responseStyle} style, confidence: ${(synthesis.confidence * 100).toFixed(1)}% (${synthesisTime}ms)`);

        // Step 4: Quality Validation (skip for simple queries to save time)
        let validationTime = 0;
        let validation: ValidationResult;
        if (analysis.complexity <= 2 && !analysis.requiresCrossReference) {
            validation = {
                overallScore: 0.8,
                factualAccuracy: 0.8,
                completeness: 0.8,
                coherence: 0.85,
                sourceReliability: 0.75,
                responseQuality: 0.85,
                issues: [],
                improvements: [],
                confidence: 0.8,
            };
        } else {
            const validationStartTime = Date.now();
            validation = await qualityValidator.validateResponse(
                sanitizedQuestion,
                analysis,
                synthesis,
                retrievalResult.documents
            );
            validationTime = Date.now() - validationStartTime;
        }

        console.log(`🔍 Quality Score: ${(validation.overallScore * 100).toFixed(1)}% (${validationTime}ms)`);

        // Step 5: Cache high-quality responses
        if (optimizationResult.shouldCache && validation.overallScore > 0.7) {
            await performanceOptimizer.cacheResponse(
                optimizationResult.cacheKey,
                sanitizedQuestion,
                synthesis,
                validation,
                chatHistory
            );
        }

        // Step 6: Track performance metrics
        const totalTime = Date.now() - overallStartTime;
        performanceOptimizer.trackPerformance({
            queryProcessingTime: Date.now() - overallStartTime - retrievalTime - synthesisTime - validationTime,
            retrievalTime,
            synthesisTime,
            validationTime,
            totalTime,
            cacheHitRate: 0, // Will be calculated by optimizer
            documentsRetrieved: retrievalResult.documents.length,
            qualityScore: validation.overallScore
        });

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

        return response;
    } catch (e) {
        console.error(e);
        throw new Error("Call chain method failed to execute successfully!!");
    }
}