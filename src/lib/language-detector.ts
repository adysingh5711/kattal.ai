/**
 * Language detection utility for multilingual chat responses
 * Supports English, Malayalam (both script and romanized), and explicit language requests
 */

export interface LanguageDetection {
    detectedLanguage: 'english' | 'malayalam' | 'malayalam_roman' | 'hindi' | 'hinglish' | 'mixed';
    confidence: number;
    explicitLanguageRequest?: string;
    responseLanguage: string;
    responseInstructions: string;
}

export class LanguageDetector {
    // Malayalam Unicode range
    private readonly malayalamPattern = /[\u0D00-\u0D7F]/;

    // Hindi Unicode range (Devanagari script)
    private readonly hindiPattern = /[\u0900-\u097F]/;

    // Common Malayalam words in Roman script
    private readonly malayalamRomanWords = [
        // Question words
        'enthanu', 'enthu', 'entha', 'evide', 'eppo', 'engane', 'enth', 'ethu', 'aare', 'aarentha',
        // Pronouns
        'ningal', 'njan', 'avan', 'aval', 'nammal', 'avante', 'avalude', 'njangal',
        // Common nouns
        'veedu', 'vandi', 'paisa', 'panam', 'manushyan', 'sthalam', 'samayam', 'document',
        'divasam', 'rathri', 'vellam', 'choru', 'pustakam', 'kaagadham',
        // Verbs
        'kazhikkan', 'pokan', 'varaan', 'cheyyuka', 'parayuka', 'kelkuka', 'kanuka',
        'nadakkuka', 'irikkuka', 'parayunnathu', 'parayu', 'kanikku',
        // Common words
        'alla', 'aanu', 'unde', 'illa', 'venam', 'venda', 'pattum', 'pattilla',
        'namaskaram', 'vanakkam', 'adipoli', 'kollaam', 'sheriyaanu',
        // Document/information related
        'document', 'parayunnathu', 'ariyaan', 'manassilakkan', 'explain', 'paranjutharaan'
    ];

    // Common Hindi/Hinglish words in Roman script
    private readonly hindiRomanWords = [
        // Question words
        'kya', 'kaun', 'kaise', 'kahan', 'kab', 'kyun', 'kyu', 'kis', 'kitna', 'kitne',
        // Pronouns
        'main', 'mein', 'aap', 'tum', 'vah', 'yah', 'woh', 'yeh', 'hum', 'humara', 'tumhara', 'uska', 'iska',
        // Common verbs
        'hai', 'hain', 'tha', 'the', 'hoga', 'hogi', 'karna', 'karo', 'karte', 'karta', 'karti',
        'jaana', 'jao', 'aana', 'aao', 'dekhna', 'dekho', 'sunna', 'suno', 'bolna', 'bolo',
        'samjhana', 'samjhao', 'batana', 'batao', 'padhna', 'padho', 'likhna', 'likho',
        // Common words
        'acha', 'accha', 'theek', 'thik', 'nahi', 'nahin', 'haan', 'han', 'bilkul', 'zarur',
        'namaste', 'namaskar', 'dhanyawad', 'shukriya', 'maaf', 'sorry', 'please', 'kripa',
        // Document/information related
        'document', 'kagaz', 'kitab', 'pustak', 'jankari', 'maloom', 'pata', 'samjh', 'explain',
        'bataiye', 'kahiye', 'dikhiye', 'padhiye', 'suniye', 'dekhiye',
        // Common Hinglish patterns
        'kar', 'karke', 'karne', 'vale', 'wale', 'mein', 'me', 'pe', 'par', 'se', 'tak', 'bhi', 'bhe'
    ];

