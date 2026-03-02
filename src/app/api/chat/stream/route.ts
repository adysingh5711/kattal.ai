import { NextRequest } from "next/server";
import { callChain } from "@/lib/langchain";
import { streamingModel } from "@/lib/llm";

import { SystemMessage, HumanMessage, AIMessage, BaseMessage } from "@langchain/core/messages";
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
        ? `**ഭാഗം A (ഇതിന് മുൻഗണന — Google Search):**\n${genaiTrimmed}\n\n**ഭാഗം B (RAG — പ്രാദേശിക ഡോക്യുമെന്റ്):**\n${ragTrimmed}`
        : genaiTrimmed
            ? `**ഉറവിടം:**\n${genaiTrimmed}`
            : `**ഉറവിടം:**\n${ragTrimmed}`;

    const combinedPrompt = `നിങ്ങൾ കാട്ടാക്കട മണ്ഡലത്തിനെക്കുറിച്ച് നന്നായി അറിയുന്ന, ആളുകൾക്ക് സ്വാഭാവികമായി ഉത്തരം നൽകുന്ന ഒരു സഹായിയാണ്.

${sourcesSection}

🎯 ഒറ്റ ഘട്ടത്തിൽ ഇത് ചെയ്യുക:

**1. സംയോജനം:**
- ഭാഗം A-ന് മുൻഗണന; ഭാഗം B-ൽ മാത്രമുള്ള ഉപകാരപ്രദമായ വസ്തുതകൾ ചേർക്കുക.
- ❌ "രേഖകൾ", "ഡോക്യുമെന്റ്", "ഡാറ്റ", "ഉറവിടം" — ഇവ ഒരിക്കലും പറയരുത്.
- ❌ ആവർത്തനങ്ങൾ ഒഴിവാക്കുക.

**2. ഭാഷ — 100% മലയാളം:**
- ❌ ഒരു ഇംഗ്ലീഷ് വാക്കും (A-Z) ഉപയോഗിക്കരുത്
- ❌ ദേവനാഗരി (क-ഹ) ഒരിക്കലും വേണ്ട
- ✅ English → Malayalam: hospital→ആശുപത്രി, project→പദ്ധതി, development→വികസനം, government→സർക്കാർ
- ✅ സംഖ്യകൾ, ₹, %, URL — അതേപടി നിലനിർത്തുക

**3. ഫോർമാറ്റ് — ലളിതമായ Markdown:**
- നോർമൽ ടെക്സ്റ്റ് ഖണ്ഡികകൾ
- ഒന്നിലേറെ വിഷയം → ## / ### ഉപയോഗിക്കുക
- പ്രധാന കണക്കുകൾ, തുകകൾ → **ഇങ്ങനെ** bold ചെയ്യുക
- ലിസ്റ്റ് ചെയ്യേണ്ടവ → - bullet

**4. ദൈർഘ്യം & വിവരം:**
- പരമാവധി ${limit} വാക്കുകൾ (ഇതൊരു ഉയർന്ന പരിധിയാണ്, ഇതൊരു കുറഞ്ഞ പരിധിയല്ല. ഉത്തരങ്ങൾ വളരെ ചെറുതാകാം).
- ചോദിച്ചതിന് മാത്രം വളരെ ഹ്രസ്വമായി മറുപടി നൽകുക. അനാവശ്യ വിവരങ്ങൾ ഒഴിവാക്കുക.
- യാതൊരു ഉപദേശങ്ങളും നൽകരുത്. വളരെ ചുരുക്കത്തിൽ കൃത്യമായ സംഗ്രഹം നൽകുക. ചോദിച്ച അത്രയും വിവരങ്ങൾ മാത്രം നൽകുക.

**5. ടോൺ:**
- വളരെ ഊഷ്മളവും സ്നേഹപൂർണ്ണവുമായ സൗഹൃദ ശൈലി. ഒരു സ്നേഹിതകൻ/സ്നേഹിത സംസാരിക്കുന്ന പോലെ.
- ❌ ഔദ്യോഗിക ഭാഷ വേണ്ട

ഉത്തരം (പരമാവധി ${limit} വാക്കിൽ, ചോദിച്ചതിന് മാത്രം മറുപടി, സ്നേഹം നിറഞ്ഞ ശൈലിയിൽ, ശുദ്ധ മലയാളം Markdown):`;

    try {
        const stream = await streamingModel.stream([
            new SystemMessage('You are a Malayalam assistant. Output ONLY pure Malayalam text with clean Markdown. Zero English words. Zero Devanagari. Numbers, ₹, %, URLs stay as-is.'),
            new HumanMessage(combinedPrompt),
        ] as BaseMessage[]);

        let hasContent = false;
        let finalOutput = '';

        for await (const chunk of stream) {
            const rawContent = (chunk as { content?: string | Array<{ text?: string; content?: string }> })?.content;
            const text = Array.isArray(rawContent)
                ? rawContent.map((p: { text?: string; content?: string }) =>
                    typeof p === 'string' ? p : (p?.text ?? (typeof p?.content === 'string' ? p.content : ''))
                ).join('')
                : (typeof rawContent === 'string' ? rawContent : '');

            if (text.length > 0) {
                hasContent = true;
                finalOutput += text;
                // Strip any stray Devanagari that slipped through
                const clean = text.replace(/[\u0900-\u097F]+/g, '').replace(/\s{2,}/g, ' ');
                const event: StreamEvent = { type: 'content', content: clean };
                controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
            }
        }

        logger.info(`--- result 3: Final merged LLM output --- \n${finalOutput}`, 'api/chat/stream');

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

                    // Start document retrieval and GenAI (Google Search) in parallel
                    const contextPromise = callChain({
                        question,
                        chatHistory,
                    });
                    const genaiPromise = streamVertexGeminiWithGrounding(question);

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

                    // Wait for context to be ready
                    const result = await contextPromise;

                    // NOTE: Do NOT send loading_complete or clear_message here.
                    // The loading message stays visible through both LLM passes.

                    // Create Malayalam-focused system prompt — entirely in Malayalam to prevent English leakage
                    const systemPrompt = `നിങ്ങൾ PACE വികസിപ്പിച്ച കാട്ടാക്കട നിയോജക മണ്ഡലത്തിന്റെ ഡിജിറ്റൽ സഹായിയാണ്. ഒരു അറിയുന്ന, സഹായസന്നദ്ധനായ ആൾ സ്വാഭാവികമായി ഉത്തരം നൽകുന്ന പോലെ സംസാരിക്കുക.

🚫 ഭാഷ — മലയാളം മാത്രം:
- എല്ലാ ഉത്തരങ്ങളും മലയാളം ലിപിയിൽ
- ഇംഗ്ലീഷ് ചോദ്യത്തിനും മലയാളത്തിൽ ഉത്തരം
- ഇംഗ്ലീഷ്, ഹിന്ദി, ദേവനാഗരി — ഇവ ഒരിക്കലും ഉപേക്ഷിക്കരുത്

**ടോൺ — സ്വാഭാവികവും ഒഴുക്കുള്ളതും:**
- ❌ "രേഖകൾ പ്രകാരം", "ഡോക്യുമെന്റ് അനുസരിച്ച്" — ഇവ ഉപേക്ഷിക്കുക
- ✅ "ഇവിടെ 219 അങ്കണവാടികൾ ഉണ്ട്", "ആ പദ്ധതി ₹17 കോടിയുടേതാണ്" — ഇങ്ങനെ നേരിട്ട് പറയുക
- ✅ ഒരു ഗ്രാമവാസി സ്നേഹബന്ധത്തോടെ വിശദീകരിക്കുന്ന ശൈലി

**കൃത്യത:**
1. ❌ അറിയാത്ത കണക്കുകൾ ഊഹിക്കരുത്
2. ❌ കേരളം / ഇന്ത്യ / പൊതു അറിവ് ഉൾപ്പെടുത്തരുത്
3. ✅ ഉത്തരം ഇല്ലെങ്കിൽ: "ക്ഷമിക്കണം, ഇതിനെക്കുറിച്ച് ഇപ്പോൾ കൃത്യമായ വിവരം എന്നിൽ ഇല്ല."

**ആരാണ് നിങ്ങൾ:**
"ഞാൻ PACE വികസിപ്പിച്ച, കാട്ടാക്കട മണ്ഡലത്തിന്റെ ഡിജിറ്റൽ സഹായിയാണ്!"

**വിവരം ഇല്ലെങ്കിൽ:**
"ക്ഷമിക്കണം, ഈ വിഷയത്തിൽ ഇപ്പോൾ ഉത്തരമില്ല. കൂടുതൽ വിവരങ്ങൾക്ക്: https://kattakadalac.com/"

📋 ഉറപ്പായ കണക്കുകൾ (കൃത്യമായി ഉപയോഗിക്കുക):
- കൈത്തറി കുടുംബങ്ങൾ: 112 (മാറനല്ലൂർ 85, കാട്ടാക്കട 22, പള്ളിച്ചൽ 3, മലയിൻകീഴ് 2)
- മഴവെള്ള സംഭരണം: 284 (മാരനല്ലൂർ 99, പള്ളിച്ചൽ 99, കട്ടക്കട 55, മലയിങ്കീഴ് 19, വിലാപ്പിൽ 12)
- കുടുംബശ്രീ യൂണിറ്റുകൾ: 2,206 (കാട്ടാക്കട 450, പള്ളിച്ചൽ 387, വിളപ്പിൽ 421, മലയിൻകീഴ് 365, മാറനല്ലൂർ 328, വിളവൂർക്കൽ 255)
- ആർട്സ് & സ്പോർട്സ് ക്ലബുകൾ: 94 (മാറനല്ലൂർ 20, കട്ടക്കട 18, മലയിങ്കീഴ് 18, വിളപ്പിൽ 15, വിളവൂർക്കൽ 12, പള്ളിച്ചൽ 11)
- വോട്ടർ (2024): 1,93,967 (പുരുഷൻ 92,624 / സ്ത്രീ 1,01,343)
- വനിതാ ജനപ്രതിനിധികൾ: 65 (പള്ളിച്ചൽ 12, മാറനല്ലൂർ 11, വിളപ്പിൽ 11, കട്ടക്കട 11, മലയിങ്കീഴ് 10, വിളവൂർക്കൽ 10)
- അങ്കണവാടികൾ: 219 (പള്ളിച്ചൽ 39, വിളപ്പിൽ 39, കാട്ടാക്കട 38, മാറനല്ലൂർ 38, മലയിങ്കീഴ് 35, വിളവൂർക്കൽ 30)

📝 ടോൺ ഉദാഹരണം:
ചോദ്യം: "What are the hospitals in Kattakada?"
ഉത്തരം: "കാട്ടാക്കട മണ്ഡലത്തിൽ 6 ആശുപത്രികൾ ഉണ്ട് — മലയിൻകീഴ് താലൂക്ക് ആശുപത്രി, വിളപ്പിലും വിളവൂർക്കലും കമ്മ്യൂണിറ്റി ഹെൽത്ത് സെന്ററുകൾ എന്നിവ ഉൾപ്പെടെ."

ഇനിപ്പറയുന്ന വിവരങ്ങൾ ഉപയോഗിച്ച് ഉത്തരം നൽകുക:
${result.text || 'ക്ഷമിക്കണം, ഈ വിഷയത്തിൽ എനിക്ക് വിവരമില്ല. കൂടുതൽ വിവരങ്ങൾക്ക്: https://kattakadalac.com/'}

🚫 ഓർക്കുക: ഉത്തരം മലയാളത്തിൽ മാത്രം. 🚫`;

                    // Generate streaming response with existing model
                    const conversationMessages = [
                        new SystemMessage(systemPrompt),
                        ...messages.slice(-5).map((m) =>
                            m.role === "user" ? new HumanMessage(m.content) : new AIMessage(m.content)
                        ),
                    ];

                    const modelStream = await streamingModel.stream(conversationMessages as BaseMessage[]);

                    // Collect the first LLM response silently — do NOT stream to client
                    let fullResponse = '';

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
                            fullResponse += contentText;
                        }
                    }

                    // ═══════════════════════════════════════════════════════════
                    // Single-pass: merge GenAI + RAG, enforce Malayalam, format
                    // markdown, and stream — all in one LLM call.
                    // ═══════════════════════════════════════════════════════════
                    const genaiText = await genaiPromise;

                    logger.info(`--- result 1: Gemini Vertex AI --- \n${genaiText}`, 'api/chat/stream');
                    logger.info(`--- result 2: Pinecone based RAG --- \n${fullResponse}`, 'api/chat/stream');

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
                        fullResponse,
                        question,
                        controller,
                        encoder,
                        fullResponse || genaiText || 'ക്ഷമിക്കണം, ഈ വിഷയത്തിൽ ഇപ്പോൾ ഉത്തരമില്ല.'
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