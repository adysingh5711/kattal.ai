import { Document } from "langchain/document";
import { ChatOpenAI } from "@langchain/openai";
import { env } from "./env";
import { extractJSONFromString } from "./json-utils";

const graphModel = new ChatOpenAI({
    modelName: env.LLM_MODEL,
    temperature: 0.2,
    openAIApiKey: env.OPENAI_API_KEY,
});

export interface DocumentNode {
    id: string;
    content: string;
    summary: string;
    type: 'text' | 'table' | 'chart' | 'multimodal';
    entities: string[];
    concepts: string[];
    keyTopics: string[];
    relationships: DocumentEdge[];
    metadata: Record<string, any>;
}

export interface DocumentEdge {
    targetId: string;
    type: 'references' | 'contradicts' | 'supports' | 'elaborates' | 'compares' | 'causally_related';
    confidence: number;
    description: string;
    sharedEntities: string[];
}

export interface ConceptCluster {
    concept: string;
    relatedDocuments: string[];
    strength: number;
    subConcepts: string[];
}

export class DocumentGraphBuilder {
    private nodes: Map<string, DocumentNode> = new Map();
    private conceptIndex: Map<string, string[]> = new Map();
    private entityIndex: Map<string, string[]> = new Map();

    async buildKnowledgeGraph(documents: Document[]): Promise<DocumentNode[]> {
        console.log(`🔗 Building knowledge graph from ${documents.length} documents...`);

        // Step 1: Create nodes for each document
        const nodes = await this.createDocumentNodes(documents);

        // Step 2: Extract entities and concepts
        await this.extractEntitiesAndConcepts(nodes);

        // Step 3: Find relationships between documents
        await this.findDocumentRelationships(nodes);

        // Step 4: Build concept clusters
        await this.buildConceptClusters(nodes);

        console.log(`✅ Knowledge graph built with ${nodes.length} nodes`);
        return nodes;
    }

    private async createDocumentNodes(documents: Document[]): Promise<DocumentNode[]> {
        const nodes: DocumentNode[] = [];

        for (let i = 0; i < documents.length; i++) {
            const doc = documents[i];
            const nodeId = `doc_${i}`;

            // Generate summary and extract key information
            const analysis = await this.analyzeDocument(doc);

            const node: DocumentNode = {
                id: nodeId,
                content: doc.pageContent,
                summary: analysis.summary,
                type: this.determineDocumentType(doc),
                entities: analysis.entities,
                concepts: analysis.concepts,
                keyTopics: analysis.keyTopics,
                relationships: [],
                metadata: doc.metadata || {}
            };

            nodes.push(node);
            this.nodes.set(nodeId, node);
        }

        return nodes;
    }

    private async analyzeDocument(doc: Document): Promise<any> {
        const analysisPrompt = `Analyze this document and extract key information:

Document Content:
${doc.pageContent.slice(0, 2000)}...

Extract and return as JSON:
{
  "summary": "2-3 sentence summary of main points",
  "entities": ["person1", "place1", "organization1"],
  "concepts": ["concept1", "concept2", "concept3"],
  "keyTopics": ["topic1", "topic2", "topic3"],
  "documentType": "factual|analytical|procedural|comparative",
  "mainTheme": "primary theme or subject"
}

Focus on:
- Named entities (people, places, organizations, dates)
- Abstract concepts and themes
- Key topics and subjects discussed
- Type of information presented

Be specific and accurate. Limit to most important items.`;

        try {
            const response = await graphModel.invoke(analysisPrompt);
            return extractJSONFromString(response.content as string);
        } catch (error) {
            console.warn('Document analysis failed:', error);
            return {
                summary: doc.pageContent.slice(0, 200) + '...',
                entities: [],
                concepts: [],
                keyTopics: [],
                documentType: 'factual',
                mainTheme: 'general'
            };
        }
    }

    private determineDocumentType(doc: Document): 'text' | 'table' | 'chart' | 'multimodal' {
        const content = doc.pageContent.toLowerCase();
        const metadata = doc.metadata || {};

        if (content.includes('visual analysis:') || metadata.hasVisuals) {
            return 'multimodal';
        }
        if (content.includes('table') || metadata.hasTables) {
            return 'table';
        }
        if (content.includes('chart') || content.includes('graph') || metadata.hasCharts) {
            return 'chart';
        }
        return 'text';
    }

    private async extractEntitiesAndConcepts(nodes: DocumentNode[]): Promise<void> {
        // Build indexes for fast lookup
        nodes.forEach(node => {
            // Index entities
            node.entities.forEach(entity => {
                if (!this.entityIndex.has(entity)) {
                    this.entityIndex.set(entity, []);
                }
                this.entityIndex.get(entity)!.push(node.id);
            });

            // Index concepts
            node.concepts.forEach(concept => {
                if (!this.conceptIndex.has(concept)) {
                    this.conceptIndex.set(concept, []);
                }
                this.conceptIndex.get(concept)!.push(node.id);
            });
        });
    }

    private async findDocumentRelationships(nodes: DocumentNode[]): Promise<void> {
        console.log('🔍 Finding document relationships...');

        for (let i = 0; i < nodes.length; i++) {
            for (let j = i + 1; j < nodes.length; j++) {
                const relationship = await this.analyzeRelationship(nodes[i], nodes[j]);
                if (relationship) {
                    nodes[i].relationships.push({
                        targetId: nodes[j].id,
                        ...relationship
                    });
                    nodes[j].relationships.push({
                        targetId: nodes[i].id,
                        ...relationship
                    });
                }
            }
        }
    }

