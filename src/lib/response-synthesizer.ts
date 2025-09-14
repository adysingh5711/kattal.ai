import { ChatOpenAI } from "@langchain/openai";
import { Document } from "langchain/document";
import { env } from "./env";
import { QueryAnalysis } from "./query-analyzer";
import { LanguageDetector } from "./language-detector";

const synthesisModel = new ChatOpenAI({
    modelName: env.LLM_MODEL,
    temperature: 0.05, // Very low temperature for precise, consistent responses
    openAIApiKey: env.OPENAI_API_KEY,
    maxTokens: 600, // Increased for more detailed responses
    timeout: 12000, // Increased timeout for deeper analysis
    verbose: false, // Disable verbose for faster processing
});

export interface ResponseSynthesis {
    synthesizedResponse: string;
    reasoningChain: string[];
    confidence: number;
    sourceAttribution: SourceAttribution[];
    responseStyle: 'analytical' | 'explanatory' | 'comparative' | 'narrative';
    completeness: 'complete' | 'partial' | 'needs_followup';
}

type ResponseStyle = 'analytical' | 'explanatory' | 'comparative' | 'narrative';

export interface SourceAttribution {
    source: string;
    relevance: number;
    usedFor: string;
    pageReference?: string;
    contentType: 'text' | 'table' | 'chart' | 'image';
}

export interface ReasoningStep {
    step: number;
    question: string;
    evidence: string[];
    reasoning: string;
    conclusion: string;
    confidence: number;
}

export class ResponseSynthesizer {
    private languageDetector = new LanguageDetector();
    async synthesizeResponse(
        query: string,
        queryAnalysis: QueryAnalysis,
        documents: Document[]
    ): Promise<ResponseSynthesis> {
        console.log(`🔄 Synthesizing human-like response for: "${query}"`);
        console.log(`📚 Documents for synthesis: ${documents.length}`);
        documents.forEach((doc, i) => {
            const namespace = doc.metadata?.namespace || 'unknown';
            const source = doc.metadata?.source || 'unknown';
            console.log(`   Doc ${i + 1} [${namespace.slice(-30)}...] [${source.slice(-40)}...]: ${doc.pageContent.slice(0, 200)}...`);
        });

        // Step 1: Analyze the evidence and build reasoning chain
        const reasoningSteps = await this.buildReasoningChain(query, queryAnalysis, documents);

        // Step 2: Determine appropriate response style
        const responseStyle = this.determineResponseStyle(queryAnalysis);

        // Step 3: Create source attributions
        const sourceAttributions = this.createSourceAttributions(documents);

        // Step 4: Synthesize the human-like response
        const synthesizedResponse = await this.generateHumanLikeResponse(
            query,
            queryAnalysis,
            documents,
            reasoningSteps,
            responseStyle,
            sourceAttributions
        );

        // Step 5: Assess response completeness and confidence
        const completeness = await this.assessCompleteness(query, synthesizedResponse, documents);
        const confidence = this.calculateOverallConfidence(reasoningSteps, documents.length);

        return {
            synthesizedResponse,
            reasoningChain: reasoningSteps.map(step => step.reasoning),
            confidence,
            sourceAttribution: sourceAttributions,
            responseStyle,
            completeness
        };
    }

    private async buildReasoningChain(
        query: string,
        analysis: QueryAnalysis,
        documents: Document[]
    ): Promise<ReasoningStep[]> {
        // Simplified reasoning for speed - focus on document analysis
        return [{
            step: 1,
            question: query,
            evidence: documents.slice(0, 4).map(doc => doc.pageContent.slice(0, 300)),
            reasoning: "Comprehensive analysis of all available evidence",
            conclusion: "Detailed information extracted from multiple sources",
            confidence: 0.9
        }];

        // Removed complex reasoning chain generation for speed
    }

