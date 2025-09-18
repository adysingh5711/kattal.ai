import { NextRequest } from "next/server";
import { callChain } from "@/lib/langchain";
import { streamingModel } from "@/lib/llm";
import { SystemMessage, HumanMessage, AIMessage, BaseMessage } from "@langchain/core/messages";
import { showErrorInChat } from "@/lib/error-messages";

interface Message {
    role: "user" | "assistant";
    content: string;
}

interface StreamEvent {
    type: 'search_start' | 'search_complete' | 'content' | 'done' | 'error' | 'loading_start' | 'loading_complete' | 'clear_message';
    content?: string;
    data?: {
        query?: string;
        documentsUsed?: number;
        message?: string;
        clearPrevious?: boolean;
        sources?: Array<{
            source: string;
            relevance: number;
            usedFor: string;
            contentType: 'text' | 'table' | 'chart' | 'image';
            pageReference?: string;
        }>;
    };
    error?: string;
}

/**
 * Check if query is about specific political facts and return direct answer
 * This bypasses LLM hallucination for known political information
 */
function checkPoliticalQuery(query: string): string | null {
    const lowerQuery = query.toLowerCase();

    // Kattakkada MLA queries - multiple variations
    if ((lowerQuery.includes('kattakkada') || lowerQuery.includes('കാട്ടക്കട') || lowerQuery.includes('കാട്ടാക്കട')) &&
        (lowerQuery.includes('mla') || lowerQuery.includes('എം.എൽ.എ') || lowerQuery.includes('എം.എല്.എ') ||
            lowerQuery.includes('aaranu') || lowerQuery.includes('ആര്') || lowerQuery.includes('ആരാണ്') ||
            lowerQuery.includes('representative') || lowerQuery.includes('member') || lowerQuery.includes('who is'))) {
        return "കാട്ടക്കട മണ്ഡലത്തിലെ എം.എൽ.എ. ഐ.ബി.സതീഷ് ആണ്.";
    }

    return null;
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const messages: Message[] = body.messages ?? [];

        if (!messages.length || !messages[messages.length - 1].content) {
            const errorDetails = showErrorInChat(
                "No question in the request",
                'stream_api_validation',
                { requestBody: body }
            );
            return new Response(
                JSON.stringify({
                    error: errorDetails.userMessage,
                    technicalError: errorDetails.technicalMessage
                }),
                { status: 400, headers: { "Content-Type": "application/json" } }
            );
        }

        const question = messages[messages.length - 1].content;
        const chatHistory = messages.slice(0, -1).map(m =>
            `${m.role === "user" ? "Human" : "Assistant"}: ${m.content}`
        ).join("\n");

        // Check for direct political responses to avoid LLM hallucination
        const politicalResponse = checkPoliticalQuery(question);
        if (politicalResponse) {
            console.log(`🎯 Direct political response provided for: ${question}`);

            const stream = new ReadableStream({
                start(controller) {
                    const encoder = new TextEncoder();

                    // Send the direct response
                    const contentEvent: StreamEvent = {
                        type: 'content',
                        content: politicalResponse
                    };
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify(contentEvent)}\n\n`));

                    // Send done event
                    const doneEvent: StreamEvent = {
                        type: 'done',
                        data: { sources: [], documentsUsed: 0 }
                    };
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify(doneEvent)}\n\n`));
                    controller.close();
                }
            });

            return new Response(stream, {
                headers: {
                    'Content-Type': 'text/event-stream',
                    'Cache-Control': 'no-cache',
                    'Connection': 'keep-alive',
                },
            });
        }

        // Create streaming response with parallel processing
        const stream = new ReadableStream({
            async start(controller) {
                const encoder = new TextEncoder();

                try {
                    // Send search start event immediately
                    const searchStartEvent: StreamEvent = {
                        type: 'search_start',
                        data: { query: question }
                    };
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify(searchStartEvent)}\n\n`));

                    // Start document retrieval in parallel with initial response
                    const contextPromise = callChain({
                        question,
                        chatHistory,
                    });

                    // Send initial Malayalam message
                    const initialMessage = `ഞാൻ "${question.slice(0, 50)}${question.length > 50 ? '...' : ''}" പറ്റിയ വിവരങ്ങൾ നോക്കിക്കൊണ്ടിരിക്കുക...`;

                    const initialEvent: StreamEvent = {
                        type: 'content',
                        content: initialMessage
                    };
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify(initialEvent)}\n\n`));

                    // Send loading start event
                    const loadingStartEvent: StreamEvent = {
                        type: 'loading_start',
                        data: { message: 'Searching documents...' }
                    };
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify(loadingStartEvent)}\n\n`));

                    // Wait for context to be ready
                    const result = await contextPromise;

                    // Send loading complete and clear message event
                    const loadingCompleteEvent: StreamEvent = {
                        type: 'loading_complete',
                        data: {
                            documentsUsed: result.analysis?.documentsUsed || 0,
                            sources: result.sources || []
                        }
                    };
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify(loadingCompleteEvent)}\n\n`));

                    // Send clear message event to remove the initial Malayalam message
                    const clearMessageEvent: StreamEvent = {
                        type: 'clear_message',
                        data: { clearPrevious: true }
                    };
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify(clearMessageEvent)}\n\n`));

                    // Create optimized system prompt (removed redundant instructions)
                    const systemPrompt = `Answer based on the provided context. Be concise and accurate.

**Context:**
${result.text || 'No relevant context found.'}

**Sources:**
${result.sources?.map((source: { source: string }) => `- ${source.source}`).join('\n') || 'No sources available'}`;

                    // Generate streaming response with existing model
                    const conversationMessages = [
                        new SystemMessage(systemPrompt),
                        ...messages.slice(-5).map((m) =>
                            m.role === "user" ? new HumanMessage(m.content) : new AIMessage(m.content)
                        ),
                    ];

                    const modelStream = await streamingModel.stream(conversationMessages as BaseMessage[]);

                    // Stream the response
                    for await (const chunk of modelStream) {
                        const rawContent = (chunk as { content?: string | Array<{ text?: string; content?: string }> })?.content;
                        const contentText = Array.isArray(rawContent)
                            ? rawContent
                                .map((part: { text?: string; content?: string }) =>
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

                    // Send done event with sources
                    const doneEvent: StreamEvent = {
                        type: 'done',
                        data: {
                            sources: result.sources || [],
                            documentsUsed: result.analysis?.documentsUsed || 0
                        }
                    };
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify(doneEvent)}\n\n`));
                    controller.close();

                } catch (error) {
                    const errorDetails = showErrorInChat(
                        error instanceof Error ? error : new Error(String(error)),
                        'stream_processing',
                        {
                            question: question.substring(0, 100),
                            chatHistoryLength: chatHistory.length,
                            timestamp: new Date().toISOString()
                        }
                    );
                    console.error('❌ Error in chat stream:', errorDetails.technicalMessage);
                    const errorEvent: StreamEvent = {
                        type: 'error',
                        error: errorDetails.userMessage // Send Malayalam message to frontend
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
        const errorDetails = showErrorInChat(
            error instanceof Error ? error : new Error(String(error)),
            'stream_api_route',
            {
                endpoint: '/api/chat/stream',
                timestamp: new Date().toISOString()
            }
        );
        console.error('❌ Error in chat stream API:', errorDetails.technicalMessage);
        return new Response(
            JSON.stringify({
                error: errorDetails.userMessage,
                technicalError: errorDetails.technicalMessage
            }),
            {
                status: 500,
                headers: { "Content-Type": "application/json" }
            }
        );
    }
}