    private async analyzeRelationship(node1: DocumentNode, node2: DocumentNode): Promise<any | null> {
        // Check for shared entities and concepts
        const sharedEntities = node1.entities.filter(e => node2.entities.includes(e));
        const sharedConcepts = node1.concepts.filter(c => node2.concepts.includes(c));

        // Skip if no significant overlap
        if (sharedEntities.length === 0 && sharedConcepts.length === 0) {
            return null;
        }

        const relationshipPrompt = `Analyze the relationship between these two document sections:

Document 1 Summary: ${node1.summary}
Document 1 Topics: ${node1.keyTopics.join(', ')}

Document 2 Summary: ${node2.summary}  
Document 2 Topics: ${node2.keyTopics.join(', ')}

Shared Entities: ${sharedEntities.join(', ')}
Shared Concepts: ${sharedConcepts.join(', ')}

Determine the relationship type and return as JSON:
{
  "type": "references|contradicts|supports|elaborates|compares|causally_related",
  "confidence": 0.0-1.0,
  "description": "brief description of the relationship",
  "strength": "weak|moderate|strong"
}

Relationship Types:
- references: One mentions or cites the other
- contradicts: Present conflicting information
- supports: Provide supporting evidence for each other
- elaborates: One provides more detail about the other's topic
- compares: Compare similar subjects or data
- causally_related: One describes cause, other describes effect

Only return a relationship if confidence > 0.4`;

        try {
            const response = await graphModel.invoke(relationshipPrompt);
            const analysis = extractJSONFromString(response.content as string);

            if (analysis.confidence > 0.4) {
                return {
                    type: analysis.type,
                    confidence: analysis.confidence,
                    description: analysis.description,
                    sharedEntities: sharedEntities
                };
            }
            return null;
        } catch (error) {
            console.warn('Relationship analysis failed:', error);
            return null;
        }
    }

    private async buildConceptClusters(nodes: DocumentNode[]): Promise<ConceptCluster[]> {
        const clusters: ConceptCluster[] = [];

        // Group documents by shared concepts
        for (const [concept, documentIds] of this.conceptIndex.entries()) {
            if (documentIds.length > 1) { // Only concepts shared by multiple documents
                clusters.push({
                    concept,
                    relatedDocuments: documentIds,
                    strength: documentIds.length,
                    subConcepts: this.findRelatedConcepts(concept, nodes)
                });
            }
        }

        // Sort by strength
        return clusters.sort((a, b) => b.strength - a.strength);
    }

    private findRelatedConcepts(mainConcept: string, nodes: DocumentNode[]): string[] {
        const relatedConcepts = new Set<string>();
        const mainConceptDocs = this.conceptIndex.get(mainConcept) || [];

        // Find concepts that frequently co-occur with the main concept
        mainConceptDocs.forEach(docId => {
            const node = this.nodes.get(docId);
            if (node) {
                node.concepts.forEach(concept => {
                    if (concept !== mainConcept) {
                        relatedConcepts.add(concept);
                    }
                });
            }
        });

        return Array.from(relatedConcepts).slice(0, 5);
    }

    async findRelatedContent(query: string, nodes: DocumentNode[], maxResults: number = 8): Promise<DocumentNode[]> {
        const queryLower = query.toLowerCase();
        const scoredNodes: Array<{ node: DocumentNode, score: number }> = [];

        nodes.forEach(node => {
            let score = 0;

            // Direct content match
            if (node.content.toLowerCase().includes(queryLower)) {
                score += 3;
            }

            // Summary match
            if (node.summary.toLowerCase().includes(queryLower)) {
                score += 2;
            }

            // Entity matches
            node.entities.forEach(entity => {
                if (queryLower.includes(entity.toLowerCase()) || entity.toLowerCase().includes(queryLower)) {
                    score += 1.5;
                }
            });

            // Concept matches
            node.concepts.forEach(concept => {
                if (queryLower.includes(concept.toLowerCase()) || concept.toLowerCase().includes(queryLower)) {
                    score += 1;
                }
            });

            // Topic matches
            node.keyTopics.forEach(topic => {
                if (queryLower.includes(topic.toLowerCase()) || topic.toLowerCase().includes(queryLower)) {
                    score += 0.8;
                }
            });

            if (score > 0) {
                scoredNodes.push({ node, score });
            }
        });

        // Sort by score and return top results
        return scoredNodes
            .sort((a, b) => b.score - a.score)
            .slice(0, maxResults)
            .map(item => item.node);
    }

    getNodeById(id: string): DocumentNode | undefined {
        return this.nodes.get(id);
    }

    getRelatedNodes(nodeId: string): DocumentNode[] {
        const node = this.nodes.get(nodeId);
        if (!node) return [];

        return node.relationships
            .sort((a, b) => b.confidence - a.confidence)
            .slice(0, 5)
            .map(rel => this.nodes.get(rel.targetId))
            .filter(Boolean) as DocumentNode[];
    }

    getConceptClusters(): ConceptCluster[] {
        const clusters: ConceptCluster[] = [];

        for (const [concept, documentIds] of this.conceptIndex.entries()) {
            if (documentIds.length > 1) {
                clusters.push({
                    concept,
                    relatedDocuments: documentIds,
                    strength: documentIds.length,
                    subConcepts: []
                });
            }
        }

        return clusters.sort((a, b) => b.strength - a.strength);
    }
}
