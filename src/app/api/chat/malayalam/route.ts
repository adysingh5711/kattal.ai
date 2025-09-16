import { NextRequest } from "next/server";
import { streamingModel } from "@/lib/llm";
import { SystemMessage, HumanMessage, AIMessage, BaseMessage } from "@langchain/core/messages";
import { MalayalamPineconeProcessor } from "@/lib/malayalam-pinecone-processor";
import { env } from "@/lib/env";

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

// Global Malayalam processor instance
let globalMalayalamProcessor: MalayalamPineconeProcessor | null = null;

/**
 * Initialize Malayalam Pinecone Processor
 */
async function initializeMalayalamProcessor(): Promise<MalayalamPineconeProcessor> {
    if (!globalMalayalamProcessor) {
        console.log('🚀 Initializing Malayalam Pinecone Processor...');
        globalMalayalamProcessor = new MalayalamPineconeProcessor();
        await globalMalayalamProcessor.initialize();
        console.log('✅ Malayalam Pinecone Processor initialized');
    }
    return globalMalayalamProcessor;
}

/**
 * Streamlined Malayalam chat API endpoint
 * Focused on Malayalam language enforcement and table structure preservation
 */
export async function POST(request: NextRequest) {
    try {
        const { messages, namespaces = [env.PINECONE_NAMESPACE || 'malayalam-docs'] }: {
            messages: Message[];
            namespaces?: string[];
        } = await request.json();

        if (!messages || !Array.isArray(messages)) {
            return new Response(JSON.stringify({ error: "Invalid messages format" }), {
                status: 400,
                headers: { "Content-Type": "application/json" }
            });
        }

        const lastMessage = messages[messages.length - 1];
        if (!lastMessage || lastMessage.role !== "user") {
            return new Response(JSON.stringify({ error: "Last message must be from user" }), {
                status: 400,
                headers: { "Content-Type": "application/json" }
            });
        }

        const query = lastMessage.content;

        // Accept mixed English-Malayalam queries but respond only in Malayalam
        const malayalamRegex = /[\u0D00-\u0D7F]/;
        const hasEnglishOnly = /^[A-Za-z0-9\s.,!?'"()-]+$/.test(query.trim());

        // Allow English queries but warn that response will be in Malayalam
        if (hasEnglishOnly) {
            console.log(`⚠️  English query detected, will respond in Malayalam: "${query}"`);
        } else if (!malayalamRegex.test(query)) {
            return new Response(JSON.stringify({
                error: "ദയവായി മലയാളത്തിൽ അല്ലെങ്കിൽ ഇംഗ്ലീഷിൽ ചോദിക്കുക (Please ask in Malayalam or English)"
            }), {
                status: 400,
                headers: { "Content-Type": "application/json" }
            });
        }

        console.log(`🔍 Malayalam query: "${query.slice(0, 100)}..."`);
        console.log(`📂 Searching namespaces: ${namespaces.join(', ')}`);

        // Create streaming response
        const encoder = new TextEncoder();
        const stream = new ReadableStream({
            async start(controller) {
                try {
                    // Send search start event
                    const searchStartEvent: StreamEvent = {
                        type: 'search_start',
                        data: { query, namespaces }
                    };
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify(searchStartEvent)}\n\n`));

                    // Initialize processor and perform search
                    const processor = await initializeMalayalamProcessor();

                    const searchResult = await processor.searchAcrossNamespaces(
                        query,
                        namespaces,
                        {
                            k: 8, // More results for better context
                            scoreThreshold: 0.6, // Lower threshold for Malayalam
                            includeMetadata: true
                        }
                    );

                    const { documents, searchMetadata } = searchResult;

                    // Send search complete event
                    const searchCompleteEvent: StreamEvent = {
                        type: 'search_complete',
                        data: {
                            totalResults: searchMetadata.totalResults,
                            searchTime: searchMetadata.searchTime,
                            namespaceCounts: searchMetadata.namespaceCounts,
                            documentsFound: documents.length
                        }
                    };
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify(searchCompleteEvent)}\n\n`));

                    if (documents.length === 0) {
                        const noResultsEvent: StreamEvent = {
                            type: 'content',
                            content: "ക്ഷമിക്കണം, നിങ്ങളുടെ ചോദ്യത്തിന് അനുയോജ്യമായ ഉത്തരം കണ്ടെത്താൻ കഴിഞ്ഞില്ല. ദയവായി വേറെ വാക്കുകൾ ഉപയോഗിച്ച് ചോദിക്കാൻ ശ്രമിക്കുക."
                        };
                        controller.enqueue(encoder.encode(`data: ${JSON.stringify(noResultsEvent)}\n\n`));

                        const doneEvent: StreamEvent = { type: 'done' };
                        controller.enqueue(encoder.encode(`data: ${JSON.stringify(doneEvent)}\n\n`));
                        controller.close();
                        return;
                    }

                    // Build context from retrieved documents
                    const contextParts = documents.map((doc, index) => {
                        const metadata = doc.metadata;
                        let context = `\n## പ്രമാണം ${index + 1}: ${metadata.filename || 'അജ്ഞാത പ്രമാണം'}\n`;

                        if (metadata.hasTable) {
                            context += `**പട്ടിക ഉൾപ്പെടുന്നു**\n`;
                        }

                        if (metadata.headings && metadata.headings.length > 0) {
                            context += `**തലക്കെട്ടുകൾ:** ${metadata.headings.join(', ')}\n`;
                        }

                        context += `\n${doc.pageContent}\n`;

                        return context;
                    });

                    const fullContext = contextParts.join('\n---\n');

                    // Create Malayalam-focused system prompt for mixed content
                    const systemPrompt = `നിങ്ങൾ ഒരു മലയാളം സഹായിയാണ്. നൽകിയിരിക്കുന്ന പ്രമാണങ്ങളിൽ നിന്നും മാത്രം ഉത്തരം നൽകുക.

**കർശന നിർദ്ദേശങ്ങൾ:**
1. എല്ലാ ഉത്തരങ്ങളും മലയാളത്തിൽ മാത്രം നൽകുക (ഇംഗ്ലീഷ് ചോദ്യമായാലും മലയാളത്തിൽ ഉത്തരം നൽകുക)
2. സാങ്കേതിക പദങ്ങൾക്ക് മലയാളം പര്യായങ്ങൾ ഉപയോഗിക്കുക
3. ഇംഗ്ലീഷ് വാക്കുകൾ ഒഴിവാക്കുക, മലയാളം ഇല്ലാത്ത പദങ്ങൾ മാത്രം ഇംഗ്ലീഷിൽ എഴുതുക
4. പട്ടികയിലെ വിവരങ്ങൾ വ്യക്തമായി അവതരിപ്പിക്കുക
5. പ്രമാണത്തിന്റെ പേര് പരാമർശിക്കുക
6. വിവരങ്ങൾ കൃത്യമായി നൽകുക
7. അനിശ്ചിതത്വമുണ്ടെങ്കിൽ അത് സൂചിപ്പിക്കുക

**ഉദാഹരണങ്ങൾ:**
- "Budget" → "ബജറ്റ്" അല്ലെങ്കിൽ "വരുമാന-ചെലവ് പദ്ധതി"
- "Development" → "വികസനം"
- "Project" → "പദ്ധതി"
- "Government" → "സർക്കാർ"

**ലഭ്യമായ പ്രമാണങ്ങൾ:**
${fullContext}`;

                    // Generate streaming response with LangChain message types
                    const conversationMessages = [
                        new SystemMessage(systemPrompt),
                        ...messages.slice(-5).map((m) =>
                            m.role === "user" ? new HumanMessage(m.content) : new AIMessage(m.content)
                        ),
                    ];

                    const stream = await streamingModel.stream(conversationMessages as BaseMessage[]);

                    // Stream the response
                    for await (const chunk of stream) {
                        const rawContent = (chunk as any)?.content;
                        const contentText = Array.isArray(rawContent)
                            ? rawContent
                                .map((part: any) =>
                                    typeof part === 'string'
                                        ? part
                                        : (part?.text ?? (typeof part?.content === 'string' ? part.content : ''))
                                )
                                .join('')
                            : (rawContent ?? '');

                        if (typeof contentText === 'string' && contentText.length > 0) {
                            const contentEvent: StreamEvent = {
                                type: 'content',
                                content: contentText
                            };
                            controller.enqueue(encoder.encode(`data: ${JSON.stringify(contentEvent)}\n\n`));
                        }
                    }

                    // Send done event
                    const doneEvent: StreamEvent = { type: 'done' };
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify(doneEvent)}\n\n`));
                    controller.close();

                } catch (error) {
                    console.error('❌ Error in Malayalam chat stream:', error);
                    const errorEvent: StreamEvent = {
                        type: 'error',
                        error: error instanceof Error ? error.message : 'Unknown error'
                    };
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify(errorEvent)}\n\n`));
                    controller.close();
                }
            }
        });

        return new Response(stream, {
            headers: {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
            },
        });

    } catch (error) {
        console.error('❌ Error in Malayalam chat API:', error);
        return new Response(
            JSON.stringify({ error: "Internal server error" }),
            {
                status: 500,
                headers: { "Content-Type": "application/json" }
            }
        );
    }
}

export async function GET() {
    return new Response(
        JSON.stringify({
            message: "Malayalam Chat API - POST only",
            supportedLanguages: ["malayalam"],
            features: [
                "Malayalam language enforcement",
                "Table structure preservation",
                "Multi-namespace search",
                "Systematic ranking and retrieval"
            ]
        }),
        {
            status: 200,
            headers: { "Content-Type": "application/json" }
        }
    );
}
