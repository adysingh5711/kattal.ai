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



    // Explicit language request patterns
    private readonly languageRequestPatterns = [
        /answer in (english|malayalam)/i,
        /reply in (english|malayalam)/i,
        /respond in (english|malayalam)/i,
        /(english|malayalam)(?:il|ile) answer/i,
        /(english|malayalam)(?:il|ile) reply/i,
        /answer.*(?:english|malayalam)/i,
        /reply.*(?:english|malayalam)/i
    ];

    detectLanguage(text: string): LanguageDetection {
        const cleanText = text.trim().toLowerCase();

        // Check for explicit language requests first
        const explicitRequest = this.detectExplicitLanguageRequest(text);
        if (explicitRequest) {
            return {
                detectedLanguage: 'mixed',
                confidence: 1.0,
                explicitLanguageRequest: explicitRequest,
                responseLanguage: explicitRequest,
                responseInstructions: this.getLanguageInstructions(explicitRequest)
            };
        }



        // Check for Malayalam script
        if (this.malayalamPattern.test(text)) {
            return {
                detectedLanguage: 'malayalam',
                confidence: 0.95,
                responseLanguage: 'malayalam',
                responseInstructions: 'Respond in Malayalam script (മലയാളം). Use proper Malayalam grammar and vocabulary.'
            };
        }



        // Check for Malayalam in Roman script
        const malayalamRomanScore = this.calculateMalayalamRomanScore(cleanText);
        console.log(`Malayalam Roman Score for "${text}": ${malayalamRomanScore}`);
        if (malayalamRomanScore > 0.15) { // Even lower threshold for better Malayalam detection
            return {
                detectedLanguage: 'malayalam_roman',
                confidence: malayalamRomanScore,
                responseLanguage: 'malayalam',
                responseInstructions: 'Respond in Malayalam script (മലയാളം). Use proper Malayalam grammar and vocabulary. The user wrote Malayalam words in English letters, but respond in Malayalam script.'
            };
        }

        // Default to English
        return {
            detectedLanguage: 'english',
            confidence: 0.8,
            responseLanguage: 'english',
            responseInstructions: 'Respond in clear, natural English.'
        };
    }

    private detectExplicitLanguageRequest(text: string): string | null {
        for (const pattern of this.languageRequestPatterns) {
            const match = text.match(pattern);
            if (match) {
                // Extract the language name from the match
                const language = match[1]?.toLowerCase() ||
                    match[2]?.toLowerCase() ||
                    match[3]?.toLowerCase();

                if (language) {
                    return this.normalizeLanguageName(language);
                }
            }
        }
        return null;
    }

    private normalizeLanguageName(language: string): string {
        switch (language.toLowerCase()) {
            case 'malayalam':
            case 'malayalm': // common typo
                return 'malayalam';
            case 'english':
                return 'english';
            case 'hindi':
                return 'hindi';
            case 'tamil':
                return 'tamil';
            default:
                return 'english';
        }
    }

    private calculateMalayalamRomanScore(text: string): number {
        const words = text.split(/\s+/);
        const totalWords = words.length;

        if (totalWords === 0) return 0;

        let malayalamWordCount = 0;

        // Check for exact matches with known Malayalam words
        for (const word of words) {
            const cleanWord = word.replace(/[^\w]/g, ''); // Remove punctuation
            if (this.malayalamRomanWords.includes(cleanWord)) {
                malayalamWordCount++;
            }
        }

        // Check for Malayalam-like patterns
        let patternScore = 0;
        for (const word of words) {
            // Malayalam words often have specific patterns
            if (word.includes('kk') || word.includes('ll') || word.includes('nn') ||
                word.includes('mm') || word.includes('pp') || word.includes('tt')) {
                patternScore += 0.1;
            }

            // Common Malayalam patterns and phonetics
            if (word.includes('nj') || word.includes('zh') || word.includes('ng') ||
                word.includes('ay') || word.includes('aa') || word.includes('ee') ||
                word.includes('oo') || word.includes('ei')) {
                patternScore += 0.1;
            }

            // Common endings
            if (word.endsWith('an') || word.endsWith('am') || word.endsWith('um') ||
                word.endsWith('il') || word.endsWith('inu') || word.endsWith('ude') ||
                word.endsWith('aa') || word.endsWith('oo') || word.endsWith('aanu') ||
                word.endsWith('unnu') || word.endsWith('ikku') || word.endsWith('anu')) {
                patternScore += 0.1;
            }

            // Common prefixes
            if (word.startsWith('enth') || word.startsWith('ev') || word.startsWith('ninj') ||
                word.startsWith('nj') || word.startsWith('av') || word.startsWith('man')) {
                patternScore += 0.1;
            }
        }

        const exactMatchScore = malayalamWordCount / totalWords;
        const normalizedPatternScore = Math.min(patternScore / totalWords, 0.3);

        return exactMatchScore + normalizedPatternScore;
    }



    private getLanguageInstructions(language: string): string {
        switch (language.toLowerCase()) {
            case 'malayalam':
                return 'Respond in Malayalam script (മലയാളം). Use proper Malayalam grammar and vocabulary.';
            case 'english':
                return 'Respond in clear, natural English.';
            default:
                return 'Respond in clear, natural English.';
        }
    }

    // Utility method to get language-specific prompt additions
    getLanguagePromptAddition(detection: LanguageDetection): string {
        const baseInstruction = `\n\nIMPORTANT LANGUAGE INSTRUCTION: ${detection.responseInstructions}`;
        const concisenessInstruction = '\n\nEXTREME CONCISENESS: Keep responses extremely brief - 1-4 sentences maximum. Answer ONLY what was asked. No background, history, or explanations unless explicitly requested.';

        if (detection.explicitLanguageRequest) {
            if (detection.explicitLanguageRequest === 'malayalam') {
                return baseInstruction + `\n\nThe user explicitly requested a response in Malayalam. Respond in Malayalam script (മലയാളം).` + concisenessInstruction;
            } else {
                return baseInstruction + `\n\nThe user requested a response in ${detection.explicitLanguageRequest}, but only Malayalam and English responses are allowed. Respond in English.` + concisenessInstruction;
            }
        }

        switch (detection.detectedLanguage) {
            case 'malayalam':
                return baseInstruction + '\n\nThe user wrote in Malayalam script, so maintain the same language and script in your response.' + concisenessInstruction;

            case 'malayalam_roman':
                return baseInstruction + '\n\nThe user wrote Malayalam words using English letters, but respond in Malayalam script (മലയാളം). Convert the romanized Malayalam to proper Malayalam script.' + concisenessInstruction;

            case 'english':
            default:
                return baseInstruction + '\n\nThe user wrote in English or another language, so respond in clear, natural English.' + concisenessInstruction;
        }
    }

    // Method to validate if response matches expected language
    validateResponseLanguage(response: string, expectedLanguage: LanguageDetection): boolean {
        const responseDetection = this.detectLanguage(response);

        // If explicit request, check if it matches
        if (expectedLanguage.explicitLanguageRequest) {
            return responseDetection.detectedLanguage === expectedLanguage.explicitLanguageRequest ||
                responseDetection.responseLanguage === expectedLanguage.explicitLanguageRequest;
        }

        // Otherwise, check if response language matches detected input language
        return responseDetection.detectedLanguage === expectedLanguage.detectedLanguage ||
            responseDetection.responseLanguage === expectedLanguage.responseLanguage;
    }
}
