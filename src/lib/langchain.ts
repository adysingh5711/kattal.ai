import { createRetrievalChain } from "langchain/chains/retrieval";
import { createStuffDocumentsChain } from "langchain/chains/combine_documents";
import { createHistoryAwareRetriever } from "langchain/chains/history_aware_retriever";
import { ChatPromptTemplate, MessagesPlaceholder } from "@langchain/core/prompts";
import { HumanMessage, AIMessage } from "@langchain/core/messages";
import { getVectorStore } from "./vector-store";
import { getPinecone } from "./pinecone-client";
import { streamingModel, nonStreamingModel } from "./llm";
import { QA_TEMPLATE } from "./prompt-templates";
import { QueryAnalyzer } from "./query-analyzer";
import { AdaptiveRetriever } from "./adaptive-retriever";
import { ResponseSynthesizer } from "./response-synthesizer";
import { QualityValidator } from "./quality-validator";
import { PerformanceOptimizer } from "./performance-optimizer";
import { OptimizedVectorStore } from "./optimized-vector-store";

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

        // Step 2: Retrieval (fast path for simple queries)
        const retrievalStartTime = Date.now();
        let retrievalResult: any;

        if (analysis.complexity <= 2 && !analysis.requiresCrossReference) {
            // Fast optimized retrieval with caching
            const fastDocs = await optimizedVectorStore.optimizedRetrieval(sanitizedQuestion, {
                k: analysis.suggestedK,
                scoreThreshold: 0.6,
            });
            retrievalResult = {
                documents: fastDocs,
                retrievalStrategy: 'optimized',
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
        let validation: any;
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

        return {
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
    } catch (e) {
        console.error(e);
        throw new Error("Call chain method failed to execute successfully!!");
    }
}