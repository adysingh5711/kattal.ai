// Predefined reply for greeting messages (English + Malayalam).
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

/**
 * Check if query matches FAQ data, identity questions, or known political facts.
 * Matching queries bypass the full RAG pipeline (no expander, no retrieval, no LLM).
 */
export function checkSpecialQueries(query: string): string | null {
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
        'ഐ.ബി. സതീഷ്', 'ഐബി സതീഷ്', 'സതീഷ്', 'sateesh', 'satish', 'satheesh', 'ab sateesh', 'ab satheesh'];
    const mlaRoleKeywords = ['kattakada mla', 'കാട്ടക്കട എം.എൽ.എ', 'കാട്ടക്കട mla', 'mla of kattakada',
        'കാട്ടാക്കട mla', 'കാട്ടാക്കട എം.എൽ.എ'];
    // Only truly subjective opinion/sentiment keywords — NOT factual words like 'work', 'doing', 'performance'
    const opinionKeywords = ['opinion', 'happy with', 'satisfied with', 'നല്ലതാണോ',
        'how is', 'how good', 'good', 'bad', 'performance', 'honest', 'corrupt',
        'അഭിപ്രായം', 'ജനപ്രിയം', 'നന്നാണോ', 'പ്രവർത്തനം എങ്ങനെയുണ്ട്'];
    // Factual/work queries should NEVER be intercepted — let them go through RAG
    const factualExclusionKeywords = ['work done', 'works done', 'achievements', 'projects',
        'ചെയ്ത പ്രവൃത്തികൾ', 'പ്രവർത്തനങ്ങൾ', 'നേട്ടങ്ങൾ', 'പദ്ധതികൾ', 'വികസനം',
        'development', 'done by', 'initiatives', 'schemes'];

    const hasMlaRef = mlaNameKeywords.some(kw => lowerQuery.includes(kw)) ||
        mlaRoleKeywords.some(kw => lowerQuery.includes(kw));
    const hasOpinion = opinionKeywords.some(kw => lowerQuery.includes(kw));
    const isFactualQuery = factualExclusionKeywords.some(kw => lowerQuery.includes(kw));

    if (hasMlaRef && hasOpinion && !isFactualQuery) {
        return `ഐ.ബി. സതീഷ് കാട്ടക്കട നിയോജക മണ്ഡലത്തിന്റെ നിലവിലെ എം.എ.ൽ.എ ആണ്. മണ്ഡലത്തിന്റെ വികസന പ്രവർത്തനങ്ങളിൽ അദ്ദേഹം സജീവമായി പങ്കെടുക്കുന്നു.\nഅദ്ദേഹത്തെക്കുറിച്ച് ജനങ്ങളുടെ അഭിപ്രായങ്ങൾ വ്യത്യസ്തമാണ്. പൊതുവെ അദ്ദേഹത്തെ നല്ല നേതാവായി കാണുന്നു.`;
    }

    // === KATTAKKADA MLA (WHO IS) QUERIES ===
    const whoKeywords = ['who is', 'who represents', 'aaranu', 'ആര്', 'ആരാണ്', 'ജനപ്രതിനിധി'];
    const isWhoQuery = whoKeywords.some(kw => lowerQuery.includes(kw));
    const isPureMlaRef = (lowerQuery.includes('kattakkada') || lowerQuery.includes('kattakada') || lowerQuery.includes('കാട്ടക്കട') || lowerQuery.includes('കാട്ടാക്കട')) &&
        (lowerQuery.includes('mla') || lowerQuery.includes('എം.എൽ.എ') || lowerQuery.includes('എം.എല്.എ'));

    if (isPureMlaRef && (isWhoQuery || !hasOpinion)) {
        return "കാട്ടക്കട മണ്ഡലത്തിലെ എം.എ.ൽ.എ. ഐ.ബി.സതീഷ് ആണ്.";
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
- വിളപ്പിൽ, വിളവൂർക്കൽ: 0

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
        return `കാട്ടാക്കട നിയോജക മണ്ഡലത്തിൽ ആകെ 2,206 കുടുംബശ്രീ യൂണിറ്റുകൾ (എൻ.എച്ച്.ജി./അയൽക്കൂട്ടങ്ങൾ) പ്രവർത്തിച്ചുവരുന്നു.

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
- മലയിൻകീഴ്: 35
- മാറനല്ലൂർ: 38
- പള്ളിച്ചൽ: 39
- വിളപ്പിൽ: 39
- വിളവൂർക്കൽ: 30

ആകെ: 219`;
    }

    return null;
}

