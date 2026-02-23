import { NextRequest } from "next/server";
// import { callChain } from "@/lib/langchain"; // LOCAL RAG — disabled; using Vertex AI RAG only
import { streamingModel } from "@/lib/llm";

import { SystemMessage, HumanMessage, BaseMessage } from "@langchain/core/messages";
import { showErrorInChat } from "@/lib/error-messages";
import { logger } from "@/lib/logger";
import { streamVertexGeminiWithGrounding } from "@/lib/google-genai";
import { checkSpecialQueries } from "@/lib/special-queries";

/**
 * MANDATORY Malayalam enforcement layer — runs on EVERY response.
 * Converts ALL non-Malayalam text (English, Hindi/Devanagari, Tamil, etc.)
 * to pure Malayalam script. No exceptions, no threshold checks.
 */
/**
 * Classifies a query as needing a short (<=150 words) or long (<=300 words) answer.
 */
function classifyQueryLength(question: string): { limit: number; label: string } {
    const q = question.toLowerCase();
    const longSignals = [
        'summarize', 'summarise', 'summary', 'overview', 'explain', 'describe',
        'tell me about', 'list all', 'all projects', 'all works', 'everything',
        'in detail', 'detailed', 'comprehensive', 'elaborate',
        'what are the', 'what has he done', 'what has been done',
        'key projects', 'major projects', 'main projects',
        'achievements', 'development works', 'initiatives',
        'സംഗ്രഹം', 'വിശദം', 'വിശദമായി', 'എല്ലാ', 'മുഴുവൻ',
        'പ്രധാന പ്രവർത്തനങ്ങൾ', 'വികസന പ്രവർത്തനങ്ങൾ',
        'എന്തൊക്കെ ചെയ്തു', 'എന്തെല്ലാം', 'നേട്ടങ്ങൾ',
    ];
    const isLong = longSignals.some(kw => q.includes(kw));
    return isLong
        ? { limit: 300, label: 'long' }
        : { limit: 150, label: 'short' };
}

/**
 * Single-pass replacement for combineAndUniformise + enforceMalayalam + streamMarkdownFormatted.
 *
 * One streaming LLM call that simultaneously:
 *   1. Merges GenAI + RAG (prefers GenAI)
 *   2. Enforces pure Malayalam output (no English / Devanagari)
 *   3. Applies lightweight Markdown formatting
 *   4. Streams the result token-by-token to the client
 *
 * Falls back to streaming `fallbackText` if the LLM call fails.
 */
