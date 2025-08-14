import { ChatOpenAI } from "@langchain/openai";
import { Document } from "langchain/document";
import { env } from "./env";
import { ResponseSynthesis, SourceAttribution } from "./response-synthesizer";
import { QueryAnalysis } from "./query-analyzer";
import { extractJSONFromString } from "./json-utils";

const validatorModel = new ChatOpenAI({
    modelName: env.LLM_MODEL,
    temperature: 0.1, // Low temperature for consistent validation
    openAIApiKey: env.OPENAI_API_KEY,
});

export interface ValidationResult {
    overallScore: number; // 0-1 scale
    factualAccuracy: number;
    completeness: number;
    coherence: number;
    sourceReliability: number;
    responseQuality: number;
    issues: ValidationIssue[];
    improvements: string[];
    confidence: number;
}

export interface ValidationIssue {
    type: 'factual_error' | 'missing_info' | 'coherence_issue' | 'source_problem' | 'tone_issue';
    severity: 'low' | 'medium' | 'high';
    description: string;
    suggestion: string;
    affectedSection?: string;
}

export interface QualityMetrics {
    responseLength: number;
    sourcesCited: number;
    evidenceStrength: number;
    logicalFlow: number;
    languageQuality: number;
    userSatisfactionPrediction: number;
}

export class QualityValidator {
    private qualityHistory: Map<string, ValidationResult[]> = new Map();
    private improvementPatterns: Map<string, number> = new Map();

    async validateResponse(
        query: string,
        queryAnalysis: QueryAnalysis,
        synthesis: ResponseSynthesis,
        sourceDocuments: Document[]
    ): Promise<ValidationResult> {
        console.log(`🔍 Validating response quality for: "${query.slice(0, 50)}..."`);

        // Parallel validation of different aspects
        const [
            factualAccuracy,
            completeness,
            coherence,
            sourceReliability,
            responseQuality
        ] = await Promise.all([
            this.validateFactualAccuracy(synthesis.synthesizedResponse, sourceDocuments),
            this.validateCompleteness(query, synthesis.synthesizedResponse, queryAnalysis),
            this.validateCoherence(synthesis.synthesizedResponse, synthesis.reasoningChain),
            this.validateSourceReliability(synthesis.sourceAttribution, sourceDocuments),
            this.validateResponseQuality(synthesis.synthesizedResponse, queryAnalysis.queryType)
        ]);

        // Identify specific issues
        const issues = await this.identifyIssues(query, synthesis, sourceDocuments);

        // Generate improvement suggestions
        const improvements = await this.generateImprovements(synthesis, issues);

        // Calculate overall score
        const overallScore = this.calculateOverallScore({
            factualAccuracy,
            completeness,
            coherence,
            sourceReliability,
            responseQuality
        });

        const validationResult: ValidationResult = {
            overallScore,
            factualAccuracy,
            completeness,
            coherence,
            sourceReliability,
            responseQuality,
            issues,
            improvements,
            confidence: synthesis.confidence
        };

        // Store for pattern analysis
        this.storeValidationHistory(query, validationResult);

        console.log(`✅ Validation complete. Overall score: ${(overallScore * 100).toFixed(1)}%`);
        return validationResult;
    }

    private async validateFactualAccuracy(response: string, sourceDocuments: Document[]): Promise<number> {
        const factCheckPrompt = `Check the factual accuracy of this response against the source documents:

Response to check:
"${response.slice(0, 1500)}..."

Source Documents:
${sourceDocuments.slice(0, 3).map((doc, i) =>
            `Source ${i + 1}:\n${doc.pageContent.slice(0, 800)}...\n`
        ).join('\n')}

Rate factual accuracy (0.0-1.0) based on:
1. Are all factual claims supported by the sources?
2. Are numbers, dates, and statistics accurate?
3. Are there any contradictions with the source material?
4. Are interpretations reasonable given the evidence?

Respond with just a number between 0.0 and 1.0 (e.g., 0.85)`;

        try {
            const response_check = await validatorModel.invoke(factCheckPrompt);
            const score = parseFloat((response_check.content as string).trim());
            return isNaN(score) ? 0.7 : Math.max(0, Math.min(1, score));
        } catch (error) {
            console.warn('Factual accuracy validation failed:', error);
            return 0.7; // Default moderate score
        }
    }

