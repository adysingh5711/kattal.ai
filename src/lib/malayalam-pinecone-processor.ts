import { Pinecone } from "@pinecone-database/pinecone";
import { Document } from "langchain/document";
import { PineconeStore } from "@langchain/pinecone";
import { OpenAIEmbeddings } from "@langchain/openai";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { env } from "./env";
import { getPinecone } from "./pinecone-client";
import crypto from 'crypto';

/**
 * Streamlined Malayalam Document Processor for Pinecone
 * Focused on Malayalam language enforcement and table serialization
 */

export interface MalayalamChunkMetadata {
    source: string;
    filename: string;
    chunkIndex: number;
    totalChunks: number;
    language: 'malayalam';
    hasTable: boolean;
    tableCount: number;
    headings: string[];
    contentType: 'text' | 'table' | 'mixed';
    namespace: string;
    processingDate: string;
    contentHash: string;
}

export interface ProcessingOptions {
    namespace: string;
    chunkSize: number;
    chunkOverlap: number;
    enforceLanguage: boolean;
    preserveTableStructure: boolean;
    enableDeduplication: boolean;
}

export interface ProcessingResult {
    totalChunks: number;
    processedChunks: number;
    skippedChunks: number;
    tablesPreserved: number;
    namespace: string;
    processingTime: number;
}

export class MalayalamPineconeProcessor {
    private pinecone!: Pinecone;
    private embeddings: OpenAIEmbeddings;
    private vectorStore: PineconeStore | null = null;
    private seenHashes: Set<string> = new Set();

    // Optimal settings for Malayalam MD files (production optimized)
    private readonly defaultOptions: ProcessingOptions = {
        namespace: env.PINECONE_NAMESPACE || 'malayalam-docs',
        chunkSize: env.CHUNK_SIZE || 1000, // Larger chunks for better context (production optimized)
        chunkOverlap: env.CHUNK_OVERLAP || 150, // Better context preservation (production optimized)
        enforceLanguage: false, // Set to false to process all documents
        preserveTableStructure: true,
        enableDeduplication: true
    };

    constructor() {
        this.embeddings = new OpenAIEmbeddings({
            modelName: env.EMBEDDING_MODEL, // Best for multilingual content
            dimensions: env.EMBEDDING_DIMENSIONS, // Reduced dimensions for faster processing
        });
    }

    /**
     * Initialize Pinecone connection and vector store
     */
    async initialize(): Promise<void> {
        console.log("🚀 Initializing Malayalam Pinecone Processor...");

        this.pinecone = await getPinecone();

        // Get or create index
        const indexName = env.PINECONE_INDEX_NAME;
        const index = this.pinecone.index(indexName);

        this.vectorStore = new PineconeStore(this.embeddings, {
            pineconeIndex: index,
            maxConcurrency: 5, // Prevent rate limiting
        });

        console.log("✅ Malayalam Pinecone Processor initialized");
    }

