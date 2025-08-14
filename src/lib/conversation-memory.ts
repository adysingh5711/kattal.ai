import { ChatOpenAI } from "@langchain/openai";
import { env } from "./env";
import { DocumentNode } from "./document-graph";
import { extractJSONFromString } from "./json-utils";

const memoryModel = new ChatOpenAI({
    modelName: env.LLM_MODEL,
    temperature: 0.1, // Low temperature for consistent memory processing
    openAIApiKey: env.OPENAI_API_KEY,
});

export interface ConversationTurn {
    id: string;
    timestamp: Date;
    userQuery: string;
    systemResponse: string;
    queryType: string;
    keyEntities: string[];
    concepts: string[];
    documentsUsed: string[];
    confidence: number;
    followUpSuggestions?: string[];
}

export interface UserInterest {
    topic: string;
    strength: number; // 0-1 scale
    lastMentioned: Date;
    relatedQueries: string[];
    documentPreferences: string[]; // Document types user seems interested in
}

export interface ConversationContext {
    currentTopic: string;
    relatedTopics: string[];
    activeEntities: string[];
    conversationFlow: string[];
    userInterests: UserInterest[];
    recentContext: string;
}

export interface FollowUpSuggestion {
    question: string;
    reasoning: string;
    priority: number;
    category: 'clarification' | 'deeper_dive' | 'related_topic' | 'comparison';
}

export class ConversationMemory {
    private conversationHistory: ConversationTurn[] = [];
    private userInterests: Map<string, UserInterest> = new Map();
    private entityTracker: Map<string, number> = new Map(); // Entity frequency
    private conceptTracker: Map<string, number> = new Map(); // Concept frequency
    private sessionStartTime: Date = new Date();

    async updateContext(
        userQuery: string,
        systemResponse: string,
        queryAnalysis: any,
        documentsUsed: DocumentNode[]
    ): Promise<void> {
        const turnId = `turn_${Date.now()}`;

        // Extract entities and concepts from the response
        const responseAnalysis = await this.analyzeResponse(systemResponse);

        const turn: ConversationTurn = {
            id: turnId,
            timestamp: new Date(),
            userQuery,
            systemResponse,
            queryType: queryAnalysis.queryType || 'FACTUAL',
            keyEntities: [...(queryAnalysis.keyEntities || []), ...responseAnalysis.entities],
            concepts: responseAnalysis.concepts,
            documentsUsed: documentsUsed.map(doc => doc.id),
            confidence: responseAnalysis.confidence,
            followUpSuggestions: await this.generateFollowUpSuggestions(userQuery, systemResponse, responseAnalysis)
        };

        this.conversationHistory.push(turn);

        // Update entity and concept tracking
        this.updateEntityTracking(turn.keyEntities);
        this.updateConceptTracking(turn.concepts);

        // Update user interests
        await this.updateUserInterests(turn);

        // Cleanup old conversation history (keep last 20 turns)
        if (this.conversationHistory.length > 20) {
            this.conversationHistory = this.conversationHistory.slice(-20);
        }
    }

    private async analyzeResponse(response: string): Promise<any> {
        const analysisPrompt = `Analyze this AI response and extract key information:

Response: "${response.slice(0, 1500)}..."

Extract and return as JSON:
{
  "entities": ["entity1", "entity2"],
  "concepts": ["concept1", "concept2"],
  "confidence": 0.8,
  "mainTopics": ["topic1", "topic2"],
  "responseType": "factual|analytical|comparative|explanatory",
  "completeness": "complete|partial|needs_followup"
}

Focus on:
- Named entities mentioned in the response
- Key concepts and themes discussed
- Overall confidence in the answer quality
- Main topics covered`;

        try {
            const analysisResponse = await memoryModel.invoke(analysisPrompt);
            return JSON.parse(analysisResponse.content as string);
        } catch (error) {
            console.warn('Response analysis failed:', error);
            return {
                entities: [],
                concepts: [],
                confidence: 0.5,
                mainTopics: [],
                responseType: 'factual',
                completeness: 'partial'
            };
        }
    }

    private updateEntityTracking(entities: string[]): void {
        entities.forEach(entity => {
            const current = this.entityTracker.get(entity) || 0;
            this.entityTracker.set(entity, current + 1);
        });
    }

