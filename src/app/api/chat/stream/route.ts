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
 * Check if query matches FAQ data, identity questions, or known political facts.
 * Matching queries bypass the full RAG pipeline (no expander, no retrieval, no LLM).
 */
function checkSpecialQueries(query: string): string | null {
    const lowerQuery = query.toLowerCase();

    // === IDENTITY QUESTIONS ===
    if (lowerQuery.includes('who are you') || lowerQuery.includes('നീ ആരാണ്') ||
        lowerQuery.includes('ആരാണ് നീ') || lowerQuery.includes('നിങ്ങൾ ആരാണ്') ||
        lowerQuery.includes('what are you') || lowerQuery.includes('introduce yourself') ||
        lowerQuery.includes('നിങ്ങളെ പരിചയപ്പെടുത്തൂ')) {
        return "ഞാൻ PACE വികസിപ്പിച്ച കാട്ടാക്കടയിൽ നിന്നുള്ള വിവരങ്ങളും രേഖകളും ശേഖരിച്ചു നൽകുന്നതിനായി സമർപ്പിതമായ ഒരു എ.ഐ. സഹായിയാണ്. കാട്ടാക്കട നിയോജക മണ്ഡലത്തെക്കുറിച്ചുള്ള ചോദ്യങ്ങൾക്ക് ഞാൻ ഉത്തരം നൽകാൻ ശ്രമിക്കുന്നു.";
    }

    // === IB SATEESH OPINION QUERIES ===
    const mlaNameKeywords = ['ib sateesh', 'i.b. sateesh', 'i.b sateesh', 'ib satish', 'i b sateesh',
        'ഐ.ബി. സതീഷ്', 'ഐബി സതീഷ്', 'സതീഷ്', 'sateesh', 'satish'];
    const mlaRoleKeywords = ['kattakada mla', 'കാട്ടക്കട എം.എൽ.എ', 'കാട്ടക്കട mla', 'mla of kattakada',
        'കാട്ടാക്കട mla', 'കാട്ടാക്കട എം.എൽ.എ'];
    const opinionKeywords = ['how is', 'how good', 'is he good', 'opinion', 'happy with',
        'satisfied with', 'performance', 'doing', 'work', 'എങ്ങനെ', 'നല്ലതാണോ',
        'good leader', 'bad leader', 'effective', 'popular', 'like', 'dislike',
        'അഭിപ്രായം', 'നേതാവ്', 'പ്രവൃത്തി', 'ജനപ്രിയം'];
    const hasMlaRef = mlaNameKeywords.some(kw => lowerQuery.includes(kw)) ||
        mlaRoleKeywords.some(kw => lowerQuery.includes(kw));
    const hasOpinion = opinionKeywords.some(kw => lowerQuery.includes(kw));
    if (hasMlaRef && hasOpinion) {
        return `ഐ.ബി. സതീഷ് കാട്ടക്കട നിയോജക മണ്ഡലത്തിന്റെ നിലവിലെ എം.എൽ.എ ആണ്. മണ്ഡലത്തിന്റെ വികസന പ്രവർത്തനങ്ങളിൽ അദ്ദേഹം സജീവമായി പങ്കെടുക്കുന്നു.\nഅദ്ദേഹത്തെക്കുറിച്ച് ജനങ്ങളുടെ അഭിപ്രായങ്ങൾ വ്യത്യസ്തമാണ്. പൊതുവെ അദ്ദേഹത്തെ നല്ല നേതാവായി കാണുന്നു.`;
    }

    // === KATTAKKADA MLA (WHO IS) QUERIES ===
    if ((lowerQuery.includes('kattakkada') || lowerQuery.includes('kattakada') || lowerQuery.includes('കാട്ടക്കട') || lowerQuery.includes('കാട്ടാക്കട')) &&
        (lowerQuery.includes('mla') || lowerQuery.includes('എം.എൽ.എ') || lowerQuery.includes('എം.എല്.എ') ||
            lowerQuery.includes('aaranu') || lowerQuery.includes('ആര്') || lowerQuery.includes('ആരാണ്') ||
            lowerQuery.includes('representative') || lowerQuery.includes('member') || lowerQuery.includes('who is'))) {
        return "കാട്ടക്കട മണ്ഡലത്തിലെ എം.എൽ.എ. ഐ.ബി.സതീഷ് ആണ്.";
    }

    // === FAQ: HANDLOOM FAMILIES (കൈത്തറി കുടുംബങ്ങൾ) ===
    if ((lowerQuery.includes('കൈത്തറി') || lowerQuery.includes('handloom')) &&
        (lowerQuery.includes('കുടുംബ') || lowerQuery.includes('family') || lowerQuery.includes('families') ||
            lowerQuery.includes('എത്ര') || lowerQuery.includes('how many'))) {
        return `കാട്ടാക്കട നിയോജക മണ്ഡലത്തിലെ രേഖകൾ പ്രകാരം, 112 കുടുംബങ്ങളാണ് കൈത്തറി (Handloom) വ്യവസായവുമായി ബന്ധപ്പെട്ട് പ്രവർത്തിക്കുന്നത്.

വിവിധ പഞ്ചായത്തുകളിലെ കണക്കുകൾ:
- മാറനല്ലൂർ: 85
- കാട്ടാക്കട: 22
- പള്ളിച്ചൽ: 3
- മലയിൻകീഴ്: 2
- വിളപ്പിൻ, വിളവൂർക്കൽ: 0

ആകെ 112 കുടുംബങ്ങളാണ് ഈ മേഖലയിൽ പ്രവർത്തിക്കുന്നത്.`;
    }

    // === FAQ: RAINWATER HARVESTING (മഴവെള്ള സംഭരണം) ===
    if ((lowerQuery.includes('മഴവെള്ള') || lowerQuery.includes('rainwater') || lowerQuery.includes('rain water')) &&
        (lowerQuery.includes('സംഭരണ') || lowerQuery.includes('harvesting') || lowerQuery.includes('എത്ര') ||
            lowerQuery.includes('how many'))) {
        return `കട്ടക്കട അസംബ്ലി മണ്ഡലത്തിൽ ആകെ 284 മഴവെള്ള സംഭരണ സംവിധാനങ്ങൾ നിലവിലുണ്ട്.

ഗ്രാമപഞ്ചായത്ത് അടിസ്ഥാനത്തിലുള്ള വിവരങ്ങൾ:
- മാരനല്ലൂർ: 99
- പള്ളിച്ചൽ: 99
- കട്ടക്കട: 55
- മലയിങ്കീഴ്: 19
- വിലാപ്പിൽ: 12
- വിലവൂർക്കൽ: 0

ആകെ 284 മഴവെള്ള സംഭരണ സംവിധാനങ്ങൾ രേഖപ്പെടുത്തിയിരിക്കുന്നു.`;
    }

    // === FAQ: KUDUMBASHREE UNITS (കുടുംബശ്രീ യൂണിറ്റുകൾ) ===
    if ((lowerQuery.includes('കുടുംബശ്രീ') || lowerQuery.includes('kudumbashree') || lowerQuery.includes('kudumbasree')) &&
        (lowerQuery.includes('യൂണിറ്റ') || lowerQuery.includes('unit') || lowerQuery.includes('എത്ര') ||
            lowerQuery.includes('how many') || lowerQuery.includes('nhg') || lowerQuery.includes('എൻ.എച്ച്'))) {
        return `കാട്ടാക്കട നിയോജക മണ്ഡലത്തിൽ ആകെ 2,206 കുടുംബശ്രീ യൂണിറ്റുകൾ (എൻ.എച്ച്‌.ജി./അയൽക്കൂട്ടങ്ങൾ) പ്രവർത്തിച്ചുവരുന്നു.

പഞ്ചായത്ത് അടിസ്ഥാനത്തിൽ:
- കാട്ടാക്കട: 450
- മലയിൻകീഴ്: 365
- മാറനല്ലൂർ: 328
- പള്ളിച്ചൽ: 387
- വിളപ്പിൽ: 421
- വിളവൂർക്കൽ: 255

ആകെ: 2,206`;
    }

    // === FAQ: ARTS & SPORTS CLUBS (ആർട്സ് ആൻഡ് സ്പോർട്സ് ക്ലബ്ബുകൾ) ===
    if ((lowerQuery.includes('ആർട്സ്') || lowerQuery.includes('സ്പോർട്സ്') || lowerQuery.includes('ക്ലബ്') ||
        lowerQuery.includes('arts') || lowerQuery.includes('sports') || lowerQuery.includes('club')) &&
        (lowerQuery.includes('എത്ര') || lowerQuery.includes('how many') || lowerQuery.includes('ആകെ') ||
            lowerQuery.includes('total') || lowerQuery.includes('count'))) {
        return `കട്ടക്കട നിയമസഭാ മണ്ഡലത്തിൽ ആകെ 94 ആർട്സ് ആൻഡ് സ്പോർട്സ് ക്ലബുകൾ പ്രവർത്തിക്കുന്നു.

പഞ്ചായത്ത് അടിസ്ഥാനത്തിൽ:
- കട്ടക്കട: 18
- മലയിങ്കീഴ്: 18
- മാറനല്ലൂർ: 20
- പള്ളിച്ചൽ: 11
- വിളപ്പിൽ: 15
- വിളവൂർക്കൽ: 12

ആകെ: 94`;
    }

    // === FAQ: VOTER GENDER RATIO (വോട്ടർമാരുടെ ലിംഗാനുപാതം) ===
    if ((lowerQuery.includes('വോട്ടർ') || lowerQuery.includes('voter') || lowerQuery.includes('vote')) &&
        (lowerQuery.includes('ലിംഗ') || lowerQuery.includes('gender') || lowerQuery.includes('പുരുഷ') ||
            lowerQuery.includes('സ്ത്രീ') || lowerQuery.includes('male') || lowerQuery.includes('female') ||
            lowerQuery.includes('ratio') || lowerQuery.includes('അനുപാതം'))) {
        return `കട്ടക്കട മണ്ഡലത്തിലെ വോട്ടർമാരിൽ സ്ത്രീകളാണ് പുരുഷന്മാരെക്കാൾ കൂടുതലുള്ളത്.

വർഷങ്ങളിലെ ലിംഗാനുപാതം:
- 2011: പുരുഷൻ 79,160 | സ്ത്രീ 87,146 | ആകെ 1,66,306
- 2016: പുരുഷൻ 89,559 | സ്ത്രീ 97,833 | ആകെ 1,87,392
- 2021: പുരുഷൻ 93,750 | സ്ത്രീ 1,02,072 | ആകെ 1,95,822
- 2024: പുരുഷൻ 92,624 | സ്ത്രീ 1,01,343 | ആകെ 1,93,967

എല്ലാ വർഷത്തിലും സ്ത്രീ വോട്ടർമാരുടെ എണ്ണം പുരുഷന്മാരെക്കാൾ കൂടുതലാണ്. 2024 ലോകസഭ തെരഞ്ഞെടുപ്പിലെ 1,93,967 വോട്ടർമാരിൽ 52% സ്ത്രീകളാണ്.`;
    }

    // === FAQ: WOMEN REPRESENTATIVES (വനിതാ ജനപ്രതിനിധികൾ) ===
    if ((lowerQuery.includes('വനിതാ') || lowerQuery.includes('women') || lowerQuery.includes('female')) &&
        (lowerQuery.includes('ജനപ്രതിനിധി') || lowerQuery.includes('representative') || lowerQuery.includes('പ്രതിനിധി') ||
            lowerQuery.includes('elected') || lowerQuery.includes('member'))) {
        return `മണ്ഡലത്തിലെ ആറ് ഗ്രാമപഞ്ചായത്തുകളിലായി ആകെ 65 വനിതാ ജനപ്രതിനിധികൾ പ്രവർത്തിക്കുന്നു.

പഞ്ചായത്ത് അടിസ്ഥാനത്തിൽ:
- മലയിങ്കീഴ്: 10
- മാറനല്ലൂർ: 11
- പള്ളിച്ചൽ: 12
- വിളപ്പിൽ: 11
- വിളവൂർക്കൽ: 10
- കട്ടക്കട: 11

ആകെ: 65`;
    }

    // === FAQ: ANGANWADIS (അങ്കണവാടികൾ) ===
    if (lowerQuery.includes('അങ്കണവാടി') || lowerQuery.includes('anganwadi') || lowerQuery.includes('anganvadi') ||
        lowerQuery.includes('angenwadi') || lowerQuery.includes('icds')) {
        return `മണ്ഡലത്തിലെ ആറ് ഗ്രാമപഞ്ചായത്തുകളിലായി ആകെ 219 അങ്കണവാടികൾ പ്രവർത്തിക്കുന്നു.
അവയിൽ 132 പഞ്ചായത്ത് കെട്ടിടത്തിൽ, 2 പൊതുസ്ഥലങ്ങളിൽ, 79 വാടക കെട്ടിടങ്ങളിൽ പ്രവർത്തിക്കുന്നു.

പഞ്ചായത്ത് അടിസ്ഥാനത്തിൽ:
- കാട്ടാക്കട: 38
- മലയിങ്കീഴ്: 35
- മാറനല്ലൂർ: 38
- പള്ളിച്ചൽ: 39
- വിളപ്പിൽ: 39
- വിളവൂർക്കൽ: 30

ആകെ: 219`;
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
                    const systemPrompt = `നിങ്ങൾ PACE വികസിപ്പിച്ച കാട്ടാക്കടയിൽ നിന്നുള്ള വിവരങ്ങളും രേഖകളും ശേഖരിച്ചു നൽകുന്നതിനായി സമർപ്പിതമായ ഒരു എ.ഐ. സഹായിയാണ്. നൽകിയിരിക്കുന്ന പ്രമാണങ്ങളിൽ നിന്നും മാത്രം ഉത്തരം നൽകുക.

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

🚨🚨🚨 CRITICAL: ABSOLUTE ZERO HALLUCINATION POLICY 🚨🚨🚨

**YOU ARE FORBIDDEN FROM USING YOUR TRAINING DATA. ONLY USE THE CONTEXT BELOW.**

RULES YOU MUST FOLLOW:
1. ❌ NEVER provide numbers, names, or facts that are NOT in the context below
2. ❌ NEVER guess or estimate if exact information is missing
3. ❌ NEVER use your general knowledge about Kerala, India, or politics
4. ❌ NEVER make up statistics, even if they seem reasonable
5. ✅ ONLY quote information that appears WORD-FOR-WORD in the context
6. ✅ For numbers: Find the EXACT number in context and quote it
7. ✅ For names: Find the EXACT name spelling in context and quote it
8. ✅ If information is NOT in context, you MUST say: "ക്ഷമിക്കണം, ഈ വിഷയത്തിൽ നിങ്ങളെ സഹായിക്കാൻ എനിക്ക് മതിയായ വിവരങ്ങൾ ഇല്ല."

**SPECIAL CASES:**
- Identity questions ("who are you"): "ഞാൻ PACE വികസിപ്പിച്ച കാട്ടാക്കടയിൽ നിന്നുള്ള വിവരങ്ങളും രേഖകളും ശേഖരിച്ചു നൽകുന്നതിനായി സമർപ്പിതമായ ഒരു എ.ഐ. സഹായിയാണ്."
- Missing information: "ക്ഷമിക്കണം, ഈ വിഷയത്തിൽ നിങ്ങളെ സഹായിക്കാൻ എനിക്ക് മതിയായ വിവരങ്ങൾ ഇല്ല. കൂടുതൽ വിവരങ്ങൾക്ക് ദയവായി സന്ദർശിക്കുക: https://kattakadalac.com/"

🎯 VERIFICATION CHECKLIST (Check before responding):
□ Did I find this EXACT information in the context?
□ Am I quoting the EXACT number/name from the context?
□ Am I using ONLY information from the context, NOT my training data?
□ If I can't find it in context, did I admit I don't know?

📋 VERIFIED FAQ DATA (use these EXACT numbers when relevant):
- കൈത്തറി (Handloom) കുടുംബങ്ങൾ: ആകെ 112 (മാറനല്ലൂർ 85, കാട്ടാക്കട 22, പള്ളിച്ചൽ 3, മലയിൻകീഴ് 2)
- മഴവെള്ള സംഭരണ സംവിധാനങ്ങൾ: ആകെ 284 (മാരനല്ലൂർ 99, പള്ളിച്ചൽ 99, കട്ടക്കട 55, മലയിങ്കീഴ് 19, വിലാപ്പിൽ 12)
- കുടുംബശ്രീ യൂണിറ്റുകൾ (NHG): ആകെ 2,206 (കാട്ടാക്കട 450, പള്ളിച്ചൽ 387, വിളപ്പിൽ 421, മലയിൻകീഴ് 365, മാറനല്ലൂർ 328, വിളവൂർക്കൽ 255)
- ആർട്സ് & സ്പോർട്സ് ക്ലബുകൾ: ആകെ 94 (മാറനല്ലൂർ 20, കട്ടക്കട 18, മലയിങ്കീഴ് 18, വിളപ്പിൽ 15, വിളവൂർക്കൽ 12, പള്ളിച്ചൽ 11)
- വോട്ടർ ലിംഗാനുപാതം (2024): ആകെ 1,93,967 (പുരുഷൻ 92,624 / സ്ത്രീ 1,01,343 - 52% സ്ത്രീകൾ)
- വനിതാ ജനപ്രതിനിധികൾ: ആകെ 65 (പള്ളിച്ചൽ 12, മാറനല്ലൂർ 11, വിളപ്പിൽ 11, കട്ടക്കട 11, മലയിങ്കീഴ് 10, വിളവൂർക്കൽ 10)
- അങ്കണവാടികൾ: ആകെ 219 (പള്ളിച്ചൽ 39, വിളപ്പിൽ 39, കാട്ടാക്കട 38, മാറനല്ലൂർ 38, മലയിങ്കീഴ് 35, വിളവൂർക്കൽ 30)

**ലഭ്യമായ പ്രമാണങ്ങൾ:**
${result.text || 'ക്ഷമിക്കണം, ഈ വിഷയത്തിൽ നിങ്ങളെ സഹായിക്കാൻ എനിക്ക് മതിയായ വിവരങ്ങൾ ഇല്ല. കൂടുതൽ വിവരങ്ങൾക്ക് ദയവായി സന്ദർശിക്കുക: https://kattakadalac.com/'}`;

                    // Generate streaming response with existing model
                    const conversationMessages = [
                        new SystemMessage(systemPrompt),
                        ...messages.slice(-5).map((m) =>
                            m.role === "user" ? new HumanMessage(m.content) : new AIMessage(m.content)
                        ),
                    ];

                    const modelStream = await streamingModel.stream(conversationMessages as BaseMessage[]);

                    // Collect the full response for validation
                    let fullResponse = '';

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
                            fullResponse += contentText;
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