    /**
     * Process Malayalam markdown documents with table serialization
     */
    async processMarkdownDocuments(
        documents: Array<{ content: string; filename: string; source: string }>,
        options: Partial<ProcessingOptions> = {}
    ): Promise<ProcessingResult> {
        const startTime = Date.now();
        const opts = { ...this.defaultOptions, ...options };

        console.log(`📚 Processing ${documents.length} Malayalam documents...`);
        console.log(`⚙️  Options: chunk=${opts.chunkSize}, overlap=${opts.chunkOverlap}, namespace=${opts.namespace}`);

        if (!this.vectorStore) {
            await this.initialize();
        }

        let totalChunks = 0;
        let processedChunks = 0;
        let skippedChunks = 0;
        let tablesPreserved = 0;

        // Reset deduplication cache if enabled
        if (opts.enableDeduplication) {
            this.seenHashes.clear();
        }

        for (const doc of documents) {
            try {
                console.log(`📄 Processing: ${doc.filename}`);

                // Enforce Malayalam language
                if (opts.enforceLanguage && !this.isMalayalamContent(doc.content)) {
                    console.log(`⚠️  Skipping non-Malayalam document: ${doc.filename}`);
                    continue;
                }

                // Enhanced table serialization
                const serializedContent = this.serializeTablesForMalayalam(doc.content);
                const tableCount = this.countTables(doc.content);

                if (tableCount > 0) {
                    tablesPreserved += tableCount;
                    console.log(`📊 Serialized ${tableCount} tables in ${doc.filename}`);
                }

                // Create optimized text splitter
                const splitter = new RecursiveCharacterTextSplitter({
                    chunkSize: opts.chunkSize,
                    chunkOverlap: opts.chunkOverlap,
                    separators: [
                        '\n\n# ', // Preserve main headings
                        '\n\n## ', // Preserve sub headings
                        '\n\n### ', // Preserve smaller headings
                        '\n\n', // Paragraph breaks
                        '\n|', // Table rows
                        '\n', // Line breaks
                        '. ', // Sentence breaks
                        ' ', // Word breaks
                        '' // Character level
                    ],
                });

                // Split into chunks
                const chunks = await splitter.splitText(serializedContent);
                totalChunks += chunks.length;

                // Process chunks with enhanced metadata
                const langchainDocs = chunks.map((chunk, index) => {
                    const headings = this.extractHeadings(chunk);
                    const hasTable = chunk.includes('പട്ടികയുടെ') || chunk.includes('|');
                    const contentType = this.determineContentType(chunk);

                    const metadata: MalayalamChunkMetadata = {
                        source: doc.source,
                        filename: doc.filename,
                        chunkIndex: index,
                        totalChunks: chunks.length,
                        language: 'malayalam',
                        hasTable,
                        tableCount: this.countTables(chunk),
                        headings,
                        contentType,
                        namespace: opts.namespace,
                        processingDate: new Date().toISOString(),
                        contentHash: this.generateContentHash(chunk)
                    };

                    return new Document({
                        pageContent: chunk,
                        metadata
                    });
                });

                // Apply deduplication if enabled
                const docsToProcess = opts.enableDeduplication
                    ? this.deduplicateChunks(langchainDocs)
                    : langchainDocs;

                skippedChunks += langchainDocs.length - docsToProcess.length;

                // Store in Pinecone with namespace
                if (docsToProcess.length > 0) {
                    await this.vectorStore!.addDocuments(docsToProcess, {
                        namespace: opts.namespace
                    });
                    processedChunks += docsToProcess.length;
                    console.log(`✅ Stored ${docsToProcess.length} chunks from ${doc.filename}`);
                }

            } catch (error) {
                console.error(`❌ Error processing ${doc.filename}:`, error);
            }
        }

        const processingTime = Date.now() - startTime;

        const result: ProcessingResult = {
            totalChunks,
            processedChunks,
            skippedChunks,
            tablesPreserved,
            namespace: opts.namespace,
            processingTime
        };

        console.log(`🎉 Processing complete: ${processedChunks}/${totalChunks} chunks processed in ${processingTime}ms`);
        console.log(`📊 Tables preserved: ${tablesPreserved}, Duplicates skipped: ${skippedChunks}`);

        return result;
    }

