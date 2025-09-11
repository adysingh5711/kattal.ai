import { NextRequest } from "next/server";
import { streamingModel } from "@/lib/llm";
import { HybridSearchEngine } from "@/lib/hybrid-search-engine";
import { OptimizedVectorStore } from "@/lib/optimized-vector-store";
import { QueryAnalyzer } from "@/lib/query-analyzer";
import { ResponseSynthesizer } from "@/lib/response-synthesizer";
import { PerformanceOptimizer } from "@/lib/performance-optimizer";

interface Message {
    role: "user" | "assistant";
    content: string;
}

interface StreamEvent {
    type: 'search_start' | 'search_complete' | 'content' | 'done' | 'error';
    data?: any;
    content?: string;
    error?: string;
}

// Global hybrid search engine instance
let globalHybridSearch: HybridSearchEngine | null = null;
let isIndexBuilding = false;

async function getHybridSearchEngine(): Promise<HybridSearchEngine> {
    if (!globalHybridSearch) {
        console.log('🔄 Initializing hybrid search engine...');
        const vectorStore = new OptimizedVectorStore();
        globalHybridSearch = new HybridSearchEngine(vectorStore);

        // Check if index needs to be built
        const healthCheck = await globalHybridSearch.healthCheck();
        if (!healthCheck.stats.isBuilt && !isIndexBuilding) {
            console.log('🔨 Building search index in background...');
            isIndexBuilding = true;

            // Build index in background (you might want to do this during app startup)
            // For now, we'll use a mock set of documents
            // In production, you'd load from your document store
            try {
                // This is a placeholder - in real implementation, load your documents
                const mockDocs = []; // await loadDocumentsFromStore();
                if (mockDocs.length > 0) {
                    await globalHybridSearch.buildSearchIndex(mockDocs);
                }
                isIndexBuilding = false;
            } catch (error) {
                console.error('Failed to build search index:', error);
                isIndexBuilding = false;
            }
        }
    }
    return globalHybridSearch;
}

