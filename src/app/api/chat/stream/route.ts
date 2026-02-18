import { NextRequest } from "next/server";
import { callChain } from "@/lib/langchain";
import { streamingModel, nonStreamingModel } from "@/lib/llm";
import { SystemMessage, HumanMessage, AIMessage, BaseMessage } from "@langchain/core/messages";
import { showErrorInChat } from "@/lib/error-messages";
import { logger } from "@/lib/logger";

/**
 * MANDATORY Malayalam enforcement layer — runs on EVERY response.
 * Converts ALL non-Malayalam text (English, Hindi/Devanagari, Tamil, etc.)
 * to pure Malayalam script. No exceptions, no threshold checks.
 */
async function enforceMalayalam(rawResponse: string): Promise<string> {
    if (!rawResponse || rawResponse.trim().length === 0) return rawResponse;

    try {
        const enforcementPrompt = `നിങ്ങൾ ഒരു മലയാളം ഭാഷാ ശുദ്ധീകരണ വിദഗ്ധനാണ്. താഴെ നൽകിയിരിക്കുന്ന ടെക്സ്റ്റ് 100% ശുദ്ധ മലയാളത്തിലേക്ക് മാറ്റുക.

🚨 കർശന നിയമങ്ങൾ — ലംഘനം അനുവദനീയമല്ല:

1. ഇംഗ്ലീഷ് (A-Z, a-z) → മലയാളത്തിലേക്ക് മാറ്റുക
   - "hospital" → "ആശുപത്രി"
   - "development" → "വികസനം"
   - "project" → "പദ്ധതി"
   - "government" → "സർക്കാർ"
   - "budget" → "ബജറ്റ്"
   - "road" → "റോഡ്"
   - "bridge" → "പാലം"
   - "school" → "വിദ്യാലയം"
   - "college" → "കോളേജ്"
   - "district" → "ജില്ല"
   - "constituency" → "നിയോജക മണ്ഡലം"

2. ⚠️ ഹിന്ദി/ദേവനാഗരി (क-ह, ा-ौ) → മലയാളത്തിലേക്ക് മാറ്റുക — ഇത് വളരെ പ്രധാനം!
   - "पंचायत" → "പഞ്ചായത്ത്"
   - "ग्राम" → "ഗ്രാമം"
   - "विकास" → "വികസനം"
   - "सरकार" → "സർക്കാർ"
   - "जिला" → "ജില്ല"
   - "अस्पताल" → "ആശുപത്രി"
   - "सड़क" → "റോഡ്"
   - "योजना" → "പദ്ധതി"
   - "शिक्षा" → "വിദ്യാഭ്യാസം"
   - "केरल" → "കേരളം"

3. തമിഴ്/തെലുങ്ക്/കന്നഡ → മലയാളത്തിലേക്ക് മാറ്റുക

4. മാറ്റരുത് (അതേപടി നിലനിർത്തുക):
   - സംഖ്യകൾ: 112, ₹17 കോടി, 2,206
   - URL-കൾ: https://...
   - ഫോർമാറ്റിംഗ്: **, -, •, ബുള്ളറ്റുകൾ, നമ്പറിംഗ്
   - ആളുകളുടെ പേരുകൾ: ഐ.ബി. സതീഷ് (മലയാളം ലിപിയിൽ)
   - സ്ഥലനാമങ്ങൾ: മലയാളം ലിപിയിൽ മാത്രം

5. ❌ ഒരു ദേവനാഗരി അക്ഷരവും (क-ह) ഔട്ട്പുട്ടിൽ പാടില്ല!
   ❌ ഒരു ഇംഗ്ലീഷ് വാക്കും ഔട്ട്പുട്ടിൽ പാടില്ല!
   ❌ അധിക വിശദീകരണങ്ങൾ ചേർക്കരുത്!
   ✅ ശുദ്ധീകരിച്ച മലയാളം ടെക്സ്റ്റ് മാത്രം നൽകുക!

ടെക്സ്റ്റ്:
${rawResponse}

ശുദ്ധ മലയാളം:`;

        const response = await nonStreamingModel.invoke(enforcementPrompt);
        const enforced = typeof response.content === 'string'
            ? response.content.trim()
            : String(response.content).trim();

        // Validate the result has sufficient Malayalam and no Devanagari
        const malayalamChars = (enforced.match(/[\u0D00-\u0D7F]/g) || []).length;
        const devanagariChars = (enforced.match(/[\u0900-\u097F]/g) || []).length;

        if (malayalamChars < 5) {
            logger.warn('Malayalam enforcement returned insufficient Malayalam, using original', 'enforceMalayalam');
            return rawResponse;
        }

        if (devanagariChars > 0) {
            logger.warn(`Enforcement still has ${devanagariChars} Devanagari chars — stripping them`, 'enforceMalayalam');
            // Last resort: strip any remaining Devanagari characters
            return enforced.replace(/[\u0900-\u097F]+/g, '').replace(/\s{2,}/g, ' ').trim();
        }

        return enforced;
    } catch (error) {
        logger.error(`Malayalam enforcement failed: ${error instanceof Error ? error.message : String(error)}`, 'enforceMalayalam');
        return rawResponse; // Return original on failure — better than nothing
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
/** Predefined reply for greeting messages (English + Malayalam). */
const GREETING_RESPONSE =
    "ഹായ്! ഇന്ന് നിന്നെ എങ്ങനെ സഹായിക്കാം? കാട്ടാക്കട നിയോജക മണ്ഡലം, വികസനം, പദ്ധതികൾ, എം.എൽ.എ. എന്നിവയെക്കുറിച്ച് എന്തും ചോദിക്കാം.";

/** Match when the message is only a short greeting (no real question). */
function isGreeting(text: string): boolean {
    const trimmed = text.trim();
    if (trimmed.length > 50) return false;
    const lower = trimmed.toLowerCase().replace(/\s+/g, " ");
    const greetingPatterns = [
        /^(hi|hello|hey|howdy|greetings?|hiya)\s*[!.]?$/i,
        /^good\s+(morning|afternoon|evening|day)\s*[!.]?$/i,
        /^(നമസ്കാരം|നമസ്തേ|ഹായ്|ഹലോ|ഹേയ്)\s*[!.]?$/,
        /^(hi|hello|hey)\s+(there|all)\s*[!.]?$/i,
    ];
    return greetingPatterns.some((re) => re.test(lower.trim()));
}

function checkSpecialQueries(query: string): string | null {
    const lowerQuery = query.toLowerCase();

    // === GREETINGS ===
    if (isGreeting(query)) {
        return GREETING_RESPONSE;
    }

    // === IDENTITY QUESTIONS ===
    if (lowerQuery.includes('who are you') || lowerQuery.includes('നീ ആരാണ്') ||
        lowerQuery.includes('ആരാണ് നീ') || lowerQuery.includes('നിങ്ങൾ ആരാണ്') ||
        lowerQuery.includes('what are you') || lowerQuery.includes('introduce yourself') ||
        lowerQuery.includes('നിങ്ങളെ പരിചയപ്പെടുത്തൂ')) {
        return "ഞാൻ PACE വികസിപ്പിച്ച കാട്ടാക്കടയിൽ നിന്നുള്ള വിവരങ്ങളും രേഖകളും ശേഖരിച്ചു നൽകുന്നതിനായി സമർപ്പിതമായ ഒരു എ.ഐ. സഹായിയാണ്. കാട്ടാക്കട നിയോജക മണ്ഡലത്തെക്കുറിച്ചുള്ള ചോദ്യങ്ങൾക്ക് ഞാൻ ഉത്തരം നൽകാൻ ശ്രമിക്കുന്നു.";
    }

    // === IB SATEESH OPINION QUERIES ===
    // IMPORTANT: Only match pure opinion/sentiment queries, NOT factual queries about work/achievements
    const mlaNameKeywords = ['ib sateesh', 'i.b. sateesh', 'i.b sateesh', 'ib satish', 'i b sateesh',
        'ഐ.ബി. സതീഷ്', 'ഐബി സതീഷ്', 'സതീഷ്', 'sateesh', 'satish'];
    const mlaRoleKeywords = ['kattakada mla', 'കാട്ടക്കട എം.എൽ.എ', 'കാട്ടക്കട mla', 'mla of kattakada',
        'കാട്ടാക്കട mla', 'കാട്ടാക്കട എം.എൽ.എ'];
    // Only truly subjective opinion/sentiment keywords — NOT factual words like 'work', 'doing', 'performance'
    const opinionKeywords = ['opinion', 'happy with', 'satisfied with', 'നല്ലതാണോ',
        'good leader', 'bad leader', 'like him', 'dislike him',
        'അഭിപ്രായം', 'ജനപ്രിയം', 'corrupt', 'honest', 'സത്യസന്ധത',
        'is he good', 'is she good', 'how good is'];
    // Factual/work queries should NEVER be intercepted — let them go through RAG
    const factualExclusionKeywords = ['work done', 'works done', 'achievements', 'projects',
        'what has', 'what did', 'what work', 'tell me about', 'details', 'list',
        'ചെയ്ത പ്രവൃത്തികൾ', 'പ്രവർത്തനങ്ങൾ', 'നേട്ടങ്ങൾ', 'പദ്ധതികൾ', 'വികസനം',
        'ചെയ്തത്', 'എന്തൊക്കെ', 'വിവരിക്കുക', 'പറയൂ', 'development',
        'done by', 'contributed', 'accomplished', 'initiatives', 'schemes'];
    const hasMlaRef = mlaNameKeywords.some(kw => lowerQuery.includes(kw)) ||
        mlaRoleKeywords.some(kw => lowerQuery.includes(kw));
    const hasOpinion = opinionKeywords.some(kw => lowerQuery.includes(kw));
    const isFactualQuery = factualExclusionKeywords.some(kw => lowerQuery.includes(kw));
    if (hasMlaRef && hasOpinion && !isFactualQuery) {
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
            `${m.role === "user" ? "Human" : "Assistant"}: ${m.content}`
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
                        data: { message: 'രേഖകൾ തിരയുന്നു...' }
                    };
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify(loadingStartEvent)}\n\n`));

                    // Wait for context to be ready
                    const result = await contextPromise;

                    // NOTE: Do NOT send loading_complete or clear_message here.
                    // The loading message stays visible through both LLM passes.

                    // Create Malayalam-focused system prompt — entirely in Malayalam to prevent English leakage
                    const systemPrompt = `നിങ്ങൾ PACE വികസിപ്പിച്ച കാട്ടാക്കടയിൽ നിന്നുള്ള വിവരങ്ങളും രേഖകളും ശേഖരിച്ചു നൽകുന്നതിനായി സമർപ്പിതമായ ഒരു എ.ഐ. സഹായിയാണ്. നൽകിയിരിക്കുന്ന പ്രമാണങ്ങളിൽ നിന്നും മാത്രം ഉത്തരം നൽകുക.

🚫🚫🚫 കർശന ഭാഷാ നിയമം — മലയാളം മാത്രം 🚫🚫🚫
- എല്ലാ ഉത്തരങ്ങളും മലയാളം ലിപിയിൽ (മലയാളം) മാത്രം എഴുതുക
- ഇംഗ്ലീഷ് ചോദ്യമായാലും മലയാളത്തിൽ മാത്രം ഉത്തരം നൽകുക
- ഇംഗ്ലീഷ്, ഹിന്ദി, തമിഴ്, തെലുങ്ക്, കന്നഡ അല്ലെങ്കിൽ മറ്റേതെങ്കിലും ഭാഷ ഒരിക്കലും ഉപയോഗിക്കരുത്
- സാങ്കേതിക പദങ്ങൾക്ക് മലയാളം പര്യായങ്ങൾ ഉപയോഗിക്കുക
- ഇംഗ്ലീഷ് വാക്കുകൾ ഒഴിവാക്കുക, മലയാളത്തിൽ തത്തുല്യമില്ലാത്ത പദങ്ങൾ മാത്രം ഇംഗ്ലീഷിൽ എഴുതുക
- ⚠️ മലയാളം ഹിന്ദിയല്ല! ദേവനാഗരി ലിപി (क, ख, ग) ഒരിക്കലും ഉപയോഗിക്കരുത്!
- ഉദാഹരണം ശരിയായ വാക്കുകൾ: നമസ്കാരം, ആശുപത്രി, വിവരം, ജില്ല, മണ്ഡലം

**പദ പരിവർത്തനം:**
- Budget → ബജറ്റ് / വരുമാന-ചെലവ് പദ്ധതി
- Development → വികസനം
- Project → പദ്ധതി
- Government → സർക്കാർ

🚨🚨🚨 ഹാളുസിനേഷൻ പൂജ്യം — കർശന നയം 🚨🚨🚨

**നിങ്ങളുടെ പരിശീലന ഡാറ്റ ഉപയോഗിക്കുന്നത് കർശനമായി നിരോധിച്ചിരിക്കുന്നു. താഴെ നൽകിയിരിക്കുന്ന പ്രമാണങ്ങൾ മാത്രം ഉപയോഗിക്കുക.**

പാലിക്കേണ്ട നിയമങ്ങൾ:
1. ❌ താഴെയുള്ള പ്രമാണത്തിൽ ഇല്ലാത്ത സംഖ്യകൾ, പേരുകൾ, വസ്തുതകൾ ഒരിക്കലും നൽകരുത്
2. ❌ കൃത്യമായ വിവരം ഇല്ലെങ്കിൽ ഒരിക്കലും ഊഹിക്കരുത്
3. ❌ കേരളം, ഇന്ത്യ, രാഷ്ട്രീയം എന്നിവയെക്കുറിച്ചുള്ള പൊതു അറിവ് ഒരിക്കലും ഉപയോഗിക്കരുത്
4. ❌ സ്ഥിതിവിവരക്കണക്കുകൾ ഒരിക്കലും സ്വയം ഉണ്ടാക്കരുത്
5. ✅ പ്രമാണത്തിൽ അക്ഷരാർത്ഥത്തിൽ കാണുന്ന വിവരങ്ങൾ മാത്രം ഉദ്ധരിക്കുക
6. ✅ സംഖ്യകൾ: പ്രമാണത്തിൽ നിന്ന് കൃത്യമായ സംഖ്യ കണ്ടെത്തി ഉദ്ധരിക്കുക
7. ✅ പേരുകൾ: പ്രമാണത്തിൽ നിന്ന് കൃത്യമായ അക്ഷരവിന്യാസം ഉദ്ധരിക്കുക
8. ✅ വിവരം പ്രമാണത്തിൽ ഇല്ലെങ്കിൽ: "ക്ഷമിക്കണം, ഈ വിഷയത്തിൽ നിങ്ങളെ സഹായിക്കാൻ എനിക്ക് മതിയായ വിവരങ്ങൾ ഇല്ല."

**പ്രത്യേക സാഹചര്യങ്ങൾ:**
- ആരാണ് നിങ്ങൾ: "ഞാൻ PACE വികസിപ്പിച്ച കാട്ടാക്കടയിൽ നിന്നുള്ള വിവരങ്ങളും രേഖകളും ശേഖരിച്ചു നൽകുന്നതിനായി സമർപ്പിതമായ ഒരു എ.ഐ. സഹായിയാണ്."
- വിവരം ലഭ്യമല്ലെങ്കിൽ: "ക്ഷമിക്കണം, ഈ വിഷയത്തിൽ നിങ്ങളെ സഹായിക്കാൻ എനിക്ക് മതിയായ വിവരങ്ങൾ ഇല്ല. കൂടുതൽ വിവരങ്ങൾക്ക് ദയവായി സന്ദർശിക്കുക: https://kattakadalac.com/"

🎯 ഉത്തരം നൽകുന്നതിന് മുമ്പ് പരിശോധിക്കുക:
□ ഈ കൃത്യമായ വിവരം പ്രമാണത്തിൽ ഉണ്ടോ?
□ പ്രമാണത്തിൽ നിന്നുള്ള കൃത്യമായ സംഖ്യ/പേര് ഉദ്ധരിക്കുന്നുണ്ടോ?
□ പ്രമാണത്തിൽ നിന്നുള്ള വിവരങ്ങൾ മാത്രമാണോ ഉപയോഗിക്കുന്നത്, പരിശീലന ഡാറ്റയല്ല?
□ പ്രമാണത്തിൽ കണ്ടെത്താനായില്ലെങ്കിൽ, അറിയില്ലെന്ന് സമ്മതിച്ചോ?

📋 പരിശോധിച്ച FAQ ഡാറ്റ (ബന്ധപ്പെട്ട സമയത്ത് ഈ കൃത്യമായ സംഖ്യകൾ ഉപയോഗിക്കുക):
- കൈത്തറി കുടുംബങ്ങൾ: ആകെ 112 (മാറനല്ലൂർ 85, കാട്ടാക്കട 22, പള്ളിച്ചൽ 3, മലയിൻകീഴ് 2)
- മഴവെള്ള സംഭരണ സംവിധാനങ്ങൾ: ആകെ 284 (മാരനല്ലൂർ 99, പള്ളിച്ചൽ 99, കട്ടക്കട 55, മലയിങ്കീഴ് 19, വിലാപ്പിൽ 12)
- കുടുംബശ്രീ യൂണിറ്റുകൾ: ആകെ 2,206 (കാട്ടാക്കട 450, പള്ളിച്ചൽ 387, വിളപ്പിൽ 421, മലയിൻകീഴ് 365, മാറനല്ലൂർ 328, വിളവൂർക്കൽ 255)
- ആർട്സ് & സ്പോർട്സ് ക്ലബുകൾ: ആകെ 94 (മാറനല്ലൂർ 20, കട്ടക്കട 18, മലയിങ്കീഴ് 18, വിളപ്പിൽ 15, വിളവൂർക്കൽ 12, പള്ളിച്ചൽ 11)
- വോട്ടർ ലിംഗാനുപാതം (2024): ആകെ 1,93,967 (പുരുഷൻ 92,624 / സ്ത്രീ 1,01,343 - 52% സ്ത്രീകൾ)
- വനിതാ ജനപ്രതിനിധികൾ: ആകെ 65 (പള്ളിച്ചൽ 12, മാറനല്ലൂർ 11, വിളപ്പിൽ 11, കട്ടക്കട 11, മലയിങ്കീഴ് 10, വിളവൂർക്കൽ 10)
- അങ്കണവാടികൾ: ആകെ 219 (പള്ളിച്ചൽ 39, വിളപ്പിൽ 39, കാട്ടാക്കട 38, മാറനല്ലൂർ 38, മലയിങ്കീഴ് 35, വിളവൂർക്കൽ 30)

📝 ഉദാഹരണങ്ങൾ (ഈ ഫോർമാറ്റ് പിന്തുടരുക):
ചോദ്യം: "What are the hospitals in Kattakada?"
ഉത്തരം: "കാട്ടാക്കട നിയോജക മണ്ഡലത്തിൽ ആകെ 6 ആശുപത്രികൾ പ്രവർത്തിക്കുന്നു. മലയിൻകീഴിൽ താലൂക്ക് ആശുപത്രി, വിളപ്പിലും വിളവൂർക്കലും കമ്മ്യൂണിറ്റി ഹെൽത്ത് സെന്ററുകളും ഉണ്ട്."

ചോദ്യം: "Tell me about development projects"
ഉത്തരം: "മണ്ഡലത്തിൽ 26 പ്രധാന റോഡ് പദ്ധതികൾ ഉൾപ്പെടെ നിരവധി വികസന പ്രവർത്തനങ്ങൾ നടന്നുവരുന്നു. കുടുവീട്ട് കടവ് പാലം (₹17 കോടി), മലയിൻകീഴ് ആർട്സ് & സയൻസ് കോളേജ് (₹9.75 കോടി) എന്നിവ പ്രധാന പദ്ധതികളാണ്."

**ലഭ്യമായ പ്രമാണങ്ങൾ (${result.analysis?.documentsUsed || 0} രേഖകൾ — ഈ രേഖകളിൽ നിന്ന് മാത്രം ഉത്തരം നൽകുക):**
${result.text || 'ക്ഷമിക്കണം, ഈ വിഷയത്തിൽ നിങ്ങളെ സഹായിക്കാൻ എനിക്ക് മതിയായ വിവരങ്ങൾ ഇല്ല. കൂടുതൽ വിവരങ്ങൾക്ക് ദയവായി സന്ദർശിക്കുക: https://kattakadalac.com/'}

🚫 ഓർമ്മിക്കുക: ഉത്തരം മലയാളത്തിൽ മാത്രം. ഇംഗ്ലീഷ് ഒരിക്കലും ഉപയോഗിക്കരുത്. ഇംഗ്ലീഷ് ചോദ്യത്തിനും മലയാളത്തിൽ മാത്രം ഉത്തരം നൽകുക. 🚫`;

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
                    // MANDATORY MALAYALAM ENFORCEMENT — runs on EVERY response
                    // Converts any English/Hindi/Tamil leakage to pure Malayalam
                    // ═══════════════════════════════════════════════════════════
                    if (fullResponse.trim().length > 0) {
                        logger.info(`Running mandatory Malayalam enforcement on ${fullResponse.length} chars`, 'api/chat/stream');

                        // Run mandatory Malayalam enforcement (second LLM pass)
                        const enforcedResponse = await enforceMalayalam(fullResponse);

                        // NOW clear the loading message — right before sending final response
                        const loadingCompleteEvent: StreamEvent = {
                            type: 'loading_complete',
                            data: {
                                documentsUsed: result.analysis?.documentsUsed || 0,
                                sources: result.sources || []
                            }
                        };
                        controller.enqueue(encoder.encode(`data: ${JSON.stringify(loadingCompleteEvent)}\n\n`));

                        const clearMessageEvent: StreamEvent = {
                            type: 'clear_message',
                            data: { clearPrevious: true }
                        };
                        controller.enqueue(encoder.encode(`data: ${JSON.stringify(clearMessageEvent)}\n\n`));

                        // Stream ONLY the final enforced pure-Malayalam response
                        const enforcedEvent: StreamEvent = {
                            type: 'content',
                            content: enforcedResponse
                        };
                        controller.enqueue(encoder.encode(`data: ${JSON.stringify(enforcedEvent)}\n\n`));

                        logger.info(
                            `Malayalam enforcement complete (${enforcedResponse.length} chars)`,
                            'api/chat/stream'
                        );
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
                    logger.error(`Stream processing error: ${errorDetails.technicalMessage}`, 'api/chat/stream');
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
        logger.error(`Chat stream API error: ${errorDetails.technicalMessage}`, 'api/chat/stream');
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