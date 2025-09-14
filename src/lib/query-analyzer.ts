import { ChatOpenAI } from "@langchain/openai";
import { env } from "./env";
import { extractJSONFromString, safeExtractJSON } from "./json-utils";
import { LanguageDetector, LanguageDetection } from "./language-detector";

const analyzerModel = new ChatOpenAI({
    modelName: env.LLM_MODEL,
    temperature: 0.1, // Low temperature for consistent analysis
    openAIApiKey: env.OPENAI_API_KEY,
});

export interface QueryAnalysis {
    queryType: 'FACTUAL' | 'COMPARATIVE' | 'ANALYTICAL' | 'INFERENTIAL' | 'SYNTHETIC';
    complexity: number; // 1-5 scale
    keyEntities: string[];
    requiresCrossReference: boolean;
    dataTypesNeeded: string[];
    reasoningSteps: string[];
    suggestedK: number; // Number of documents to retrieve
    languageDetection: LanguageDetection; // Language information for response generation
}

export class QueryAnalyzer {
    private languageDetector = new LanguageDetector();

    async classifyQuery(query: string, chatHistory?: string): Promise<QueryAnalysis> {
        // First, detect the language of the query
        const languageDetection = this.languageDetector.detectLanguage(query);
        console.log(`🌐 Language Detection for "${query}":`, {
            detected: languageDetection.detectedLanguage,
            confidence: languageDetection.confidence,
            responseLanguage: languageDetection.responseLanguage
        });
        const analysisPrompt = `Analyze this user query and determine the type of reasoning and retrieval strategy needed.

User Query: "${query}"

${chatHistory ? `Previous Context:\n${chatHistory.slice(-500)}` : ''}

Classify the query and provide analysis in this JSON format:
{
  "queryType": "FACTUAL|COMPARATIVE|ANALYTICAL|INFERENTIAL|SYNTHETIC",
  "complexity": 1-5,
  "keyEntities": ["entity1", "entity2"],
  "requiresCrossReference": true/false,
  "dataTypesNeeded": ["text", "tables", "charts", "images"],
  "reasoningSteps": ["step1", "step2"],
  "suggestedK": 8-20
}

Query Types:
- FACTUAL: Simple fact lookup ("What is X?", "When did Y happen?")
- COMPARATIVE: Compare multiple items ("Compare X and Y", "What's the difference between...")  
- ANALYTICAL: Analyze trends/patterns ("What are the trends in...", "How has X changed over time?")
- INFERENTIAL: Draw conclusions from evidence ("Why did X happen?", "What caused Y?")
- SYNTHETIC: Combine information to create insights ("What are the implications of...", "How do X and Y relate to Z?")

Complexity Scale:
1: Simple factual lookup
2: Basic comparison or analysis
3: Multi-step reasoning required
4: Cross-document synthesis needed
5: Complex inferential reasoning across multiple sources

Consider:
- Does the query need information from multiple documents/sections?
- Does it require connecting scattered pieces of information?
- Are there implicit questions that need to be answered first?
- What type of evidence would best support the answer?

Respond ONLY with valid JSON.`;

        try {
            const response = await analyzerModel.invoke(analysisPrompt);
            const analysis = extractJSONFromString(response.content as string);

            // Validate and set defaults
            return {
                queryType: analysis.queryType || 'FACTUAL',
                complexity: Math.max(1, Math.min(5, analysis.complexity || 1)),
                keyEntities: analysis.keyEntities || [],
                requiresCrossReference: analysis.requiresCrossReference || false,
                dataTypesNeeded: analysis.dataTypesNeeded || ['text'],
                reasoningSteps: analysis.reasoningSteps || [],
                suggestedK: Math.max(6, Math.min(20, analysis.suggestedK || 10)), // Higher K for better reasoning
                languageDetection
            };
        } catch (error) {
            console.warn('Query analysis failed, using defaults:', error);
            // Fallback to safe defaults
            return {
                queryType: 'FACTUAL',
                complexity: 2,
                keyEntities: [],
                requiresCrossReference: false,
                dataTypesNeeded: ['text'],
                reasoningSteps: [],
                suggestedK: 10, // Higher default for better context
                languageDetection
            };
        }
    }

    async generateSubQueries(mainQuery: string, analysis: QueryAnalysis): Promise<string[]> {
        if (analysis.complexity <= 2) {
            return [mainQuery]; // Simple queries don't need sub-queries
        }

        const subQueryPrompt = `Break down this complex query into smaller, answerable sub-questions that will help build a comprehensive answer.

Main Query: "${mainQuery}"
Query Type: ${analysis.queryType}
Key Entities: ${analysis.keyEntities.join(', ')}

Generate 2-4 sub-questions that:
1. Address different aspects of the main question
2. Can be answered independently from the documents
3. Build logically toward answering the main query
4. Cover both direct facts and supporting context

Return as a JSON array of strings: ["sub-query 1", "sub-query 2", ...]

Examples:
Main: "Why did the project fail?" 
Sub: ["What were the project objectives?", "What challenges were encountered?", "What resources were available?", "What decisions led to problems?"]

Main: "Compare the performance of regions A and B"
Sub: ["What are the key metrics for region A?", "What are the key metrics for region B?", "What factors influenced each region's performance?"]

Respond ONLY with valid JSON array.`;

        try {
            const response = await analyzerModel.invoke(subQueryPrompt);
            const subQueries = extractJSONFromString(response.content as string);
            return Array.isArray(subQueries) ? subQueries : [mainQuery];
        } catch (error) {
            console.warn('Sub-query generation failed:', error);
            return [mainQuery];
        }
    }

    async identifyRequiredEvidence(query: string, analysis: QueryAnalysis): Promise<string[]> {
        const evidencePrompt = `Identify what types of evidence would be needed to answer this query comprehensively.

Query: "${query}"
Type: ${analysis.queryType}

List the specific types of evidence needed:
- Factual data (numbers, dates, names)
- Statistical information (percentages, trends, comparisons)
- Visual data (charts, graphs, diagrams)
- Procedural information (steps, processes, workflows)
- Contextual information (background, relationships, implications)

Return as JSON array: ["evidence type 1", "evidence type 2", ...]

Be specific about what evidence would make the answer more complete and credible.`;

        try {
            const response = await analyzerModel.invoke(evidencePrompt);
            const evidence = extractJSONFromString(response.content as string);
            return Array.isArray(evidence) ? evidence : [];
        } catch (error) {
            console.warn('Evidence identification failed:', error);
            return [];
        }
    }
}