    private updateConceptTracking(concepts: string[]): void {
        concepts.forEach(concept => {
            const current = this.conceptTracker.get(concept) || 0;
            this.conceptTracker.set(concept, current + 1);
        });
    }

    private async updateUserInterests(turn: ConversationTurn): Promise<void> {
        const allTopics = [...turn.concepts, ...turn.keyEntities];

        allTopics.forEach(topic => {
            const existing = this.userInterests.get(topic);
            if (existing) {
                // Increase strength and update timestamp
                existing.strength = Math.min(1.0, existing.strength + 0.1);
                existing.lastMentioned = new Date();
                existing.relatedQueries.push(turn.userQuery);

                // Keep only recent queries (last 5)
                existing.relatedQueries = existing.relatedQueries.slice(-5);
            } else {
                // Create new interest
                this.userInterests.set(topic, {
                    topic,
                    strength: 0.3,
                    lastMentioned: new Date(),
                    relatedQueries: [turn.userQuery],
                    documentPreferences: turn.documentsUsed
                });
            }
        });

        // Decay old interests
        this.decayInterests();
    }

    private decayInterests(): void {
        const now = new Date();
        const dayMs = 24 * 60 * 60 * 1000;

        for (const [topic, interest] of this.userInterests.entries()) {
            const daysSinceLastMention = (now.getTime() - interest.lastMentioned.getTime()) / dayMs;

            // Decay strength based on time
            const decayFactor = Math.max(0.1, 1 - (daysSinceLastMention * 0.1));
            interest.strength *= decayFactor;

            // Remove very weak interests
            if (interest.strength < 0.1) {
                this.userInterests.delete(topic);
            }
        }
    }

    async getRelevantHistory(currentQuery: string, maxTurns: number = 5): Promise<string> {
        if (this.conversationHistory.length === 0) {
            return '';
        }

        const relevantTurns = await this.findRelevantTurns(currentQuery, maxTurns);

        return relevantTurns.map(turn =>
            `User: ${turn.userQuery}\nAssistant: ${turn.systemResponse.slice(0, 300)}...`
        ).join('\n\n');
    }

    private async findRelevantTurns(currentQuery: string, maxTurns: number): Promise<ConversationTurn[]> {
        const queryLower = currentQuery.toLowerCase();
        const scoredTurns: Array<{ turn: ConversationTurn, score: number }> = [];

        this.conversationHistory.forEach(turn => {
            let score = 0;

            // Recent conversations get higher scores
            const hoursAgo = (Date.now() - turn.timestamp.getTime()) / (1000 * 60 * 60);
            const recencyScore = Math.max(0, 1 - (hoursAgo / 24)); // Decay over 24 hours
            score += recencyScore * 2;

            // Direct query similarity
            if (turn.userQuery.toLowerCase().includes(queryLower) ||
                queryLower.includes(turn.userQuery.toLowerCase())) {
                score += 3;
            }

            // Entity overlap
            turn.keyEntities.forEach(entity => {
                if (queryLower.includes(entity.toLowerCase())) {
                    score += 1.5;
                }
            });

            // Concept overlap  
            turn.concepts.forEach(concept => {
                if (queryLower.includes(concept.toLowerCase())) {
                    score += 1;
                }
            });

            if (score > 0.5) {
                scoredTurns.push({ turn, score });
            }
        });

        return scoredTurns
            .sort((a, b) => b.score - a.score)
            .slice(0, maxTurns)
            .map(item => item.turn);
    }

    async generateFollowUpSuggestions(
        userQuery: string,
        systemResponse: string,
        responseAnalysis: any
    ): Promise<string[]> {
        const suggestionPrompt = `Based on this conversation turn, suggest 2-3 natural follow-up questions:

User Query: "${userQuery}"
System Response: "${systemResponse.slice(0, 800)}..."
Response Completeness: ${responseAnalysis.completeness}
Main Topics: ${responseAnalysis.mainTopics?.join(', ') || 'N/A'}

Generate follow-up questions that:
1. Explore deeper aspects of the topic
2. Ask for clarification if needed
3. Connect to related topics
4. Request specific examples or details

Return as JSON array: ["question1", "question2", "question3"]

Make questions natural and conversational, as if the user is genuinely curious to learn more.`;

        try {
            const response = await memoryModel.invoke(suggestionPrompt);
            const suggestions = extractJSONFromString(response.content as string);
            return Array.isArray(suggestions) ? suggestions : [];
        } catch (error) {
            console.warn('Follow-up generation failed:', error);
            return [];
        }
    }