    /**
     * Systematic retrieval from multiple namespaces with ranking
     */
    async searchAcrossNamespaces(
        query: string,
        namespaces: string[],
        options: {
            k?: number;
            scoreThreshold?: number;
            includeMetadata?: boolean;
        } = {}
    ): Promise<{
        documents: Document[];
        namespaceResults: Record<string, Document[]>;
        searchMetadata: {
            totalResults: number;
            searchTime: number;
            namespaceCounts: Record<string, number>;
        };
    }> {
        const startTime = Date.now();
        const { k = 6, scoreThreshold = 0.7, includeMetadata = true } = options;

        console.log(`🔍 Searching across ${namespaces.length} namespaces: ${namespaces.join(', ')}`);

        if (!this.vectorStore) {
            await this.initialize();
        }

        // Search each namespace in parallel
        const namespaceSearches = namespaces.map(async (namespace) => {
            try {
                const results = await this.vectorStore!.similaritySearch(
                    query,
                    Math.ceil(k / namespaces.length) + 2, // Distribute k across namespaces
                    {
                        namespace,
                        includeMetadata,
                        scoreThreshold: scoreThreshold * 0.8 // Slightly lower threshold per namespace
                    }
                );
                return { namespace, results };
            } catch (error) {
                console.error(`❌ Error searching namespace ${namespace}:`, error);
                return { namespace, results: [] };
            }
        });

        const namespaceResults = await Promise.all(namespaceSearches);

        // Combine and rank results
        const allResults: Document[] = [];
        const namespaceResultsMap: Record<string, Document[]> = {};
        const namespaceCounts: Record<string, number> = {};

        for (const { namespace, results } of namespaceResults) {
            namespaceResultsMap[namespace] = results;
            namespaceCounts[namespace] = results.length;
            allResults.push(...results);
        }

        // Sort by relevance score and limit to k
        const rankedResults = allResults
            .sort((a, b) => {
                const scoreA = a.metadata?._score || 0;
                const scoreB = b.metadata?._score || 0;
                return scoreB - scoreA;
            })
            .slice(0, k);

        const searchTime = Date.now() - startTime;

        console.log(`✅ Search complete: ${rankedResults.length} results from ${namespaces.length} namespaces in ${searchTime}ms`);

        return {
            documents: rankedResults,
            namespaceResults: namespaceResultsMap,
            searchMetadata: {
                totalResults: allResults.length,
                searchTime,
                namespaceCounts
            }
        };
    }

    /**
     * Enhanced table serialization for Malayalam content
     */
    private serializeTablesForMalayalam(content: string): string {
        const lines = content.split('\n');
        const result: string[] = [];
        let inTable = false;
        let headers: string[] = [];
        let tableIndex = 0;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];