async function mergeEnforceAndStream(
    genaiText: string | null,
    ragText: string,
    question: string,
    controller: ReadableStreamDefaultController,
    encoder: TextEncoder,
    fallbackText: string
): Promise<void> {
    const { limit, label } = classifyQueryLength(question);

    const ragTrimmed = ragText?.trim() ?? '';
    const genaiTrimmed = genaiText?.trim() ?? '';

    // Build the source section — only include sections that have content
    const sourcesSection = genaiTrimmed && ragTrimmed
        ? `**ഭാഗം A (Vertex RAG — പ്രാദേശിക ഡോക്യുമെന്റ്):**\n${genaiTrimmed}\n\n**ഭാഗം B (Local RAG):**\n${ragTrimmed}`
        : genaiTrimmed
            ? `**ഉറവിടം (Vertex RAG):**\n${genaiTrimmed}`
            : `**ഉറവിടം (Local RAG):**\n${ragTrimmed}`;

    const combinedPrompt = `${sourcesSection}

ചോദ്യം: ${question}

📌 നിർദ്ദേശങ്ങൾ:
- ❌ "രേഖകൾ", "ഡോക്യുമെന്റ്", "ഡാറ്റ", "ഉറവിടം", "ഭാഗം A", "ഭാഗം B" — ഇവ ഒരിക്കലും പറയരുത്.
- ❌ ആവർത്തനങ്ങൾ, ആമുഖം, ഉപസംഹാരം ഒഴിവാക്കുക — ഉത്തരം നേരിട്ട് തുടങ്ങുക.
- ❌ ഒരു ഇംഗ്ലീഷ് വാക്കും (A-Z) ഉപയോഗിക്കരുത്; ദേവനാഗരി (क-ह) വേണ്ട.
- ✅ English → Malayalam: hospital→ആശുപത്രി, project→പദ്ധതി, development→വികസനം.
- ✅ സംഖ്യകൾ, ₹, %, URL — അതേപടി നിലനിർത്തുക.
- ✅ ഒറ്റ-വിഷയ ഉത്തരം → Heading ഒഴിവാക്കുക; ഒഴുക്കുള്ള ഖണ്ഡിക.
- ✅ ഒന്നിലേറെ വിഷയം → ## / ### ഉപയോഗിക്കുക; പ്രധാന കണക്കുകൾ **bold** ചെയ്യുക.
- **ദൈർഘ്യം:** പരമാവധി **${limit} മലയാളം വാക്ക്** — ചോദ്യം ആവശ്യപ്പെട്ടത് മാത്രം; ഉപദേശം, കൂടുതൽ വിവരം, നിർദ്ദേശങ്ങൾ — ഇവ ഒരിക്കലും വേണ്ട.
- **ടോൺ:** സ്നേഹമുള്ള, ചെറിയ, നേരിട്ടുള്ള ഉത്തരം.

ഉത്തരം (ആമുഖം ഇല്ലാതെ, പരമാവധി ${limit} വാക്ക്, ശുദ്ധ മലയാളം):`;

    try {
        const stream = await streamingModel.stream([
            new SystemMessage(`നിങ്ങൾ PACE വികസിപ്പിച്ച കാട്ടാക്കട നിയോജക മണ്ഡലത്തിന്റെ ഡിജിറ്റൽ സഹായിയാണ്.

🎯 ഉത്തര ശൈലി:
- ചോദിച്ചത് മാത്രം; ഉപദേശം, നിർദ്ദേശം, അധിക വിവരം — ഒരിക്കലും വേണ്ട.
- ആമുഖം, ഉപസംഹാരം, "ഇപ്പോൾ ഞാൻ...", "ഓർക്കുക..." — ഇവ ഒഴിവാക്കുക.
- ഊഷ്മളം, ചെറുത്, നേരിട്ട് — ഒരു നല്ല അയൽക്കാരൻ ഉത്തരം നൽകുന്ന പോലെ.

🚫 ഭാഷ — മലയാളം മാത്രം:
- ഒരു ഇംഗ്ലീഷ് വാക്കും (A-Z) ഉപയോഗിക്കരുത്
- ദേവനാഗരി (Hindi) ഒരിക്കലും വേണ്ട
- സംഖ്യകൾ, ₹, %, URL — അതേപടി നിലനിർത്തുക

- 🚫 കൃത്യത:
- **നൽകിയിട്ടുള്ള ഉറവിടങ്ങളിൽ (Source) ഇല്ലാത്ത ഒരു വിവരവും പറയരുത്.**
- സ്വന്തം അറിവോ പൊതു അറിവോ (External Knowledge) ഉപയോഗിക്കരുത്.
- അറിയാത്ത കണക്കുകൾ ഊഹിക്കരുത്.
- ഉത്തരം ഉറവിടങ്ങളിൽ ഇല്ലെങ്കിൽ മാത്രം: "ക്ഷമിക്കണം, ഈ വിഷയത്തിൽ ഇപ്പോൾ നൽകിയിട്ടുള്ള രേഖകളിൽ ഉത്തരമില്ല. കൂടുതൽ വിവരങ്ങൾക്ക്: https://kattakadalac.com/"

**ആരാണ് നിങ്ങൾ:** "ഞാൻ PACE വികസിപ്പിച്ച, കാട്ടാക്കട മണ്ഡലത്തിന്റെ ഡിജിറ്റൽ സഹായിയാണ്!"

📋 ഉറപ്പായ കണക്കുകൾ (കൃത്യമായി ഉപയോഗിക്കുക — ഉറവിടം ലഭ്യമല്ലെങ്കിൽ ഇവ ഉപയോഗിക്കുക):
- കൈത്തറി കുടുംബങ്ങൾ: 112 (മാറനല്ലൂർ 85, കാട്ടാക്കട 22, പള്ളിച്ചൽ 3, മലയിൻകീഴ് 2)
- മഴവെള്ള സംഭരണം: 284 (മാരനല്ലൂർ 99, പള്ളിച്ചൽ 99, കട്ടക്കട 55, മലയിങ്കീഴ് 19, വിലാപ്പിൽ 12)
- കുടുംബശ്രീ യൂണിറ്റുകൾ: 2,206 (കാട്ടാക്കട 450, പള്ളിച്ചൽ 387, വിളപ്പിൽ 421, മലയിൻകീഴ് 365, മാറനല്ലൂർ 328, വിളവൂർക്കൽ 255)
- ആർട്സ് & സ്പോർട്സ് ക്ലബുകൾ: 94 (മാറനല്ലൂർ 20, കട്ടക്കട 18, മലയിങ്കീഴ് 18, വിളപ്പിൽ 15, വിളവൂർക്കൽ 12, പള്ളിച്ചൽ 11)
- വോട്ടർ (2024): 1,93,967 (പുരുഷൻ 92,624 / സ്ത്രീ 1,01,343)
- വനിതാ ജനപ്രതിനിധികൾ: 65 (പള്ളിച്ചൽ 12, മാറനല്ലൂർ 11, വിളപ്പിൽ 11, കട്ടക്കട 11, മലയിങ്കീഴ് 10, വിളവൂർക്കൽ 10)
- അങ്കണവാടികൾ: 219 (പള്ളിച്ചൽ 39, വിളപ്പിൽ 39, കാട്ടാക്കട 38, മാറനല്ലൂർ 38, മലയിങ്കീഴ് 35, വിളവൂർക്കൽ 30)
- ആശുപത്രികൾ (അലോപ്പതി): 6 (മലയിൻകീഴ് താലൂക്ക്, വിളപ്പിൽ CHC, വിളവൂർക്കൽ CHC, കാട്ടക്കട FHC, മാറനല്ലൂർ FHC, പള്ളിച്ചൽ FHC)`),
            new HumanMessage(combinedPrompt),
        ] as BaseMessage[]);

        let hasContent = false;

        for await (const chunk of stream) {
            const rawContent = (chunk as { content?: string | Array<{ text?: string; content?: string }> })?.content;
            const text = Array.isArray(rawContent)
                ? rawContent.map((p: { text?: string; content?: string }) =>
                    typeof p === 'string' ? p : (p?.text ?? (typeof p?.content === 'string' ? p.content : ''))
                ).join('')
                : (typeof rawContent === 'string' ? rawContent : '');

            if (text.length > 0) {
                hasContent = true;
                // Strip any stray Devanagari that slipped through
                // Strip stray Devanagari; collapse only horizontal whitespace (spaces/tabs),
                // NOT newlines — preserving \n\n (paragraphs) and \n- (bullets) for Markdown.
                const clean = text.replace(/[\u0900-\u097F]+/g, '').replace(/[ \t]{2,}/g, ' ');
                const event: StreamEvent = { type: 'content', content: clean };
                controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
            }
        }

        if (!hasContent) {
            logger.warn('mergeEnforceAndStream: LLM produced no content, streaming fallback', 'api/chat/stream');
            const event: StreamEvent = { type: 'content', content: fallbackText };
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        }
    } catch (err) {
        logger.warn(`mergeEnforceAndStream failed, streaming fallback: ${err instanceof Error ? err.message : String(err)}`, 'api/chat/stream');
        const event: StreamEvent = { type: 'content', content: fallbackText };
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
    }
}



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
 * Check if query matches FAQ data, identity questions, or known political facts.
 * Matching queries bypass the full RAG pipeline (no expander, no retrieval, no LLM).
 */
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
            logger.info(`English query detected, will respond in Malayalam`, 'api/chat/stream', { query: question.substring(0, 60) });
        } else if (!malayalamRegex.test(question)) {
            return new Response(JSON.stringify({
                error: "ദയവായി മലയാളത്തിൽ അല്ലെങ്കിൽ ഇംഗ്ലീഷിൽ ചോദിക്കുക (Please ask in Malayalam or English)"
            }), {
                status: 400,
                headers: { "Content-Type": "application/json" }
            });
        }

        logger.info(`Query received`, 'api/chat/stream', { queryPreview: question.slice(0, 60) });

        const chatHistory = messages.slice(0, -1).map(m =>
            `${m.role === "user" ? "Human" : "Assistant"}: ${m.content} `
        ).join("\n");

        // Structured history for Vertex AI multi-turn context (last 3 turns max to keep tokens reasonable)
        const structuredHistory = messages.slice(0, -1).slice(-3).map(m => ({
            role: m.role as 'user' | 'assistant',
            content: m.content,
        }));

        // Check for direct special responses (identity, political) to avoid LLM hallucination
        const specialResponse = checkSpecialQueries(question);
        if (specialResponse) {
            logger.info('Direct special response matched', 'api/chat/stream', { queryPreview: question.slice(0, 60) });

            const stream = new ReadableStream({
                start(controller) {
                    const encoder = new TextEncoder();

                    // Send the direct response
                    const contentEvent: StreamEvent = {
                        type: 'content',
                        content: specialResponse
                    };
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify(contentEvent)} \n\n`));

                    // Send done event
                    const doneEvent: StreamEvent = {
                        type: 'done',
                        data: { sources: [], documentsUsed: 0 }
                    };
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify(doneEvent)} \n\n`));
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
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify(searchStartEvent)} \n\n`));

                    // LOCAL RAG disabled — Vertex AI RAG is the only retrieval source.
                    // const contextPromise = callChain({ question, chatHistory }); // <-- Pinecone / local RAG

                    // Vertex AI RAG (primary retrieval source)
                    const genaiPromise = streamVertexGeminiWithGrounding(question, undefined, structuredHistory);

                    // Stub result so the rest of the pipeline (loading events, sources, etc.) is unchanged
                    const result = {
                        text: '',
                        sources: [] as Array<{ source: string; relevance: number; usedFor: string; contentType: 'text' | 'table' | 'chart' | 'image'; pageReference?: string }>,
                        analysis: { documentsUsed: 0 },
                    };

                    // Send initial Malayalam message
                    const initialMessage = `ഞാൻ "${question.slice(0, 50)}${question.length > 50 ? '...' : ''}" പറ്റിയ വിവരങ്ങൾ നോക്കിക്കൊണ്ടിരിക്കുക...`;

                    const initialEvent: StreamEvent = {
                        type: 'content',
                        content: initialMessage
                    };
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify(initialEvent)} \n\n`));

                    // Send loading start event
                    const loadingStartEvent: StreamEvent = {
                        type: 'loading_start',
                        data: { message: 'രേഖകൾ തിരയുന്നു...' }
                    };
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify(loadingStartEvent)} \n\n`));

                    // NOTE: Loading message stays visible until loading_complete fires below.
                    // Intermediate LLM call removed — Vertex AI RAG is the sole source.
                    // All system enforcements (identity, FAQ facts, language, restrictions)
                    // are embedded in the mergeEnforceAndStream system message.

                    // ═══════════════════════════════════════════════════════════
                    // Await Vertex AI RAG, then enforce Malayalam + format + stream
                    // in one LLM call via mergeEnforceAndStream.
                    // ═══════════════════════════════════════════════════════════
                    const genaiText = await genaiPromise;

                    logger.info(
                        `mergeEnforceAndStream: VertexAI=${Boolean(genaiText)} (${(genaiText ?? '').length} chars)`,
                        'api/chat/stream'
                    );

                    // LOG THE FIRST RESULT (GenAI/Grounding) for visualization
                    if (genaiText) {
                        logger.info('RAW GENAI RESULT', 'api/chat/stream', {
                            query: question.slice(0, 100),
                            rawResult: genaiText
                        });
                    }

                    // Clear the loading indicator right before streaming the answer
                    const loadingCompleteEvent: StreamEvent = {
                        type: 'loading_complete',
                        data: {
                            documentsUsed: result.analysis?.documentsUsed || 0,
                            sources: result.sources || []
                        }
                    };
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify(loadingCompleteEvent)} \n\n`));

                    const clearMessageEvent: StreamEvent = {
                        type: 'clear_message',
                        data: { clearPrevious: true }
                    };
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify(clearMessageEvent)} \n\n`));

                    await mergeEnforceAndStream(
                        genaiText,
                        '', // local RAG disabled — Vertex AI is the only source
                        question,
                        controller,
                        encoder,
                        genaiText || 'ക്ഷമിക്കണം, ഈ വിഷയത്തിൽ ഇപ്പോൾ ഉത്തരമില്ല.'
                    );


                    // Send done event with sources
                    const doneEvent: StreamEvent = {
                        type: 'done',
                        data: {
                            sources: result.sources || [],
                            documentsUsed: result.analysis?.documentsUsed || 0
                        }
                    };
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify(doneEvent)} \n\n`));
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
                    logger.error(`Stream processing error: ${errorDetails.technicalMessage} `, 'api/chat/stream');
                    const errorEvent: StreamEvent = {
                        type: 'error',
                        error: errorDetails.userMessage // Send Malayalam message to frontend
                    };
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify(errorEvent)} \n\n`));
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
        logger.error(`Chat stream API error: ${errorDetails.technicalMessage} `, 'api/chat/stream');
        return new Response(
            JSON.stringify({
                error: errorDetails.userMessage,
            }),
            {
                status: 500,
                headers: { "Content-Type": "application/json" }
            }
        );
    }
}