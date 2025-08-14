/**
 * Language detection utility for multilingual chat responses
 * Supports English, Malayalam (both script and romanized), and explicit language requests
 */

export interface LanguageDetection {
    detectedLanguage: 'english' | 'malayalam' | 'malayalam_roman' | 'hindi' | 'hinglish' |
    'tamil' | 'tamil_roman' | 'telugu' | 'telugu_roman' | 'kannada' | 'kannada_roman' | 'mixed';
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

    // Tamil Unicode range
    private readonly tamilPattern = /[\u0B80-\u0BFF]/;

    // Telugu Unicode range
    private readonly teluguPattern = /[\u0C00-\u0C7F]/;

    // Kannada Unicode range
    private readonly kannadaPattern = /[\u0C80-\u0CFF]/;

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

    // Common Tamil words in Roman script
    private readonly tamilRomanWords = [
        // Question words
        'enna', 'enga', 'eppo', 'eppadi', 'yaaru', 'yen', 'ethuku', 'evvalavu',
        // Pronouns
        'naan', 'neenga', 'avan', 'aval', 'naanga', 'avanga', 'ivan', 'ival',
        // Common verbs
        'vara', 'poga', 'irukku', 'irukken', 'pannu', 'pannunga', 'solluu', 'sollunga',
        'paaru', 'paarunga', 'kelu', 'kelunga', 'sapadu', 'sapaduu',
        // Common words
        'vanakkam', 'nandri', 'mannichhu', 'sari', 'illa', 'irukku', 'aama', 'ille',
        // Document/information related
        'document', 'paper', 'puththagam', 'theriyum', 'therila', 'solluu', 'kaattu'
    ];

    // Common Telugu words in Roman script  
    private readonly teluguRomanWords = [
        // Question words
        'enti', 'ekkada', 'eppudu', 'ela', 'evaru', 'endhuku', 'entha',
        // Pronouns
        'nenu', 'miru', 'vadu', 'ame', 'manam', 'vaaru', 'idu', 'adi',
        // Common verbs
        'raavu', 'vellu', 'undhi', 'unnaanu', 'cheyyi', 'cheppandi', 'chudandi',
        'vinu', 'vinandi', 'thinu', 'thinandi', 'raayyi', 'chadivi',
        // Common words
        'namaskaram', 'dhanyavaadalu', 'kshaminchandi', 'sare', 'ledhu', 'undhi', 'avunu', 'kaaadu',
        // Document/information related
        'document', 'kaagitham', 'pustakam', 'thelusu', 'theleedhu', 'cheppandi', 'choopinchu'
    ];

    // Common Kannada words in Roman script
    private readonly kannadaRomanWords = [
        // Question words
        'yenu', 'elli', 'yaavaga', 'hege', 'yaaru', 'yake', 'eshtu',
        // Pronouns
        'naanu', 'neevu', 'avanu', 'aval', 'naavu', 'avaru', 'idu', 'adu',
        // Common verbs
        'baa', 'hogu', 'ide', 'idene', 'maadu', 'heli', 'helunga', 'nodu', 'nodunga',
        'kelu', 'kelunga', 'thinnu', 'thinnu', 'bari', 'odi',
        // Common words
        'namaskara', 'dhanyavaada', 'kshamisuu', 'sari', 'illa', 'ide', 'houdu', 'allla',
        // Document/information related
        'document', 'kagada', 'pustaka', 'gotthu', 'gottilla', 'heli', 'thoorisu'
    ];