    getCurrentContext(): ConversationContext {
        const recentTurns = this.conversationHistory.slice(-3);
        const activeEntities = this.getTopEntities(5);
        const currentTopic = this.inferCurrentTopic();

        return {
            currentTopic,
            relatedTopics: this.getRelatedTopics(currentTopic),
            activeEntities,
            conversationFlow: recentTurns.map(turn => turn.queryType),
            userInterests: Array.from(this.userInterests.values()).slice(0, 10),
            recentContext: recentTurns.map(turn => turn.userQuery).join(' | ')
        };
    }

    private getTopEntities(count: number): string[] {
        return Array.from(this.entityTracker.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, count)
            .map(([entity]) => entity);
    }

    private inferCurrentTopic(): string {
        const recentConcepts = this.conversationHistory
            .slice(-3)
            .flatMap(turn => turn.concepts);

        if (recentConcepts.length === 0) return 'general';

        // Find most frequent recent concept
        const conceptCounts = new Map<string, number>();
        recentConcepts.forEach(concept => {
            conceptCounts.set(concept, (conceptCounts.get(concept) || 0) + 1);
        });

        const topConcept = Array.from(conceptCounts.entries())
            .sort((a, b) => b[1] - a[1])[0];

        return topConcept ? topConcept[0] : 'general';
    }

    private getRelatedTopics(currentTopic: string): string[] {
        // Find topics that frequently co-occur with current topic
        const relatedTopics = new Set<string>();

        this.conversationHistory.forEach(turn => {
            if (turn.concepts.includes(currentTopic)) {
                turn.concepts.forEach(concept => {
                    if (concept !== currentTopic) {
                        relatedTopics.add(concept);
                    }
                });
            }
        });

        return Array.from(relatedTopics).slice(0, 5);
    }

    async identifyKnowledgeGaps(currentQuery: string): Promise<string[]> {
        const context = this.getCurrentContext();

        const gapPrompt = `Based on the conversation context, identify potential knowledge gaps for this query:

Current Query: "${currentQuery}"
Current Topic: ${context.currentTopic}
Related Topics: ${context.relatedTopics.join(', ')}
User Interests: ${context.userInterests.map(i => i.topic).join(', ')}

Identify 2-3 areas where additional information might be helpful:
1. Missing context that would improve understanding
2. Related aspects not yet explored
3. Clarifications that might be needed

Return as JSON array: ["gap1", "gap2", "gap3"]`;

        try {
            const response = await memoryModel.invoke(gapPrompt);
            const gaps = extractJSONFromString(response.content as string);
            return Array.isArray(gaps) ? gaps : [];
        } catch (error) {
            console.warn('Knowledge gap identification failed:', error);
            return [];
        }
    }

    getConversationSummary(): string {
        if (this.conversationHistory.length === 0) {
            return 'No conversation history';
        }

        const topEntities = this.getTopEntities(3);
        const topConcepts = Array.from(this.conceptTracker.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map(([concept]) => concept);

        const sessionDuration = Date.now() - this.sessionStartTime.getTime();
        const sessionMinutes = Math.round(sessionDuration / (1000 * 60));

        return `Session: ${sessionMinutes}min, ${this.conversationHistory.length} turns. ` +
            `Key topics: ${topConcepts.join(', ')}. ` +
            `Main entities: ${topEntities.join(', ')}.`;
    }

    // Cleanup method for session end
    clearSession(): void {
        this.conversationHistory = [];
        this.userInterests.clear();
        this.entityTracker.clear();
        this.conceptTracker.clear();
        this.sessionStartTime = new Date();
    }

    // Export conversation data for analysis
    exportConversationData(): any {
        return {
            history: this.conversationHistory,
            interests: Array.from(this.userInterests.entries()),
            entityStats: Array.from(this.entityTracker.entries()),
            conceptStats: Array.from(this.conceptTracker.entries()),
            sessionDuration: Date.now() - this.sessionStartTime.getTime()
        };
    }
}