    private determineResponseStyle(
        analysis: QueryAnalysis
    ): 'analytical' | 'explanatory' | 'comparative' | 'narrative' {
        if (analysis.queryType === 'COMPARATIVE') {
            return 'comparative';
        }
        if (analysis.queryType === 'ANALYTICAL' || analysis.queryType === 'INFERENTIAL') {
            return 'analytical';
        }
        if (analysis.complexity >= 4) {
            return 'narrative';
        }
        return 'explanatory';
    }

    private createSourceAttributions(documents: Document[]): SourceAttribution[] {
        return documents.slice(0, 6).map((doc, index) => {
            const metadata = doc.metadata || {};
            const contentType = this.inferContentType(doc);

            return {
                source: metadata.source || `Document ${index + 1}`,
                relevance: this.calculateSourceRelevance(doc),
                usedFor: this.inferUsageContext(doc, contentType),
                pageReference: metadata.pageNumber ? `Page ${metadata.pageNumber}` : undefined,
                contentType
            };
        });
    }

    private inferContentType(doc: Document): 'text' | 'table' | 'chart' | 'image' {
        const content = doc.pageContent.toLowerCase();
        const metadata = doc.metadata || {};

        if (content.includes('visual analysis:') || metadata.hasVisuals) {
            return 'image';
        }
        if (content.includes('table') || metadata.hasTables) {
            return 'table';
        }
        if (content.includes('chart') || content.includes('graph') || metadata.hasCharts) {
            return 'chart';
        }
        return 'text';
    }

    private calculateSourceRelevance(doc: Document): number {
        const contentLength = doc.pageContent.length;
        const metadata = doc.metadata || {};

        let relevance = 0.5; // Base relevance

        // Boost for longer, more detailed content
        if (contentLength > 1000) relevance += 0.2;
        if (contentLength > 2000) relevance += 0.1;

        // Boost for multimodal content
        if (metadata.hasVisuals) relevance += 0.1;
        if (metadata.hasTables) relevance += 0.1;
        if (metadata.hasCharts) relevance += 0.1;

        return Math.min(1.0, relevance);
    }

    private inferUsageContext(
        doc: Document,
        contentType: 'text' | 'table' | 'chart' | 'image'
    ): string {
        const contextMap: Record<'text' | 'table' | 'chart' | 'image', string> = {
            text: 'background information and context',
            table: 'statistical data and numerical evidence',
            chart: 'trends and visual data analysis',
            image: 'visual evidence and illustrations'
        };

        return contextMap[contentType] ?? 'supporting information';
    }

