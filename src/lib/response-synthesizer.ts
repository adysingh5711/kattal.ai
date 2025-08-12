import { ChatOpenAI } from "@langchain/openai";
import { Document } from "langchain/document";
import { env } from "./env";
import { QueryAnalysis } from "./query-analyzer";
import { QueryExpansion } from "./query-expander";

const synthesisModel = new ChatOpenAI({
    modelName: "gpt-4o-mini",
    temperature: 0.3, // Balanced creativity for natural communication
    openAIApiKey: env.OPENAI_API_KEY,
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
            const steps = JSON.parse(response.content as string);
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
            analytical: "Provide a structured, analytical response that breaks down the information systematically.",
            explanatory: "Explain the information clearly and comprehensively, as if teaching someone new to the topic.",
            comparative: "Compare and contrast the different aspects, highlighting similarities and differences.",
            narrative: "Present the information as a coherent story that connects different pieces logically."
        };

        const synthesisPrompt = `Create a human-like response that sounds natural and conversational while being informative and accurate.

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

Create a response that:

HUMAN COMMUNICATION STYLE:
- Use natural, conversational language
- Include transitional phrases: "What's particularly interesting is...", "Based on the evidence...", "This suggests that..."
- Show your reasoning process: "Looking at the data...", "When we consider...", "This connects to..."
- Acknowledge uncertainty when appropriate: "The evidence suggests...", "While not explicitly stated..."
- Use analogies or examples when they help clarify complex concepts

STRUCTURE AND FLOW:
- Start with a direct answer when possible
- Explain your reasoning clearly
- Present evidence in a logical order
- Connect different pieces of information
- End with implications or broader context when relevant

EVIDENCE INTEGRATION:
- Weave evidence naturally into the narrative
- Reference specific data points, statistics, or findings
- Mention when information comes from tables, charts, or visual analysis
- Be specific about sources when citing important claims

TONE AND ENGAGEMENT:
- Be enthusiastic about interesting findings
- Show genuine curiosity about the topic
- Use inclusive language ("we can see that...", "this helps us understand...")
- Balance confidence with appropriate humility

Remember: Sound like a knowledgeable human expert who is genuinely interested in helping and sharing insights, not like a formal AI system.`;

        try {
            const response = await synthesisModel.invoke(synthesisPrompt);
            return response.content as string;
        } catch (error) {
            console.error('Response synthesis failed:', error);
            return this.generateFallbackResponse(query, documents);
        }
    }

    private generateFallbackResponse(query: string, documents: Document[]): string {
        const evidence = documents.slice(0, 2).map(doc => doc.pageContent.slice(0, 300)).join('\n\n');
        return `Based on the available information, I can provide some insights about your question: "${query}"\n\n${evidence}\n\nI've found relevant information in the documents that addresses your query. The evidence suggests several key points that help answer your question.`;
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
