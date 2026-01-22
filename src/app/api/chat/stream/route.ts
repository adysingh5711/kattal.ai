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
function checkSpecialQueries(query: string): string | null {
    const lowerQuery = query.toLowerCase();

    // Identity queries - who are you
    if (lowerQuery.includes('who are you') || lowerQuery.includes('who are u') ||
        lowerQuery.includes('നീ ആരാ') || lowerQuery.includes('നിങ്ങൾ ആരാ') ||
        lowerQuery.includes('ആരാണ് നീ') || lowerQuery.includes('ആരാണ് നിങ്ങൾ') ||
        lowerQuery.includes('what is your name') ||
        lowerQuery.includes('introduce yourself') ||
        lowerQuery.includes('self intro') ||
        lowerQuery.includes('your intro') ||
        // Exact matches or courteous variants
        lowerQuery.trim() === 'intro' ||
        lowerQuery.trim() === 'introduction' ||
        lowerQuery.trim() === 'intro please' ||
        lowerQuery.trim() === 'introduction please') {
        return "ഞാൻ PACE വികസിപ്പിച്ച കാട്ടാക്കടയിൽ നിന്നുള്ള വിവരങ്ങളും രേഖകളും ശേഖരിച്ചു നൽകുന്നതിനായി സമർപ്പിതമായ ഒരു എ.ഐ. സഹായിയാണ്. നിങ്ങൾക്ക് ആവശ്യമായ വിവരങ്ങൾ ഏതൊക്കെയാണെന്ന് ദയവായി അറിയിക്കുക";
    }

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

        // Accept mixed English-Malayalam queries but respond only in Malayalam
        const malayalamRegex = /[\u0D00-\u0D7F]/;
        const hasEnglishOnly = /^[A-Za-z0-9\s.,!?'"()-]+$/.test(question.trim());

        // Allow English queries but warn that response will be in Malayalam
        if (hasEnglishOnly) {
            console.log(`⚠️  English query detected, will respond in Malayalam: "${question}"`);
        } else if (!malayalamRegex.test(question)) {
            return new Response(JSON.stringify({
                error: "ദയവായി മലയാളത്തിൽ അല്ലെങ്കിൽ ഇംഗ്ലീഷിൽ ചോദിക്കുക (Please ask in Malayalam or English)"
            }), {
                status: 400,
                headers: { "Content-Type": "application/json" }
            });
        }

        console.log(`🔍 Malayalam query: "${question.slice(0, 100)}..."`);

        const chatHistory = messages.slice(0, -1).map(m =>
            `${m.role === "user" ? "Human" : "Assistant"}: ${m.content}`
        ).join("\n");

        // Check for direct special responses (identity, political) to avoid LLM hallucination
        const specialResponse = checkSpecialQueries(question);
        if (specialResponse) {
            console.log(`🎯 Direct special response provided for: ${question}`);

            const stream = new ReadableStream({
                start(controller) {
                    const encoder = new TextEncoder();

                    // Send the direct response
                    const contentEvent: StreamEvent = {
                        type: 'content',
                        content: specialResponse
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

                    // Create Malayalam-focused system prompt without source information
                    const systemPrompt = `നിങ്ങൾ ഒരു മലയാളം സഹായിയാണ്. നൽകിയിരിക്കുന്ന പ്രമാണങ്ങളിൽ നിന്നും മാത്രം ഉത്തരം നൽകുക.

**കർശന നിർദ്ദേശങ്ങൾ:**
1. എല്ലാ ഉത്തരങ്ങളും മലയാളത്തിൽ മാത്രം നൽകുക (ഇംഗ്ലീഷ് ചോദ്യമായാലും മലയാളത്തിൽ ഉത്തരം നൽകുക)
2. സാങ്കേതിക പദങ്ങൾക്ക് മലയാളം പര്യായങ്ങൾ ഉപയോഗിക്കുക
3. ഇംഗ്ലീഷ് വാക്കുകൾ ഒഴിവാക്കുക, മലയാളം ഇല്ലാത്ത പദങ്ങൾ മാത്രം ഇംഗ്ലീഷിൽ എഴുതുക
4. പട്ടികയിലെ വിവരങ്ങൾ വ്യക്തമായി അവതരിപ്പിക്കുക
5. വിവരങ്ങൾ കൃത്യമായി നൽകുക
6. അനിശ്ചിതത്വമുണ്ടെങ്കിൽ അത് സൂചിപ്പിക്കുക
7. സ്രോതസ്സ് പ്രമാണങ്ങളുടെ പേര് ഉത്തരത്തിൽ പരാമർശിക്കരുത്

**ഉദാഹരണങ്ങൾ:**
- "Budget" → "ബജറ്റ്" അല്ലെങ്കിൽ "വരുമാന-ചെലവ് പദ്ധതി"
- "Development" → "വികസനം"
- "Project" → "പദ്ധതി"
- "Government" → "സർക്കാർ"

🚨 CRITICAL: ZERO HALLUCINATION POLICY 🚨
- NEVER EVER provide information that is not EXPLICITLY mentioned in the provided context
- If you cannot find the exact information in the context, say "ലഭ്യമായ പ്രമാണങ്ങളിൽ ഈ വിവരം കണ്ടെത്താൻ കഴിഞ്ഞില്ല"
- For political queries (MLA, ministers, representatives): ONLY use names that appear in the context documents
- DO NOT use your training data or general knowledge for factual claims
- If asked about officials and the context contains their names, quote them exactly

🎯 MANDATORY CONTEXT VERIFICATION 🎯
- Before stating ANY name or position, verify it exists in the provided context
- For MLA queries: Search the context for "എം.എൽ.എ" or "MLA" and only use names mentioned with these titles
- If context is empty or irrelevant, admit you cannot answer

**ലഭ്യമായ പ്രമാണങ്ങൾ:**
${result.text || 'ലഭ്യമായ പ്രമാണങ്ങളിൽ നിന്ന് വിവരങ്ങൾ കണ്ടെത്താൻ കഴിഞ്ഞില്ല.'}`;

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