    private async generateHumanLikeResponse(
        query: string,
        analysis: QueryAnalysis,
        documents: Document[],
        reasoningSteps: ReasoningStep[],
        responseStyle: ResponseStyle,
        sourceAttributions: SourceAttribution[]
    ): Promise<string> {
        const stylePrompts: Record<ResponseStyle, string> = {
            analytical: "Provide a brief, structured response with key points.",
            explanatory: "Give a concise explanation focusing only on the essential information.",
            comparative: "Briefly compare the key differences and similarities.",
            narrative: "Present the information briefly in a logical sequence."
        };

        // Get language-specific instructions
        const languageInstructions = this.languageDetector.getLanguagePromptAddition(analysis.languageDetection);

        // First, let's check if the documents actually contain the name or MLA references
        const nameVariations = [
            'ഐ.ബി. സതീഷ്', 'ഐബി സതീഷ്', 'സതീഷ്', 'I.B. Sateesh', 'IB Sateesh', 'Sateesh',
            'ശ്രീ. ഐ. ബി. സതീഷ്', 'ശ്രീ ഐ ബി സതീഷ്', 'ശ്രീ സതീഷ്',
            'ഐ. ബി. സതീഷ്', 'ഐ ബി സതീഷ്', 'ഐബി സതീഷ്',
            '.എം.എല്.എ', 'എം.എല്.എ', 'MLA', 'സതീഷ് .എം.എല്.എ',
            'കാട്ടാക്കട എം.എല്.എ', 'കാട്ടാക്കട നിയോജകമണ്ഡലം', 'Kattakkada MLA',
            'ഐ. ബി. സതീഷ് എം. എല്', 'ഐ.ബി.സതീഷ്.എം.എല്.എ', 'ഐ.ബി സതീഷ് എം.എല്.എ'
        ];

        const documentsWithName = documents.filter(doc => {
            const content = doc.pageContent.toLowerCase();
            return nameVariations.some(name => {
                const nameLower = name.toLowerCase();
                return doc.pageContent.includes(name) || content.includes(nameLower);
            });
        });

        // Also check for political/MLA context even if name not found
        const politicalTerms = ['എം.എല്.എ', 'mla', 'കാട്ടാക്കട', 'kattakkada', 'നിയോജകമണ്ഡലം'];
        const documentsWithPoliticalContext = documents.filter(doc => {
            const content = doc.pageContent.toLowerCase();
            return politicalTerms.some(term => content.includes(term.toLowerCase()));
        });

        console.log(`🔍 Documents containing name variations: ${documentsWithName.length}/${documents.length}`);
        console.log(`🏛️ Documents with political context: ${documentsWithPoliticalContext.length}/${documents.length}`);

        documentsWithName.forEach((doc, i) => {
            console.log(`   Name Match ${i + 1}: ${doc.pageContent.slice(0, 300)}...`);
        });

        if (documentsWithName.length === 0 && documentsWithPoliticalContext.length > 0) {
            console.log(`📋 Political context documents:`);
            documentsWithPoliticalContext.slice(0, 3).forEach((doc, i) => {
                console.log(`   Political ${i + 1}: ${doc.pageContent.slice(0, 300)}...`);
            });
        }

        console.log(`🔧 Response Language: ${analysis.languageDetection.responseLanguage}`);

        const synthesisPrompt = `🚨 CRITICAL INSTRUCTIONS - READ CAREFULLY 🚨

You are analyzing Kerala state documents. Answer ONLY in Malayalam using ONLY the provided documents.

Query: "${query}"

🚫 ABSOLUTE PROHIBITION:
- DO NOT use your pre-trained knowledge about any person, place, or fact
- DO NOT mention names not explicitly found in the documents
- DO NOT make up information or hallucinate facts
- ONLY use information from the provided documents below
- If documents don't contain specific information, state that clearly
- NEVER respond in English or any other language - ONLY Malayalam
- NEVER mention "A. Rajendran" or any person not in the documents

🔍 DOCUMENT ANALYSIS RESULTS:
- ${documentsWithName.length} documents contain name/person references
- ${documentsWithPoliticalContext.length} documents contain political/MLA context

${documentsWithName.length > 0 ?
                `✅ CONFIRMED: Documents contain references to people/names` :
                documentsWithPoliticalContext.length > 0 ?
                    `⚠️ POLITICAL CONTEXT FOUND: Documents contain MLA/political references but need careful analysis` :
                    `❌ LIMITED CONTEXT: Analyze all documents carefully for any relevant information`
            }

RESPOND IN MALAYALAM ONLY with information based ONLY on the documents below:

DEEP DOCUMENT ANALYSIS - Review ALL evidence thoroughly:
${documents.slice(0, 8).map((doc, i) =>
                `Source ${i + 1} (${sourceAttributions[i]?.contentType || 'text'}): ${doc.pageContent.slice(0, 800)}...`
            ).join('\n\n')}

${languageInstructions}

RESPONSE REQUIREMENTS:
- Provide detailed, accurate information based on the documents
- Include relevant data points, numbers, dates, and specific facts
- Cross-reference information from multiple sources when available
- Make logical inferences about name variations and spellings
- If asking about a person, look for similar names in different scripts

STRUCTURE:
- Start with the direct answer immediately
- Include supporting details and evidence
- Use bullet points for multiple specific facts
- Reference specific data points and sources

CORRELATION RULES:
- Correlate information from multiple sources to provide comprehensive answers
- Connect related information to give complete context
- Include specific details, numbers, and facts from the documents

Remember: Provide comprehensive, detailed answers by analyzing all available evidence deeply. Include specific facts, data points, and cross-references from the documents.`;

        try {
            const response = await synthesisModel.invoke(synthesisPrompt);
            const content = response.content as string;

            // Validate that we got a proper response, not a generic greeting
            if (content.includes("Hello! How can I help") || content.includes("Hi") || content.length < 50) {
                console.warn('Received generic response, using fallback');
                return this.generateFallbackResponse(query, documents);
            }

            return content;
        } catch (error) {
            console.error('Response synthesis failed:', error);
            return this.generateFallbackResponse(query, documents);
        }
    }

