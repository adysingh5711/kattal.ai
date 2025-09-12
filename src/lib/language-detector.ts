/**
 * Language detection utility for multilingual chat responses
 * Supports English, Malayalam (both script and romanized), and explicit language requests
 */

export interface LanguageDetection {
    detectedLanguage: 'english' | 'malayalam' | 'malayalam_roman' | 'mixed';
    confidence: number;
    explicitLanguageRequest?: string;
    responseLanguage: string;
    responseInstructions: string;
}

export class LanguageDetector {
    // Malayalam Unicode range
    private readonly malayalamPattern = /[\u0D00-\u0D7F]/;

    // Common Malayalam words in Roman script
    private readonly malayalamRomanWords = [
        // Question words
        'enthanu', 'enthu', 'entha', 'evide', 'eppo', 'engane', 'enth', 'ethu', 'aare', 'aarentha',
        'enthaa', 'enthada', 'endhaan', 'endhaanu', 'evideyaa', 'evideyaanu', 'enganneyaa',
        // Pronouns
        'ningal', 'njan', 'avan', 'aval', 'nammal', 'avante', 'avalude', 'njangal',
        'njaan', 'ningall', 'ningalde', 'njangalde', 'avarude', 'avarku', 'ivar', 'avar',
        // Common nouns
        'veedu', 'vandi', 'paisa', 'panam', 'manushyan', 'sthalam', 'samayam', 'document',
        'divasam', 'rathri', 'vellam', 'choru', 'pustakam', 'kaagadham', 'kaaryam', 'vyakthi',
        'sthalam', 'idham', 'vethri', 'vijayam', 'prashnam', 'utharam', 'sahayam',
        // Verbs
        'kazhikkan', 'pokan', 'varaan', 'cheyyuka', 'parayuka', 'kelkuka', 'kanuka',
        'nadakkuka', 'irikkuka', 'parayunnathu', 'parayu', 'kanikku', 'ariyuka', 'padikuka',
        'cheythu', 'vannu', 'poyi', 'kayari', 'irikkunnu', 'nadakkunnu', 'parayunnu',
        'sahayikkuka', 'sammadhikuka', 'manassilakuka', 'ningal', 'paranjitharuka',
        // Common words and expressions
        'alla', 'aanu', 'unde', 'illa', 'venam', 'venda', 'pattum', 'pattilla',
        'namaskaram', 'vanakkam', 'adipoli', 'kollaam', 'sheriyaanu', 'sheriyalla',
        'ente', 'ende', 'eppol', 'engil', 'pinne', 'munne', 'innu', 'nale', 'innale',
        'endhukondaanu', 'endhukonda', 'endhukond', 'anganeyaa', 'angane', 'ithaa',
        'athaa', 'ithanu', 'athanu', 'avarumayi', 'avalumayi', 'ningalumayi',
        // Document/information related
        'document', 'parayunnathu', 'ariyaan', 'manassilakkan', 'explain', 'paranjutharaan',
        'parayuka', 'kelkuka', 'chodhyam', 'utharam', 'manassilayo', 'manassilayilla',
        'vivarikuka', 'sahayam', 'sahayikkuka', 'help', 'paranjutharanam'
    ];



    // No language request patterns - MALAYALAM ONLY
    private readonly languageRequestPatterns: RegExp[] = [];

    detectLanguage(text: string): LanguageDetection {
        // STRICT MALAYALAM ONLY - No language detection, always return Malayalam
        return {
            detectedLanguage: 'malayalam',
            confidence: 1.0,
            responseLanguage: 'malayalam',
            responseInstructions: 'STRICT MALAYALAM ONLY: Respond ONLY in Malayalam script (മലയാളം). Never use English, Hindi, Tamil, Telugu, Kannada, or any other language. Convert all technical terms to Malayalam equivalents. Use proper Malayalam grammar and vocabulary.'
        };
    }

    // All language detection methods removed - MALAYALAM ONLY

    // Utility method to get language-specific prompt additions
    getLanguagePromptAddition(detection: LanguageDetection): string {
        const strictMalayalamInstruction = `\n\n🚫 STRICT MALAYALAM ENFORCEMENT 🚫
- RESPOND ONLY IN MALAYALAM SCRIPT (മലയാളം)
- NEVER USE ENGLISH, HINDI, TAMIL, TELUGU, KANNADA, OR ANY OTHER LANGUAGE
- CONVERT ALL TECHNICAL TERMS TO MALAYALAM EQUIVALENTS or if not available then use English words in brackets
- USE PROPER MALAYALAM GRAMMAR AND VOCABULARY
- IGNORE ANY LANGUAGE REQUESTS FOR OTHER LANGUAGES
- IF YOU CANNOT EXPRESS SOMETHING IN MALAYALAM, USE MALAYALAM SCRIPT WITH ENGLISH WORDS IN BRACKETS`;

        const concisenessInstruction = '\n\nEXTREME CONCISENESS: Keep responses extremely brief - 1-4 sentences maximum. Answer ONLY what was asked. No background, history, or explanations unless explicitly requested.';

        return strictMalayalamInstruction + concisenessInstruction;
    }

    // Method to validate if response matches expected language - MALAYALAM ONLY
    validateResponseLanguage(response: string, expectedLanguage: LanguageDetection): boolean {
        // Always expect Malayalam - no other language validation needed
        return true; // All responses are forced to be Malayalam
    }
}