            if (line.includes('|') && line.split('|').length > 2) {
                if (!inTable) {
                    inTable = true;
                    tableIndex++;
                    result.push(`\n## പട്ടിക ${tableIndex}\n`);
                }

                const cells = line.split('|')
                    .map(cell => cell.trim())
                    .filter(cell => cell.length > 0);

                // Skip separator lines
                if (cells.every(cell => cell.match(/^[-\s]*$/))) {
                    continue;
                }

                if (headers.length === 0) {
                    // First row is headers
                    headers = cells;
                    result.push(`**തലക്കെട്ടുകൾ:** ${headers.join(' | ')}\n`);
                } else {
                    // Data rows with Malayalam context
                    const rowData = cells.map((cell, index) => {
                        const header = headers[index] || `കോളം${index + 1}`;
                        return `${header}: ${cell}`;
                    }).join('\n');

                    result.push(`**വിവരങ്ങൾ:**\n${rowData}\n`);
                }
            } else {
                if (inTable) {
                    inTable = false;
                    headers = [];
                    result.push('\n---\n');
                }
                result.push(line);
            }
        }

        return result.join('\n');
    }

    /**
     * Check if content is relevant to Kerala/Malayalam context (accepts English documents about Kerala)
     */
    private isMalayalamContent(content: string): boolean {
        // Malayalam Unicode range: U+0D00-U+0D7F
        const malayalamRegex = /[\u0D00-\u0D7F]/g;
        const malayalamMatches = content.match(malayalamRegex) || [];
        const totalChars = content.replace(/\s/g, '').length;

        // Accept content with at least 5% Malayalam characters (more permissive)
        const malayalamRatio = malayalamMatches.length / Math.max(totalChars, 1);
        const hasSignificantMalayalam = malayalamRatio >= 0.05;

        // Malayalam keywords
        const malayalamKeywords = [
            'പഞ്ചായത്ത്', 'വികസന', 'പദ്ധതി', 'ബജറ്റ്', 'സർക്കാർ', 'നിയമസഭ',
            'കാട്ടക്കട', 'തിരുവനന്തപുരം', 'കേരളം', 'മുഖ്യമന്ത്രി', 'മന്ത്രി'
        ];

        const hasMalayalamKeywords = malayalamKeywords.some(keyword =>
            content.toLowerCase().includes(keyword.toLowerCase())
        );

        // Kerala/India related English keywords (for English documents about Kerala)
        const keralaKeywords = [
            'thiruvananthapuram', 'kerala', 'kattakada', 'neyyattinkara', 'kollam',
            'alappuzha', 'kochi', 'thrissur', 'palakkad', 'malappuram', 'kozhikode',
            'kannur', 'kasaragod', 'district', 'panchayat', 'assembly', 'development',
            'project', 'budget', 'government', 'minister', 'collector', 'statistics',
            'handbook', 'report', 'plan', 'activity', 'water', 'jal', 'rain'
        ];

        const hasKeralaKeywords = keralaKeywords.some(keyword =>
            content.toLowerCase().includes(keyword.toLowerCase())
        );

        // Accept if it has Malayalam content OR Kerala-related English content
        return hasSignificantMalayalam || hasMalayalamKeywords || hasKeralaKeywords;
    }

    /**
     * Count tables in content
     */
    private countTables(content: string): number {
        const lines = content.split('\n');
        let tableCount = 0;
        let inTable = false;

        for (const line of lines) {
            if (line.includes('|') && line.split('|').length > 2) {
                if (!inTable) {
                    inTable = true;
                    tableCount++;
                }
            } else if (inTable && !line.trim()) {
                inTable = false;
            }
        }

        return tableCount;
    }

    /**
     * Extract headings from chunk
     */
    private extractHeadings(chunk: string): string[] {
        const headingRegex = /^#+\s+(.+)$/gm;
        const headings: string[] = [];
        let match;

        while ((match = headingRegex.exec(chunk)) !== null) {
            headings.push(match[1]);
        }

        return headings;
    }

    /**
     * Determine content type
     */
    private determineContentType(chunk: string): 'text' | 'table' | 'mixed' {
        const hasTable = chunk.includes('പട്ടികയുടെ') || chunk.includes('|');
        const hasText = chunk.replace(/[|#*\-\s]/g, '').length > 50;

        if (hasTable && hasText) return 'mixed';
        if (hasTable) return 'table';
        return 'text';
    }

    /**
     * Generate content hash for deduplication
     */
    private generateContentHash(content: string): string {
        return crypto
            .createHash('sha256')
            .update(content.trim().toLowerCase())
            .digest('hex')
            .substring(0, 12);
    }

    /**
     * Deduplicate chunks based on content hash
     */
    private deduplicateChunks(documents: Document[]): Document[] {
        const deduplicated: Document[] = [];

        for (const doc of documents) {
            const hash = doc.metadata.contentHash as string;

            if (!this.seenHashes.has(hash)) {
                this.seenHashes.add(hash);
                deduplicated.push(doc);
            }
        }

        return deduplicated;
    }

    /**
     * Get processing statistics
     */
    getStats(): {
        totalHashes: number;
        cacheSize: number;
    } {
        return {
            totalHashes: this.seenHashes.size,
            cacheSize: this.seenHashes.size
        };
    }

    /**
     * Reset processing cache
     */
    resetCache(): void {
        this.seenHashes.clear();
        console.log('🔄 Processing cache reset');
    }
}

/**
 * Convenience function to process Malayalam documents
 */
export async function processMalayalamDocuments(
    documents: Array<{ content: string; filename: string; source: string }>,
    options: Partial<ProcessingOptions> = {}
): Promise<ProcessingResult> {
    const processor = new MalayalamPineconeProcessor();
    await processor.initialize();
    return processor.processMarkdownDocuments(documents, options);
}

/**
 * Convenience function for multi-namespace search
 */
export async function searchMalayalamDocuments(
    query: string,
    namespaces: string[] = [env.PINECONE_NAMESPACE || 'malayalam-docs'],
    options: { k?: number; scoreThreshold?: number } = {}
): Promise<Document[]> {
    const processor = new MalayalamPineconeProcessor();
    await processor.initialize();
    const result = await processor.searchAcrossNamespaces(query, namespaces, options);
    return result.documents;
}