    private async validateCompleteness(query: string, response: string, analysis: QueryAnalysis): Promise<number> {
        const completenessPrompt = `Rate how completely this response answers the user's query:

User Query: "${query}"
Query Type: ${analysis.queryType}
Query Complexity: ${analysis.complexity}

Response:
"${response.slice(0, 1500)}..."

Rate completeness (0.0-1.0) based on:
1. Does it directly address what was asked?
2. Are all parts of multi-part questions answered?
3. Is the level of detail appropriate for the complexity?
4. Would a reasonable person be satisfied?

For ${analysis.queryType} queries with complexity ${analysis.complexity}, consider:
- FACTUAL: Are the facts provided?
- COMPARATIVE: Are comparisons clear and complete?
- ANALYTICAL: Is the analysis thorough?
- INFERENTIAL: Are conclusions well-supported?
- SYNTHETIC: Is the synthesis comprehensive?

Respond with just a number between 0.0 and 1.0 (e.g., 0.82)`;

        try {
            const completeness_check = await validatorModel.invoke(completenessPrompt);
            const score = parseFloat((completeness_check.content as string).trim());
            return isNaN(score) ? 0.7 : Math.max(0, Math.min(1, score));
        } catch (error) {
            console.warn('Completeness validation failed:', error);
            return 0.7;
        }
    }

    private async validateCoherence(response: string, reasoningChain: string[]): Promise<number> {
        const coherencePrompt = `Rate the logical coherence and flow of this response:

Response:
"${response.slice(0, 1500)}..."

Reasoning Chain:
${reasoningChain.slice(0, 3).join('\n')}

Rate coherence (0.0-1.0) based on:
1. Does the response flow logically from point to point?
2. Are transitions smooth and natural?
3. Do conclusions follow from the evidence presented?
4. Is the overall structure clear and organized?
5. Does the reasoning chain support the final response?

Respond with just a number between 0.0 and 1.0 (e.g., 0.88)`;

        try {
            const coherence_check = await validatorModel.invoke(coherencePrompt);
            const score = parseFloat((coherence_check.content as string).trim());
            return isNaN(score) ? 0.8 : Math.max(0, Math.min(1, score));
        } catch (error) {
            console.warn('Coherence validation failed:', error);
            return 0.8;
        }
    }

    private async validateSourceReliability(
        sourceAttributions: SourceAttribution[],
        sourceDocuments: Document[]
    ): Promise<number> {
        if (sourceAttributions.length === 0) return 0.5;

        // Calculate based on source diversity and relevance
        const diversityScore = this.calculateSourceDiversity(sourceAttributions);
        const relevanceScore = sourceAttributions.reduce((sum, attr) => sum + attr.relevance, 0) / sourceAttributions.length;
        const coverageScore = Math.min(1.0, sourceAttributions.length / 4); // Ideal: 4+ sources

        return (diversityScore * 0.3 + relevanceScore * 0.5 + coverageScore * 0.2);
    }

    private calculateSourceDiversity(attributions: SourceAttribution[]): number {
        const contentTypes = new Set(attributions.map(attr => attr.contentType));
        const sources = new Set(attributions.map(attr => attr.source));

        const typeScore = Math.min(1.0, contentTypes.size / 3); // text, table, chart/image
        const sourceScore = Math.min(1.0, sources.size / 3); // Multiple documents

        return (typeScore + sourceScore) / 2;
    }

    private async validateResponseQuality(response: string, queryType: string): Promise<number> {
        const qualityPrompt = `Rate the overall quality of this response:

Response:
"${response.slice(0, 1500)}..."

Query Type: ${queryType}

Rate quality (0.0-1.0) based on:
1. Language clarity and readability
2. Professional yet conversational tone
3. Appropriate level of detail
4. Engaging and helpful presentation
5. Natural human-like communication
6. Proper use of formatting and structure

Consider if this sounds like a knowledgeable human expert rather than a robotic AI.

Respond with just a number between 0.0 and 1.0 (e.g., 0.91)`;

        try {
            const quality_check = await validatorModel.invoke(qualityPrompt);
            const score = parseFloat((quality_check.content as string).trim());
            return isNaN(score) ? 0.8 : Math.max(0, Math.min(1, score));
        } catch (error) {
            console.warn('Response quality validation failed:', error);
            return 0.8;
        }
    }

    private async identifyIssues(
        query: string,
        synthesis: ResponseSynthesis,
        sourceDocuments: Document[]
    ): Promise<ValidationIssue[]> {
        const issuePrompt = `Identify specific issues with this response:

Query: "${query}"
Response: "${synthesis.synthesizedResponse.slice(0, 1200)}..."

Identify issues and return as JSON array:
[
  {
    "type": "factual_error|missing_info|coherence_issue|source_problem|tone_issue",
    "severity": "low|medium|high",
    "description": "What is the specific issue?",
    "suggestion": "How to fix it?",
    "affectedSection": "Which part of the response?"
  }
]

Look for:
- Factual errors or unsupported claims
- Missing important information
- Logical inconsistencies
- Poor source usage
- Inappropriate tone or style

If no significant issues, return empty array: []`;

        try {
            const issues_response = await validatorModel.invoke(issuePrompt);
            const issues = extractJSONFromString(issues_response.content as string);
            return Array.isArray(issues) ? issues : [];
        } catch (error) {
            console.warn('Issue identification failed:', error);
            return [];
        }
    }