    // Explicit language request patterns
    private readonly languageRequestPatterns = [
        /answer in (english|malayalam|hindi|tamil|telugu|kannada)/i,
        /reply in (english|malayalam|hindi|tamil|telugu|kannada)/i,
        /respond in (english|malayalam|hindi|tamil|telugu|kannada)/i,
        /(english|malayalam|hindi|tamil|telugu|kannada)(?:il|ile) answer/i,
        /(english|malayalam|hindi|tamil|telugu|kannada)(?:il|ile) reply/i,
        /answer.*(?:english|malayalam|hindi|tamil|telugu|kannada)/i,
        /reply.*(?:english|malayalam|hindi|tamil|telugu|kannada)/i
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

        // Check for Tamil script
        if (this.tamilPattern.test(text)) {
            return {
                detectedLanguage: 'tamil',
                confidence: 0.95,
                responseLanguage: 'tamil',
                responseInstructions: 'Respond in Tamil script (தமிழ்). Use proper Tamil grammar and vocabulary.'
            };
        }

        // Check for Telugu script
        if (this.teluguPattern.test(text)) {
            return {
                detectedLanguage: 'telugu',
                confidence: 0.95,
                responseLanguage: 'telugu',
                responseInstructions: 'Respond in Telugu script (తెలుగు). Use proper Telugu grammar and vocabulary.'
            };
        }

        // Check for Kannada script
        if (this.kannadaPattern.test(text)) {
            return {
                detectedLanguage: 'kannada',
                confidence: 0.95,
                responseLanguage: 'kannada',
                responseInstructions: 'Respond in Kannada script (ಕನ್ನಡ). Use proper Kannada grammar and vocabulary.'
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

        // Check for Tamil in Roman script (Tanglish)
        const tamilRomanScore = this.calculateTamilRomanScore(cleanText);
        console.log(`Tamil Roman Score for "${text}": ${tamilRomanScore}`);
        if (tamilRomanScore > 0.2) {
            return {
                detectedLanguage: 'tamil_roman',
                confidence: tamilRomanScore,
                responseLanguage: 'tamil_roman',
                responseInstructions: 'Respond in Tamil but using Roman/English letters (Tanglish). Use Tamil sentence structure and vocabulary but write in English alphabet.'
            };
        }

        // Check for Telugu in Roman script (Tenglish)
        const teluguRomanScore = this.calculateTeluguRomanScore(cleanText);
        console.log(`Telugu Roman Score for "${text}": ${teluguRomanScore}`);
        if (teluguRomanScore > 0.2) {
            return {
                detectedLanguage: 'telugu_roman',
                confidence: teluguRomanScore,
                responseLanguage: 'telugu_roman',
                responseInstructions: 'Respond in Telugu but using Roman/English letters (Tenglish). Use Telugu sentence structure and vocabulary but write in English alphabet.'
            };
        }

        // Check for Kannada in Roman script (Kanglish)
        const kannadaRomanScore = this.calculateKannadaRomanScore(cleanText);
        console.log(`Kannada Roman Score for "${text}": ${kannadaRomanScore}`);
        if (kannadaRomanScore > 0.2) {
            return {
                detectedLanguage: 'kannada_roman',
                confidence: kannadaRomanScore,
                responseLanguage: 'kannada_roman',
                responseInstructions: 'Respond in Kannada but using Roman/English letters (Kanglish). Use Kannada sentence structure and vocabulary but write in English alphabet.'
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

    private calculateTamilRomanScore(text: string): number {
        const words = text.split(/\s+/);
        const totalWords = words.length;

        if (totalWords === 0) return 0;

        let tamilWordCount = 0;

        // Check for exact matches with known Tamil words
        for (const word of words) {
            const cleanWord = word.replace(/[^\w]/g, ''); // Remove punctuation
            if (this.tamilRomanWords.includes(cleanWord)) {
                tamilWordCount++;
            }
        }

        // Check for Tamil-like patterns
        let patternScore = 0;
        for (const word of words) {
            // Tamil word patterns (double consonants, specific endings)
            if (word.includes('kk') || word.includes('ll') || word.includes('nn') ||
                word.includes('mm') || word.includes('pp') || word.includes('tt') ||
                word.includes('rr')) {
                patternScore += 0.1;
            }

            // Common Tamil endings
            if (word.endsWith('um') || word.endsWith('an') || word.endsWith('al') ||
                word.endsWith('nga') || word.endsWith('chu') || word.endsWith('ka') ||
                word.endsWith('tha') || word.endsWith('ra') || word.endsWith('iya')) {
                patternScore += 0.1;
            }
        }

        const exactMatchScore = tamilWordCount / totalWords;
        const normalizedPatternScore = Math.min(patternScore / totalWords, 0.3);

        return exactMatchScore + normalizedPatternScore;
    }

    private calculateTeluguRomanScore(text: string): number {
        const words = text.split(/\s+/);
        const totalWords = words.length;

        if (totalWords === 0) return 0;

        let teluguWordCount = 0;

        // Check for exact matches with known Telugu words
        for (const word of words) {
            const cleanWord = word.replace(/[^\w]/g, ''); // Remove punctuation
            if (this.teluguRomanWords.includes(cleanWord)) {
                teluguWordCount++;
            }
        }

        // Check for Telugu-like patterns
        let patternScore = 0;
        for (const word of words) {
            // Telugu word patterns
            if (word.includes('nnu') || word.includes('mmu') || word.includes('ppu') ||
                word.includes('ttu') || word.includes('kku') || word.includes('vvu')) {
                patternScore += 0.1;
            }

            // Common Telugu endings
            if (word.endsWith('andi') || word.endsWith('aaru') || word.endsWith('unu') ||
                word.endsWith('dhi') || word.endsWith('yi') || word.endsWith('lu') ||
                word.endsWith('avu') || word.endsWith('emu') || word.endsWith('ani')) {
                patternScore += 0.1;
            }
        }

        const exactMatchScore = teluguWordCount / totalWords;
        const normalizedPatternScore = Math.min(patternScore / totalWords, 0.3);

        return exactMatchScore + normalizedPatternScore;
    }

    private calculateKannadaRomanScore(text: string): number {
        const words = text.split(/\s+/);
        const totalWords = words.length;

        if (totalWords === 0) return 0;

        let kannadaWordCount = 0;

        // Check for exact matches with known Kannada words
        for (const word of words) {
            const cleanWord = word.replace(/[^\w]/g, ''); // Remove punctuation
            if (this.kannadaRomanWords.includes(cleanWord)) {
                kannadaWordCount++;
            }
        }

        // Check for Kannada-like patterns
        let patternScore = 0;
        for (const word of words) {
            // Kannada word patterns
            if (word.includes('ge') || word.includes('gu') || word.includes('du') ||
                word.includes('vu') || word.includes('ru') || word.includes('lu')) {
                patternScore += 0.1;
            }

            // Common Kannada endings
            if (word.endsWith('aga') || word.endsWith('anu') || word.endsWith('elu') ||
                word.endsWith('iru') || word.endsWith('udu') || word.endsWith('ade') ||
                word.endsWith('ide') || word.endsWith('ara') || word.endsWith('alli')) {
                patternScore += 0.1;
            }
        }

        const exactMatchScore = kannadaWordCount / totalWords;
        const normalizedPatternScore = Math.min(patternScore / totalWords, 0.3);

        return exactMatchScore + normalizedPatternScore;
    }

    private getLanguageInstructions(language: string): string {
        switch (language.toLowerCase()) {
            case 'malayalam':
                return 'Respond in Malayalam script (മലയാളം). Use proper Malayalam grammar and vocabulary.';
            case 'hindi':
                return 'Respond in Hindi script (हिन्दी). Use proper Hindi grammar and Devanagari script.';
            case 'tamil':
                return 'Respond in Tamil script (தமிழ்). Use proper Tamil grammar and script.';
            case 'telugu':
                return 'Respond in Telugu script (తెలుగు). Use proper Telugu grammar and script.';
            case 'kannada':
                return 'Respond in Kannada script (ಕನ್ನಡ). Use proper Kannada grammar and script.';
            case 'english':
                return 'Respond in clear, natural English.';
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

            case 'tamil':
                return baseInstruction + '\n\nThe user wrote in Tamil script, so maintain the same language and script in your response.';

            case 'tamil_roman':
                return baseInstruction + '\n\nThe user wrote Tamil words using Roman/English letters (Tanglish), so respond in the same style. For example: "Naan ungalukku help pannalam" instead of "நான் உங்களுக்கு உதவி செய்யலாம்" or "I can help you".';

            case 'telugu':
                return baseInstruction + '\n\nThe user wrote in Telugu script, so maintain the same language and script in your response.';

            case 'telugu_roman':
                return baseInstruction + '\n\nThe user wrote Telugu words using Roman/English letters (Tenglish), so respond in the same style. For example: "Nenu miku help cheyagalanu" instead of "నేను మీకు సహాయం చేయగలను" or "I can help you".';

            case 'kannada':
                return baseInstruction + '\n\nThe user wrote in Kannada script, so maintain the same language and script in your response.';

            case 'kannada_roman':
                return baseInstruction + '\n\nThe user wrote Kannada words using Roman/English letters (Kanglish), so respond in the same style. For example: "Naanu nimige help maadabahudhu" instead of "ನಾನು ನಿಮಗೆ ಸಹಾಯ ಮಾಡಬಹುದು" or "I can help you".';

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