    // Explicit language request patterns
    private readonly languageRequestPatterns = [
        /answer in (english|malayalam|hindi|tamil)/i,
        /reply in (english|malayalam|hindi|tamil)/i,
        /respond in (english|malayalam|hindi|tamil)/i,
        /(english|malayalam|hindi|tamil)(?:il|ile) answer/i,
        /(english|malayalam|hindi|tamil)(?:il|ile) reply/i,
        /answer.*(?:english|malayalam|hindi|tamil)/i,
        /reply.*(?:english|malayalam|hindi|tamil)/i
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

        // Check for Hindi script (Devanagari)
        if (this.hindiPattern.test(text)) {
            return {
                detectedLanguage: 'hindi',
                confidence: 0.95,
                responseLanguage: 'hindi',
                responseInstructions: 'Respond in Hindi script (हिन्दी). Use proper Hindi grammar and Devanagari script.'
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

        // Check for Hindi in Roman script (Hinglish)
        const hinglishScore = this.calculateHinglishScore(cleanText);
        console.log(`Hinglish Score for "${text}": ${hinglishScore}`);
        if (hinglishScore > 0.2) { // Lower threshold for better detection
            return {
                detectedLanguage: 'hinglish',
                confidence: hinglishScore,
                responseLanguage: 'hinglish',
                responseInstructions: 'Respond in Hindi but using Roman/English letters (Hinglish). Use Hindi sentence structure and vocabulary but write in English alphabet.'
            };
        }

        // Check for Malayalam in Roman script
        const malayalamRomanScore = this.calculateMalayalamRomanScore(cleanText);
        console.log(`Malayalam Roman Score for "${text}": ${malayalamRomanScore}`);
        if (malayalamRomanScore > 0.2) { // Lower threshold for better detection
            return {
                detectedLanguage: 'malayalam_roman',
                confidence: malayalamRomanScore,
                responseLanguage: 'malayalam_roman',
                responseInstructions: 'Respond in Malayalam but using Roman/English letters (Manglish). Use Malayalam sentence structure and vocabulary but write in English alphabet.'
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

            // Common endings
            if (word.endsWith('an') || word.endsWith('am') || word.endsWith('um') ||
                word.endsWith('il') || word.endsWith('inu') || word.endsWith('ude')) {
                patternScore += 0.1;
            }
        }

        const exactMatchScore = malayalamWordCount / totalWords;
        const normalizedPatternScore = Math.min(patternScore / totalWords, 0.3);

        return exactMatchScore + normalizedPatternScore;
    }

    private calculateHinglishScore(text: string): number {
        const words = text.split(/\s+/);
        const totalWords = words.length;

        if (totalWords === 0) return 0;

        let hindiWordCount = 0;

        // Check for exact matches with known Hindi words
        for (const word of words) {
            const cleanWord = word.replace(/[^\w]/g, ''); // Remove punctuation
            if (this.hindiRomanWords.includes(cleanWord)) {
                hindiWordCount++;
            }
        }

        // Check for Hindi-like patterns
        let patternScore = 0;
        for (const word of words) {
            // Common Hindi word patterns
            if (word.includes('kar') || word.includes('wal') || word.includes('val') ||
                word.includes('log') || word.includes('ghar') || word.includes('baz')) {
                patternScore += 0.1;
            }

            // Common Hindi endings
            if (word.endsWith('kar') || word.endsWith('ke') || word.endsWith('ka') ||
                word.endsWith('ki') || word.endsWith('ko') || word.endsWith('se') ||
                word.endsWith('mein') || word.endsWith('par') || word.endsWith('wala') ||
                word.endsWith('vale') || word.endsWith('hain') || word.endsWith('hai')) {
                patternScore += 0.1;
            }
        }

        const exactMatchScore = hindiWordCount / totalWords;
        const normalizedPatternScore = Math.min(patternScore / totalWords, 0.3);

        return exactMatchScore + normalizedPatternScore;
    }

    private getLanguageInstructions(language: string): string {
        switch (language.toLowerCase()) {
            case 'malayalam':
                return 'Respond in Malayalam script (മലയാളം). Use proper Malayalam grammar and vocabulary.';
            case 'hindi':
                return 'Respond in Hindi script (हिन्दी). Use proper Hindi grammar and Devanagari script.';
            case 'english':
                return 'Respond in clear, natural English.';
            case 'tamil':
                return 'Respond in Tamil (தமிழ்). Use proper Tamil grammar and script.';
            default:
                return 'Respond in clear, natural English.';
        }
    }

    // Utility method to get language-specific prompt additions
    getLanguagePromptAddition(detection: LanguageDetection): string {
        const baseInstruction = `\n\nIMPORTANT LANGUAGE INSTRUCTION: ${detection.responseInstructions}`;

        if (detection.explicitLanguageRequest) {
            return baseInstruction + `\n\nThe user explicitly requested a response in ${detection.explicitLanguageRequest}. This takes priority over any detected language.`;
        }

        switch (detection.detectedLanguage) {
            case 'hindi':
                return baseInstruction + '\n\nThe user wrote in Hindi Devanagari script, so maintain the same language and script in your response.';

            case 'hinglish':
                return baseInstruction + '\n\nThe user wrote Hindi words using Roman/English letters (Hinglish), so respond in the same style. For example: "Main aapko help kar sakta hun" instead of "मैं आपकी मदद कर सकता हूँ" or "I can help you".';

            case 'malayalam':
                return baseInstruction + '\n\nThe user wrote in Malayalam script, so maintain the same language and script in your response.';

            case 'malayalam_roman':
                return baseInstruction + '\n\nThe user wrote Malayalam words using Roman/English letters (Manglish), so respond in the same style. For example: "Njan help cheyyam" instead of "ഞാൻ സഹായിക്കാം" or "I can help".';

            case 'english':
                return baseInstruction + '\n\nThe user wrote in English, so respond in clear, natural English.';

            default:
                return baseInstruction;
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
