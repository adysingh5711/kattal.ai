import { NextRequest } from "next/server";
import { Document } from "langchain/document";
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
    data?: unknown;
    content?: string;
    error?: string;
}

// Global hybrid search engine instance
let globalHybridSearch: HybridSearchEngine | null = null;
let isIndexBuilding = false;

/**
 * Load documents from Pinecone vector store for hybrid search index
 */
async function loadDocumentsFromPinecone(vectorStore: OptimizedVectorStore, maxDocuments: number = 100, userQuery?: string): Promise<Document[]> {
    const documents = [];

    try {
        console.log('📋 Loading documents from Pinecone for hybrid search...');

        // Get list of all namespaces from Pinecone
        const { env } = await import('@/lib/env');
        const { getPinecone } = await import('@/lib/pinecone-client');

        const pinecone = await getPinecone();
        const index = pinecone.Index(env.PINECONE_INDEX_NAME);
        const stats = await index.describeIndexStats();

        const namespaces = Object.keys(stats.namespaces || {});
        console.log(`🔍 Found ${namespaces.length} namespaces`);

        if (namespaces.length === 0) {
            console.warn('⚠️ No namespaces found in Pinecone index');
            return [];
        }

        // Fetch documents from selected best namespaces for diversity and relevance
        const docsPerNamespace = Math.ceil(maxDocuments / Math.min(10, namespaces.length));

        // Select up to 10 best namespaces (prefer tables/headings and topic-related)
        const scoredNamespaces = namespaces.map(ns => ({
            ns,
            score: (() => {
                const n = ns.toLowerCase();
                let s = 0;
                if (n.includes('table')) s += 3;
                if (n.includes('heading')) s += 2;
                if (n.includes('text')) s += 1;
                if (n.includes('list')) s += 1;
                if (n.includes('kattakada') || n.includes('കാട്ടാക്കട')) s += 10;
                if (n.includes('neyyattinkara') || n.includes('നെയ്യാറ്റിൻകര')) s += 8;
                if (n.includes('development') || n.includes('വികസനം')) s += 6;
                if (n.includes('agriculture') || n.includes('കൃഷി') || n.includes('farming')) s += 8;
                if (n.includes('website_scraped')) s += 15; // These contain IB Sateesh info!
                if (n.includes('activityreport')) s += 12;
                if (n.includes('waterqualityreport')) s += 10;
                if (n.includes('site_content')) s += 10;
                if (ns === 'default') s += 1;
                return s;
            })()
        }))
            .sort((a, b) => b.score - a.score)
            .slice(0, Math.min(15, namespaces.length)) // Increased to include website-scraped namespaces
            .map(x => x.ns);

        for (const namespace of scoredNamespaces) {
            try {
                console.log(`   📄 Fetching from namespace: ${namespace.slice(0, 30)}...`);

                // Try user query first, then fallback to generic queries
                let testQueries = ['document', 'text', 'content'];

                if (userQuery) {
                    // Add user query and related terms
                    testQueries = [userQuery];

                    // Add specific search terms for political queries
                    if (userQuery.toLowerCase().includes('mla') || userQuery.toLowerCase().includes('kattakkada')) {
                        testQueries.push(
                            'കാട്ടാക്കട എം.എല്.എ',
                            'ഐ.ബി. സതീഷ്',
                            'കാട്ടാക്കട നിയോജകമണ്ഡലം',
                            'Kattakkada MLA',
                            'സതീഷ് എം.എല്.എ'
                        );
                    }

                    // Add fallback generic queries
                    testQueries.push('document', 'text', 'content');
                }

                for (const query of testQueries) {
                    try {
                        const requestedK = Math.max(1, Math.floor(docsPerNamespace / testQueries.length));
                        // optimizedRetrieval multiplies k by 1.5, so we need to account for that and ensure integer
                        const adjustedK = Math.max(1, Math.round(requestedK / 1.5));

                        const namespaceDocs = await vectorStore.optimizedRetrieval(query, {
                            k: adjustedK,
                            namespace,
                            scoreThreshold: 0.1
                        });

                        if (namespaceDocs.length > 0) {
                            documents.push(...namespaceDocs);
                            console.log(`   ✅ Found ${namespaceDocs.length} documents from ${namespace.slice(0, 20)}...`);

                            // Log content preview for debugging
                            namespaceDocs.forEach((doc, i) => {
                                if (query.toLowerCase().includes('mla') || query.toLowerCase().includes('kattakkada')) {
                                    console.log(`      Preview ${i + 1}: ${doc.pageContent.slice(0, 150)}...`);
                                }
                            });

                            break; // Found documents, move to next namespace
                        }
                    } catch {
                        // Continue to next query
                        console.log(`   🔄 Query "${query}" failed, trying next...`);
                    }
                }
            } catch (error) {
                console.warn(`   ⚠️ Failed to fetch from namespace ${namespace}: ${error}`);
            }

            // Stop if we have enough documents
            if (documents.length >= maxDocuments) {
                console.log(`🛑 Reached document limit (${maxDocuments})`);
                break;
            }
        }

        // Remove duplicates
        const uniqueDocuments = [];
        const seenContent = new Set();

        for (const doc of documents) {
            const contentKey = doc.pageContent.slice(0, 100);
            if (!seenContent.has(contentKey)) {
                seenContent.add(contentKey);
                uniqueDocuments.push(doc);
            }
        }

        console.log(`📚 Loaded ${uniqueDocuments.length} unique documents for hybrid search`);
        return uniqueDocuments.slice(0, maxDocuments);

    } catch (error) {
        console.error('❌ Failed to load documents from Pinecone:', error);
        return [];
    }
}

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

            try {
                // Load actual documents from Pinecone vector store
                const documents = await loadDocumentsFromPinecone(vectorStore, 100);

                if (documents.length > 0) {
                    console.log(`📊 Building hybrid search index with ${documents.length} documents...`);
                    await globalHybridSearch.buildSearchIndex(documents);
                    console.log('✅ Hybrid search index built successfully');
                } else {
                    console.warn('⚠️ No documents loaded, hybrid search will not be available');
                }

                isIndexBuilding = false;
            } catch (error) {
                console.error('❌ Failed to build search index:', error);
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
                let isControllerClosed = false;

                // Helper function to safely enqueue data
                const safeEnqueue = (data: Uint8Array) => {
                    if (!isControllerClosed) {
                        try {
                            controller.enqueue(data);
                        } catch (error) {
                            console.warn('Controller already closed, skipping enqueue');
                            isControllerClosed = true;
                        }
                    }
                };

                // Helper function to safely close controller
                const safeClose = () => {
                    if (!isControllerClosed) {
                        try {
                            controller.close();
                            isControllerClosed = true;
                        } catch (error) {
                            console.warn('Controller already closed');
                            isControllerClosed = true;
                        }
                    }
                };

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
                    safeEnqueue(encoder.encode(`data: ${JSON.stringify(analysisEvent)}\n\n`));

                    // Step 3: Perform hybrid search on pre-loaded documents
                    const hybridSearch = await getHybridSearchEngine();
                    const healthCheck = await hybridSearch.healthCheck();

                    let searchResults;

                    if (healthCheck.status === 'healthy') {
                        // Load documents again to get namespace constraints
                        console.log(`🔍 Loading documents for namespace constraint...`);
                        const optimizedStore = new OptimizedVectorStore();
                        const constraintDocuments = await loadDocumentsFromPinecone(optimizedStore, 50, question);

                        // Force hybrid search to use specific namespaces that contain our documents
                        const relevantNamespaces = [...new Set(constraintDocuments.map(doc =>
                            doc.metadata?.namespace || 'default'
                        ))];

                        console.log(`🎯 Constraining search to ${relevantNamespaces.length} namespaces: ${relevantNamespaces.slice(0, 3).join(', ')}...`);

                        searchResults = await hybridSearch.intelligentSearch(question, analysis, {
                            k: analysis.suggestedK,
                            scoreThreshold: 0.01, // Very low threshold
                            enableFuse: true,
                            constrainToNamespaces: relevantNamespaces // Add constraint
                        });
                    } else {
                        // Fallback to semantic search only with namespace constraints
                        console.log(`⚠️ Hybrid search unavailable, using semantic fallback with constraints`);
                        const vectorStore = new OptimizedVectorStore();

                        // Load documents to get correct namespaces
                        const optimizedStore2 = new OptimizedVectorStore();
                        const constraintDocuments = await loadDocumentsFromPinecone(optimizedStore2, 50, question);
                        const relevantNamespaces = [...new Set(constraintDocuments.map(doc =>
                            doc.metadata?.namespace || 'default'
                        ))];

                        console.log(`🎯 Fallback search constrained to ${relevantNamespaces.length} namespaces`);

                        // Search across the relevant namespaces
                        const namespaceSearches = relevantNamespaces.slice(0, 10).map(namespace =>
                            vectorStore.optimizedRetrieval(question, {
                                k: Math.ceil(analysis.suggestedK / relevantNamespaces.length) + 1,
                                scoreThreshold: 0.01,
                                namespace
                            })
                        );

                        const namespaceResults = await Promise.all(namespaceSearches);
                        const docs = namespaceResults.flat().slice(0, analysis.suggestedK);

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
                    safeEnqueue(encoder.encode(`data: ${JSON.stringify(searchEvent)}\n\n`));

                    // Step 4: Generate streaming response
                    if (searchResults.documents.length === 0) {
                        // No documents found
                        const noResultsContent = "സോറി! വ്യക്തമായ മറുപടി നൽകാൻ പോരായിപ്പോയി. ചോദ്യം വീണ്ടും പറഞ്ഞുതരാമോ, അല്ലെങ്കിൽ കുറച്ച് കൂടി വിശദമായി പറയാമോ?";

                        const contentEvent: StreamEvent = {
                            type: 'content',
                            content: noResultsContent
                        };
                        safeEnqueue(encoder.encode(`data: ${JSON.stringify(contentEvent)}\n\n`));
                    } else {
                        // Use response synthesizer to create context-aware prompt
                        await responseSynthesizer.synthesizeResponse(
                            question,
                            analysis,
                            searchResults.documents
                        );

                        console.log(`🔧 Using STREAMING route with ${searchResults.documents.length} documents`);

                        // Debug: Check if documents contain IB Sateesh
                        const docsWithSateesh = searchResults.documents.filter(doc =>
                            doc.pageContent.includes('ഐ.ബി. സതീഷ്') ||
                            doc.pageContent.includes('ഐ. ബി. സതീഷ്') ||
                            doc.pageContent.includes('സതീഷ് എം.എല്.എ')
                        );
                        console.log(`🔍 Documents containing IB Sateesh: ${docsWithSateesh.length}/${searchResults.documents.length}`);
                        if (docsWithSateesh.length > 0) {
                            console.log(`✅ Found IB Sateesh in: ${docsWithSateesh[0].pageContent.slice(0, 200)}...`);
                        }

                        // Create enhanced system prompt with search context
                        const systemPrompt = `🚨 CRITICAL INSTRUCTIONS - READ CAREFULLY 🚨

You are analyzing Kerala state documents. Answer ONLY in Malayalam using ONLY the provided documents.

🚫 ABSOLUTE PROHIBITION:
- DO NOT use your pre-trained knowledge about any person, place, or fact
- DO NOT mention names not explicitly found in the documents
- DO NOT make up information or hallucinate facts
- ONLY use information from the provided documents below
- If documents don't contain specific information, state that clearly
- NEVER respond in English or any other language - ONLY Malayalam
- NEVER mention "A. Rajendran", "A. Pradeep Kumar", or any person not in the documents

Search Context:
- Search method: ${searchResults.searchMetadata.searchStrategy}
- Documents found: ${searchResults.documents.length}
- Search time: ${searchResults.searchMetadata.searchTime}ms

RESPOND IN MALAYALAM ONLY with information based ONLY on the documents below:

Context Documents:
${searchResults.documents.map((doc, i) =>
                            `[Document ${i + 1}] (Score: ${(doc.metadata?._hybridScore as number || 0).toFixed(3)})
Source: ${doc.metadata?.source || 'Unknown'}
Content: ${doc.pageContent}`
                        ).join('\n\n')}

🚫 ABSOLUTE MALAYALAM ENFORCEMENT 🚫
- RESPOND ONLY IN MALAYALAM SCRIPT (മലയാളം)
- NEVER USE ENGLISH, HINDI, TAMIL, TELUGU, KANNADA, OR ANY OTHER LANGUAGE
- CONVERT ALL TECHNICAL TERMS TO MALAYALAM EQUIVALENTS
- USE PROPER MALAYALAM GRAMMAR AND VOCABULARY
- NO EXCEPTIONS - MALAYALAM SCRIPT ONLY`;

                        // Stream the response
                        const stream = await streamingModel.stream([
                            { role: "system", content: systemPrompt },
                            { role: "user", content: question }
                        ]);

                        for await (const chunk of stream) {
                            if (isControllerClosed) break; // Exit if controller is closed

                            if (chunk.content) {
                                const contentEvent: StreamEvent = {
                                    type: 'content',
                                    content: typeof chunk.content === 'string' ? chunk.content : JSON.stringify(chunk.content)
                                };
                                safeEnqueue(encoder.encode(`data: ${JSON.stringify(contentEvent)}\n\n`));
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
                    safeEnqueue(encoder.encode(`data: ${JSON.stringify(doneEvent)}\n\n`));

                } catch (error) {
                    console.error('Streaming error:', error);

                    // Only send error if controller is still open
                    if (!isControllerClosed) {
                        const errorEvent: StreamEvent = {
                            type: 'error',
                            error: error instanceof Error ? error.message : 'An unexpected error occurred'
                        };
                        safeEnqueue(encoder.encode(`data: ${JSON.stringify(errorEvent)}\n\n`));
                    }
                } finally {
                    safeClose();
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