export async function POST(req: NextRequest) {
    const encoder = new TextEncoder();

    try {
        const body = await req.json();
        const messages: Message[] = body.messages ?? [];

        if (!messages.length || !messages[messages.length - 1].content) {
            return new Response("Error: No question in the request", { status: 400 });
        }

        const question = messages[messages.length - 1].content.trim();
        const chatHistory = messages.slice(0, -1).map(msg =>
            `${msg.role === "user" ? "Human" : "Assistant"}: ${msg.content}`
        ).join("\n");

        // Create streaming response
        const stream = new ReadableStream({
            async start(controller) {
                try {
                    // Step 1: Initialize components
                    const queryAnalyzer = new QueryAnalyzer();
                    const responseSynthesizer = new ResponseSynthesizer();
                    const performanceOptimizer = new PerformanceOptimizer();

                    // Step 2: Analyze query
                    console.log(`🧠 Analyzing query: "${question.slice(0, 50)}..."`);

                    const analysis = await queryAnalyzer.classifyQuery(question, chatHistory);
                    const optimizationResult = await performanceOptimizer.optimizeQuery(
                        question,
                        analysis,
                        chatHistory
                    );

                    // Send analysis metadata
                    const analysisEvent: StreamEvent = {
                        type: 'search_start',
                        data: {
                            queryType: analysis.queryType,
                            complexity: analysis.complexity,
                            estimatedTime: optimizationResult.estimatedTime,
                            keyEntities: analysis.keyEntities
                        }
                    };
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify(analysisEvent)}\n\n`));

                    // Step 3: Perform hybrid search
                    const hybridSearch = await getHybridSearchEngine();
                    const healthCheck = await hybridSearch.healthCheck();

                    let searchResults;

                    if (healthCheck.status === 'healthy') {
                        // Use hybrid search
                        console.log(`🔍 Performing hybrid search...`);
                        searchResults = await hybridSearch.intelligentSearch(question, analysis, {
                            k: analysis.suggestedK,
                            scoreThreshold: 0.1,
                            enableFuse: true
                        });
                    } else {
                        // Fallback to semantic search only
                        console.log(`⚠️ Hybrid search unavailable, using semantic fallback`);
                        const vectorStore = new OptimizedVectorStore();
                        const docs = await vectorStore.optimizedRetrieval(question, {
                            k: analysis.suggestedK,
                            scoreThreshold: 0.6
                        });

                        searchResults = {
                            documents: docs,
                            results: docs.map(doc => ({
                                document: doc,
                                bm25Score: 0,
                                semanticScore: doc.metadata?._score || 0,
                                fuseScore: 0,
                                hybridScore: doc.metadata?._score || 0,
                                searchMethod: 'semantic' as const
                            })),
                            searchMetadata: {
                                totalResults: docs.length,
                                bm25Results: 0,
                                semanticResults: docs.length,
                                fuseResults: 0,
                                searchTime: 0,
                                searchStrategy: 'semantic-fallback'
                            }
                        };
                    }

                    // Send search completion metadata
                    const searchEvent: StreamEvent = {
                        type: 'search_complete',
                        data: {
                            ...searchResults.searchMetadata,
                            documentsFound: searchResults.documents.length,
                            searchHealth: healthCheck.status
                        }
                    };
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify(searchEvent)}\n\n`));

                    // Step 4: Generate streaming response
                    if (searchResults.documents.length === 0) {
                        // No documents found
                        const noResultsContent = "I couldn't find relevant information in the documents to answer your question. Could you please rephrase your question or provide more context?";

                        const contentEvent: StreamEvent = {
                            type: 'content',
                            content: noResultsContent
                        };
                        controller.enqueue(encoder.encode(`data: ${JSON.stringify(contentEvent)}\n\n`));
                    } else {
                        // Use response synthesizer to create context-aware prompt
                        const synthesis = await responseSynthesizer.synthesizeResponse(
                            question,
                            analysis,
                            searchResults.documents
                        );

                        // Create enhanced system prompt with search context
                        const systemPrompt = `You are a knowledgeable assistant with access to specific documents. 

Search Context:
- Search method: ${searchResults.searchMetadata.searchStrategy}
- Documents found: ${searchResults.documents.length}
- Search time: ${searchResults.searchMetadata.searchTime}ms

Response Guidelines:
- Use the provided context to answer accurately and comprehensively
- If information is not in the context, clearly state this
- Cite relevant sources when possible
- Be concise but thorough
- Maintain a helpful and professional tone

Context Documents:
${searchResults.documents.map((doc, i) =>
                            `[Document ${i + 1}] (Score: ${(doc.metadata?._hybridScore as number || 0).toFixed(3)})
Source: ${doc.metadata?.source || 'Unknown'}
Content: ${doc.pageContent}`
                        ).join('\n\n')}`;

                        // Stream the response
                        const stream = await streamingModel.stream([
                            { role: "system", content: systemPrompt },
                            { role: "user", content: question }
                        ]);

                        for await (const chunk of stream) {
                            if (chunk.content) {
                                const contentEvent: StreamEvent = {
                                    type: 'content',
                                    content: chunk.content
                                };
                                controller.enqueue(encoder.encode(`data: ${JSON.stringify(contentEvent)}\n\n`));
                            }
                        }
                    }

                    // Send completion with sources
                    const doneEvent: StreamEvent = {
                        type: 'done',
                        data: {
                            sources: searchResults.results.map(result => ({
                                source: result.document.metadata?.source || 'Unknown',
                                score: result.hybridScore,
                                bm25Score: result.bm25Score,
                                semanticScore: result.semanticScore,
                                fuseScore: result.fuseScore,
                                searchMethod: result.searchMethod
                            })),
                            responseMetadata: {
                                queryType: analysis.queryType,
                                complexity: analysis.complexity,
                                searchStrategy: searchResults.searchMetadata.searchStrategy,
                                totalSearchTime: searchResults.searchMetadata.searchTime
                            }
                        }
                    };
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify(doneEvent)}\n\n`));

                } catch (error) {
                    console.error('Streaming error:', error);
                    const errorEvent: StreamEvent = {
                        type: 'error',
                        error: error instanceof Error ? error.message : 'An unexpected error occurred'
                    };
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify(errorEvent)}\n\n`));
                } finally {
                    controller.close();
                }
            }
        });

        return new Response(stream, {
            headers: {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST',
                'Access-Control-Allow-Headers': 'Content-Type',
            },
        });

    } catch (error) {
        console.error("Streaming API error:", error);
        return new Response(
            JSON.stringify({ error: "Something went wrong. Try again!" }),
            {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            }
        );
    }
}

// Health check endpoint
export async function GET() {
    try {
        const hybridSearch = await getHybridSearchEngine();
        const healthCheck = await hybridSearch.healthCheck();

        return Response.json({
            status: 'ok',
            hybridSearch: healthCheck,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        return Response.json({
            status: 'error',
            error: error instanceof Error ? error.message : 'Unknown error',
            timestamp: new Date().toISOString()
        }, { status: 500 });
    }
}
