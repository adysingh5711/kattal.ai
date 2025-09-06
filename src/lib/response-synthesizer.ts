import { ChatOpenAI } from "@langchain/openai";
import { Document } from "langchain/document";
import { env } from "./env";
import { QueryAnalysis } from "./query-analyzer";
import { QueryExpansion } from "./query-expander";
import { extractJSONFromString, safeExtractJSON } from "./json-utils";
import { LanguageDetector } from "./language-detector";

const synthesisModel = new ChatOpenAI({
    modelName: env.LLM_MODEL,
    temperature: 0.1, // Lower temperature for faster, more consistent responses
    openAIApiKey: env.OPENAI_API_KEY,
    maxTokens: 400, // Limit response length for faster generation
    timeout: 8000, // 8 second timeout
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
        documents: Document[],
        queryExpansion?: QueryExpansion,
        previousResponse?: string
    ): Promise<ResponseSynthesis> {
        console.log(`🔄 Synthesizing human-like response for: "${query}"`);

        // Step 1: Analyze the evidence and build reasoning chain
        const reasoningSteps = await this.buildReasoningChain(query, queryAnalysis, documents);

        // Step 2: Determine appropriate response style
        const responseStyle = this.determineResponseStyle(queryAnalysis, documents);

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
        if (analysis.complexity < 3) {
            // Simple queries don't need complex reasoning chains
            return [{
                step: 1,
                question: query,
                evidence: documents.slice(0, 2).map(doc => doc.pageContent.slice(0, 200)),
                reasoning: "Direct answer from available evidence",
                conclusion: "Information found in source documents",
                confidence: 0.8
            }];
        }

        const reasoningPrompt = `Build a logical reasoning chain to answer this query using the provided evidence:

Query: "${query}"
Query Type: ${analysis.queryType}
Complexity: ${analysis.complexity}

Evidence from Documents:
${documents.slice(0, 5).map((doc, i) =>
            `Document ${i + 1}:\n${doc.pageContent.slice(0, 800)}...\n`
        ).join('\n')}

Create a step-by-step reasoning chain:
1. What sub-questions need to be answered?
2. What evidence supports each sub-answer?
3. How do the pieces connect logically?
4. What can we conclude with confidence?

Return as JSON array:
[
  {
    "step": 1,
    "question": "What is the first thing we need to establish?",
    "evidence": ["evidence piece 1", "evidence piece 2"],
    "reasoning": "Why this evidence leads to this conclusion",
    "conclusion": "What we can conclude from this step",
    "confidence": 0.8
  }
]

Build 2-4 logical steps that flow naturally from question to answer.`;

        try {
            const response = await synthesisModel.invoke(reasoningPrompt);
            const steps = extractJSONFromString(response.content as string);
            return Array.isArray(steps) ? steps : [];
        } catch (error) {
            console.warn('Reasoning chain generation failed:', error);
            return [];
        }
    }

    private determineResponseStyle(
        analysis: QueryAnalysis,
        documents: Document[]
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

        const synthesisPrompt = `Create an extremely concise, direct response that answers ONLY what was asked.

Query: "${query}"
Response Style: ${responseStyle}
Style Guidance: ${stylePrompts[responseStyle]}

Available Evidence:
${documents.slice(0, 4).map((doc, i) =>
            `Source ${i + 1} (${sourceAttributions[i]?.contentType || 'text'}): ${doc.pageContent.slice(0, 600)}...`
        ).join('\n\n')}

Reasoning Chain:
${reasoningSteps.map(step =>
            `Step ${step.step}: ${step.question}\nReasoning: ${step.reasoning}\nConclusion: ${step.conclusion}`
        ).join('\n\n')}

${languageInstructions}

EXTREME CONCISENESS REQUIREMENTS:

RESPONSE LENGTH:
- Simple questions: 1-2 sentences maximum
- Complex questions: 3-4 sentences maximum
- Only use multiple paragraphs if absolutely necessary
- Never exceed 5 sentences total

CONTENT RESTRICTIONS:
- Answer ONLY the specific question asked
- NO background information unless explicitly requested
- NO historical context unless essential to the answer
- NO explanations of terms unless they're the core of the question
- NO tangential information, even if related
- NO "interesting facts" or "additional context"

STRUCTURE:
- Start with the direct answer immediately
- Use bullet points only for multiple specific facts
- No introductory phrases like "Based on the evidence..." or "Looking at the data..."
- No concluding statements unless they directly answer the question

CORRELATION RULES:
- Only correlate information if it directly answers the question
- Don't explain connections unless they're the answer itself
- Avoid "This connects to..." or "This relates to..." unless it's the core answer

Remember: Be extremely brief. If the user asks "What is X?", just say what X is. Don't explain why X matters, how X was discovered, or what X relates to unless specifically asked.`;

        try {
            const response = await synthesisModel.invoke(synthesisPrompt);
            const content = response.content as string;

            // Validate that we got a proper response, not a generic greeting
            if (content.includes("Hello! How can I help") || content.includes("Hi") || content.length < 50) {
                console.warn('Received generic response, using fallback');
                return this.generateFallbackResponse(query, documents, analysis.languageDetection);
            }

            return content;
        } catch (error) {
            console.error('Response synthesis failed:', error);
            return this.generateFallbackResponse(query, documents, analysis.languageDetection);
        }
    }

    private generateFallbackResponse(query: string, documents: Document[], languageDetection?: any): string {
        if (documents.length === 0) {
            return `നിങ്ങളുടെ ചോദ്യത്തിന് ഉത്തരം നൽകാൻ എനിക്ക് പ്രത്യേക വിവരങ്ങൾ ഇല്ല: "${query}". ദയവായി നിങ്ങളുടെ ചോദ്യം വീണ്ടും ചോദിക്കുക അല്ലെങ്കിൽ ബന്ധപ്പെട്ട ഡോക്യുമെന്റുകൾ സിസ്റ്റത്തിൽ അപ്‌ലോഡ് ചെയ്തിട്ടുണ്ടോ എന്ന് പരിശോധിക്കുക.`;
        }

        // For simple queries like "hi", provide a helpful response in Malayalam
        const normalizedQuery = query.toLowerCase().trim();
        if (normalizedQuery === 'hi' || normalizedQuery === 'hello' || normalizedQuery === 'hey' ||
            normalizedQuery === 'namaste' || normalizedQuery === 'namaskar' || normalizedQuery === 'hai' || normalizedQuery === 'helo' ||
            normalizedQuery === 'vanakkam' || normalizedQuery === 'namaskaram' || normalizedQuery === 'namaskara') {

            // ALWAYS return Malayalam greeting regardless of input language
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
            let content = doc.pageContent
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