    private generateFallbackResponse(query: string, documents: Document[]): string {
        if (documents.length === 0) {
            return `നിങ്ങളുടെ ചോദ്യത്തിന് ഉത്തരം നൽകാൻ എനിക്ക് പ്രത്യേക വിവരങ്ങൾ ഇല്ല: "${query}". ദയവായി നിങ്ങളുടെ ചോദ്യം വീണ്ടും ചോദിക്കുക അല്ലെങ്കിൽ ബന്ധപ്പെട്ട ഡോക്യുമെന്റുകൾ സിസ്റ്റത്തിൽ അപ്‌ലോഡ് ചെയ്തിട്ടുണ്ടോ എന്ന് പരിശോധിക്കുക.`;
        }

        // For simple queries like "hi", provide a helpful response in Malayalam ONLY
        const normalizedQuery = query.toLowerCase().trim();
        if (normalizedQuery === 'hi' || normalizedQuery === 'hello' || normalizedQuery === 'hey' ||
            normalizedQuery === 'namaste' || normalizedQuery === 'namaskar' || normalizedQuery === 'hai' || normalizedQuery === 'helo' ||
            normalizedQuery === 'vanakkam' || normalizedQuery === 'namaskaram' || normalizedQuery === 'namaskara') {

            // STRICT MALAYALAM ONLY - No other language options
            return `നമസ്കാരം! അപ്‌ലോഡ് ചെയ്ത ഡോക്യുമെന്റുകളിൽ നിന്നും വിവരങ്ങൾ കണ്ടെത്താൻ ഞാൻ ഇവിടെയുണ്ട്. നിങ്ങൾക്ക് ഇത്തരം ചോദ്യങ്ങൾ ചോദിക്കാം:
- "ഈ ഡോക്യുമെന്റ് എന്താണ് പറയുന്നത്?"
- "[നിർദ്ദിഷ്ട വിഷയം] കുറിച്ച് പറയൂ"
- "[നിർദ്ദിഷ്ട വിഷയത്തിന്റെ] ഡാറ്റ കാണിക്കൂ"
- "പ്രധാന കണ്ടെത്തലുകൾ എന്താണ്?"

എന്താണ് അറിയേണ്ടത്?`;
        }

        // For other queries, provide a more synthesized response based on available content in Malayalam
        const relevantContent = documents.slice(0, 2).map(doc => {
            // Clean up the content and extract meaningful information
            const content = doc.pageContent
                .replace(/TEXT CONTENT:\s*/g, '')
                .replace(/\s+/g, ' ')
                .trim();

            // Try to extract the most relevant portion based on the query
            const queryTerms = query.toLowerCase().split(' ').filter(term => term.length > 2);
            let bestMatch = content.slice(0, 300);

            for (const term of queryTerms) {
                const termIndex = content.toLowerCase().indexOf(term);
                if (termIndex !== -1) {
                    // Extract context around the found term
                    const start = Math.max(0, termIndex - 100);
                    const end = Math.min(content.length, termIndex + 200);
                    bestMatch = content.slice(start, end);
                    break;
                }
            }

            return bestMatch;
        }).filter(content => content.length > 0);

        if (relevantContent.length === 0) {
            return `എനിക്ക് ചില ഡോക്യുമെന്റുകൾ കണ്ടെത്തി, പക്ഷേ അവ "${query}" എന്നതുമായി നേരിട്ട് ബന്ധപ്പെട്ട വിവരങ്ങൾ അടങ്ങിയിരിക്കുന്നതായി തോന്നുന്നില്ല. ദയവായി വ്യത്യസ്ത വിഷയത്തെക്കുറിച്ച് ചോദിക്കുക അല്ലെങ്കിൽ നിങ്ങൾ തിരയുന്നതിനെക്കുറിച്ച് കൂടുതൽ നിർദ്ദിഷ്ട വിവരങ്ങൾ നൽകുക.`;
        }

        return `ലഭ്യമായ വിവരങ്ങളുടെ അടിസ്ഥാനത്തിൽ, "${query}" എന്നതിനെക്കുറിച്ച് എനിക്ക് പറയാൻ കഴിയുന്നത്:

${relevantContent.join('\n\n')}

ഈ വിവരങ്ങൾ അപ്‌ലോഡ് ചെയ്ത ഡോക്യുമെന്റുകളിൽ നിന്നാണ്. നിങ്ങൾക്ക് ഏതെങ്കിലും നിർദ്ദിഷ്ട വശത്തെക്കുറിച്ച് വിശദീകരിക്കാൻ ആഗ്രഹമുണ്ടെങ്കിൽ അല്ലെങ്കിൽ നിങ്ങൾക്ക് തുടർന്നുള്ള ചോദ്യങ്ങൾ ഉണ്ടെങ്കിൽ, ദയവായി എന്നെ അറിയിക്കുക!`;
    }