    private async generateImprovements(
        synthesis: ResponseSynthesis,
        issues: ValidationIssue[]
    ): Promise<string[]> {
        if (issues.length === 0 && synthesis.confidence > 0.8) {
            return ['Response quality is good - no major improvements needed'];
        }

        const improvementPrompt = `Based on these issues and the response quality, suggest specific improvements:

Issues Found:
${issues.map(issue => `- ${issue.type}: ${issue.description}`).join('\n')}

Response Confidence: ${(synthesis.confidence * 100).toFixed(1)}%
Completeness: ${synthesis.completeness}

Suggest 2-4 specific, actionable improvements:

Return as JSON array: ["improvement 1", "improvement 2", ...]`;

        try {
            const improvements_response = await validatorModel.invoke(improvementPrompt);
            const improvements = extractJSONFromString(improvements_response.content as string);
            return Array.isArray(improvements) ? improvements : [];
        } catch (error) {
            console.warn('Improvement generation failed:', error);
            return ['Consider adding more specific examples', 'Verify all factual claims against sources'];
        }
    }

    private calculateOverallScore(scores: {
        factualAccuracy: number;
        completeness: number;
        coherence: number;
        sourceReliability: number;
        responseQuality: number;
    }): number {
        // Weighted average with emphasis on accuracy and completeness
        const weights = {
            factualAccuracy: 0.25,
            completeness: 0.25,
            coherence: 0.20,
            sourceReliability: 0.15,
            responseQuality: 0.15
        };

        return (
            scores.factualAccuracy * weights.factualAccuracy +
            scores.completeness * weights.completeness +
            scores.coherence * weights.coherence +
            scores.sourceReliability * weights.sourceReliability +
            scores.responseQuality * weights.responseQuality
        );
    }

    private storeValidationHistory(query: string, result: ValidationResult): void {
        const queryType = this.categorizeQuery(query);

        if (!this.qualityHistory.has(queryType)) {
            this.qualityHistory.set(queryType, []);
        }

        const history = this.qualityHistory.get(queryType)!;
        history.push(result);

        // Keep only recent history (last 50 validations per query type)
        if (history.length > 50) {
            history.splice(0, history.length - 50);
        }

        // Update improvement patterns
        this.updateImprovementPatterns(result);
    }

    private categorizeQuery(query: string): string {
        const queryLower = query.toLowerCase();

        if (queryLower.includes('compare') || queryLower.includes('vs')) return 'comparative';
        if (queryLower.includes('why') || queryLower.includes('how')) return 'analytical';
        if (queryLower.includes('what') || queryLower.includes('who')) return 'factual';

        return 'general';
    }

    private updateImprovementPatterns(result: ValidationResult): void {
        result.issues.forEach(issue => {
            const key = `${issue.type}_${issue.severity}`;
            const current = this.improvementPatterns.get(key) || 0;
            this.improvementPatterns.set(key, current + 1);
        });
    }

    // Analytics methods
    getQualityTrends(queryType?: string): any {
        if (queryType) {
            const history = this.qualityHistory.get(queryType) || [];
            return this.calculateTrends(history);
        }

        const allResults: ValidationResult[] = [];
        for (const results of this.qualityHistory.values()) {
            allResults.push(...results);
        }

        return this.calculateTrends(allResults);
    }

    private calculateTrends(results: ValidationResult[]): any {
        if (results.length === 0) {
            return { avgScore: 0, trend: 'no_data', recentImprovement: false };
        }

        const recent = results.slice(-10);
        const older = results.slice(-20, -10);

        const recentAvg = recent.reduce((sum, r) => sum + r.overallScore, 0) / recent.length;
        const olderAvg = older.length > 0
            ? older.reduce((sum, r) => sum + r.overallScore, 0) / older.length
            : recentAvg;

        return {
            avgScore: recentAvg,
            trend: recentAvg > olderAvg ? 'improving' : recentAvg < olderAvg ? 'declining' : 'stable',
            recentImprovement: recentAvg > olderAvg,
            totalValidations: results.length
        };
    }

    getCommonIssues(): Array<{ pattern: string, frequency: number }> {
        return Array.from(this.improvementPatterns.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([pattern, frequency]) => ({ pattern, frequency }));
    }

    // Cleanup method
    clearHistory(): void {
        this.qualityHistory.clear();
        this.improvementPatterns.clear();
    }
}