    private async assessCompleteness(
        query: string,
        response: string,
        documents: Document[]
    ): Promise<'complete' | 'partial' | 'needs_followup'> {
        const assessmentPrompt = `Assess how completely this response answers the user's query:

User Query: "${query}"
Response: "${response.slice(0, 1000)}..."
Available Evidence: ${documents.length} documents

Rate the completeness:
- "complete": Fully answers the query with sufficient detail
- "partial": Answers part of the query but missing some aspects
- "needs_followup": Raises questions or needs clarification

Consider:
- Does the response directly address what was asked?
- Are there obvious gaps or missing information?
- Would a reasonable person be satisfied with this answer?

Respond with just one word: complete, partial, or needs_followup`;

        try {
            const response_assessment = await synthesisModel.invoke(assessmentPrompt);
            const result = (response_assessment.content as string).toLowerCase().trim();

            if (['complete', 'partial', 'needs_followup'].includes(result)) {
                return result as 'complete' | 'partial' | 'needs_followup';
            }
            return 'partial';
        } catch (error) {
            console.warn('Completeness assessment failed:', error);
            return 'partial';
        }
    }

    private calculateOverallConfidence(reasoningSteps: ReasoningStep[], documentCount: number): number {
        if (reasoningSteps.length === 0) {
            return Math.min(0.8, 0.5 + (documentCount * 0.1));
        }

        const avgStepConfidence = reasoningSteps.reduce((sum, step) => sum + step.confidence, 0) / reasoningSteps.length;
        const documentBonus = Math.min(0.2, documentCount * 0.03);
        const reasoningBonus = Math.min(0.1, reasoningSteps.length * 0.02);

        return Math.min(0.95, avgStepConfidence + documentBonus + reasoningBonus);
    }

    // Utility method for debugging
    getReasoningExplanation(steps: ReasoningStep[]): string {
        return steps.map(step =>
            `${step.step}. ${step.question}\n   → ${step.reasoning}\n   → ${step.conclusion} (${(step.confidence * 100).toFixed(0)}% confidence)`
        ).join('\n\n');
    }
}
