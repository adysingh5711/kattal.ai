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
        namespace: env.PINECONE_NAMESPACE || '', // Single namespace strategy (default = empty string)
        chunkSize: env.CHUNK_SIZE || 800, // Smaller chunks for better location precision
        chunkOverlap: env.CHUNK_OVERLAP || 200, // Higher overlap to preserve location context
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
        const { k = 10, scoreThreshold = 0.3 } = options; // Lower default threshold for better recall

        console.log(`🔍 Searching across ${namespaces.length} namespaces: ${namespaces.join(', ')}`);

        if (!this.pinecone) {
            await this.initialize();
        }

        const index = this.pinecone.index(env.PINECONE_INDEX_NAME);

        // Search each namespace in parallel - create separate vector store per namespace
        const namespaceSearches = namespaces.map(async (namespace) => {
            try {
                // Create a vector store for this specific namespace
                const namespaceVectorStore = await PineconeStore.fromExistingIndex(
                    this.embeddings,
                    {
                        pineconeIndex: index,
                        namespace: namespace
                    }
                );

                // Use similaritySearchWithScore to get scores for filtering
                const resultsWithScores = await namespaceVectorStore.similaritySearchWithScore(
                    query,
                    Math.ceil(k / namespaces.length) + 4 // Get more results per namespace
                );

                // Filter by score threshold and convert to Documents
                const filteredResults = resultsWithScores
                    .filter(([, score]) => score >= scoreThreshold)
                    .map(([doc, score]) => {
                        doc.metadata._score = score;
                        doc.metadata._namespace = namespace;
                        return doc;
                    });

                console.log(`📚 Namespace '${namespace}': ${resultsWithScores.length} raw results, ${filteredResults.length} after filtering (threshold: ${scoreThreshold})`);
                return { namespace, results: filteredResults };
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

        // Accept content with at least 2% Malayalam characters (more permissive for location data)
        const malayalamRatio = malayalamMatches.length / Math.max(totalChars, 1);
        const hasSignificantMalayalam = malayalamRatio >= 0.02;

        // Enhanced Malayalam keywords including healthcare terms
        const malayalamKeywords = [
            'പഞ്ചായത്ത്', 'വികസന', 'പദ്ധതി', 'ബജറ്റ്', 'സർക്കാർ', 'നിയമസഭ',
            'കാട്ടക്കട', 'തിരുവനന്തപുരം', 'കേരളം', 'മുഖ്യമന്ത്രി', 'മന്ത്രി',
            'ആശുപത്രി', 'ആരോഗ്യ', 'ആയുർവേദ', 'ഡോക്ടർ', 'നഴ്സ്', 'ചികിത്സ',
            'കിള്ളി', 'പങ്കജ', 'കസ്തൂരി', 'മെഡിക്കൽ', 'ക്ലിനിക്', 'ഫാർമസി',
            'കുടുംബാരോഗ്യ', 'താലൂക്ക്', 'കമ്മയൂണിറ്റി'
        ];

        // Normalizing spaces for Malayalam content check
        const normalizedContent = content.replace(/\s+/g, '');

        const hasMalayalamKeywords = malayalamKeywords.some(keyword =>
            normalizedContent.includes(keyword) || content.toLowerCase().includes(keyword.toLowerCase())
        );

        // Enhanced Kerala/India related English keywords including healthcare
        const keralaKeywords = [
            'thiruvananthapuram', 'kerala', 'kattakada', 'neyyattinkara', 'kollam',
            'alappuzha', 'kochi', 'thrissur', 'palakkad', 'malappuram', 'kozhikode',
            'kannur', 'kasaragod', 'district', 'panchayat', 'assembly', 'development',
            'project', 'budget', 'government', 'minister', 'collector', 'statistics',
            'handbook', 'report', 'plan', 'activity', 'water', 'jal', 'rain',
            'hospital', 'health', 'medical', 'ayurveda', 'doctor', 'clinic', 'pharmacy',
            'killi', 'pankaja', 'kasturi', 'general hospital', 'healthcare', 'treatment'
        ];

        const hasKeralaKeywords = keralaKeywords.some(keyword =>
            content.toLowerCase().includes(keyword.toLowerCase())
        );

        // Location-specific patterns for better healthcare facility detection
        const locationPatterns = [
            /kattakada.*hospital/i,
            /കാട്ടക്കട.*ആശുപത്രി/i,
            /hospital.*kattakada/i,
            /ആശുപത്രി.*കാട്ടക്കട/i,
            /general.*hospital/i,
            /ജനറൽ.*ആശുപത്രി/i
        ];

        const hasLocationPattern = locationPatterns.some(pattern => pattern.test(content));

        // Accept if it has Malayalam content OR Kerala-related content OR location patterns
        return hasSignificantMalayalam || hasMalayalamKeywords || hasKeralaKeywords || hasLocationPattern;
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
    namespaces: string[] = [env.PINECONE_NAMESPACE || ''],
    options: { k?: number; scoreThreshold?: number } = {}
): Promise<Document[]> {
    const processor = new MalayalamPineconeProcessor();
    await processor.initialize();
    const result = await processor.searchAcrossNamespaces(query, namespaces, options);
    return result.documents;
}

/**
 * Enhanced search for location-based queries (hospitals, facilities, etc.)
 */
export async function searchLocationBasedQuery(
    query: string,
    namespaces: string[] = [env.PINECONE_NAMESPACE || ''],
    options: { k?: number; scoreThreshold?: number } = {}
): Promise<{
    documents: Document[];
    searchMetadata: {
        totalResults: number;
        searchTime: number;
        searchStrategies: string[];
    };
}> {
    const processor = new MalayalamPineconeProcessor();
    await processor.initialize();

    const startTime = Date.now();
    const searchStrategies: string[] = [];

    // Strategy 1: Direct search with original query - use very low threshold
    const directResult = await processor.searchAcrossNamespaces(query, namespaces, {
        k: options.k || 12,
        scoreThreshold: options.scoreThreshold || 0.2 // Very low threshold for better recall
    });
    searchStrategies.push('direct_search');

    // Strategy 2: Enhanced search with location keywords
    const locationKeywords = extractLocationKeywords(query);
    let enhancedResults: Document[] = [];

    if (locationKeywords.length > 0) {
        const enhancedQuery = `${query} ${locationKeywords.join(' ')}`;
        const enhancedResult = await processor.searchAcrossNamespaces(enhancedQuery, namespaces, {
            k: options.k || 10,
            scoreThreshold: options.scoreThreshold || 0.15 // Even lower for keyword-enhanced search
        });
        enhancedResults = enhancedResult.documents;
        searchStrategies.push('enhanced_location_search');
    }

    // Strategy 3: Keyword-based search for healthcare facilities
    let facilityResults: Document[] = [];
    if (isHealthcareFacilityQuery(query)) {
        const facilityKeywords = ['ആശുപത്രി', 'hospital', 'medical', 'health', 'clinic', 'ആരോഗ്യ'];
        const facilityQuery = `${query} ${facilityKeywords.join(' ')}`;
        const facilityResult = await processor.searchAcrossNamespaces(facilityQuery, namespaces, {
            k: options.k || 8,
            scoreThreshold: options.scoreThreshold || 0.1 // Lowest threshold for facility search
        });
        facilityResults = facilityResult.documents;
        searchStrategies.push('healthcare_facility_search');
    }

    // Combine and deduplicate results
    const allResults = [...directResult.documents, ...enhancedResults, ...facilityResults];
    const uniqueResults = deduplicateDocuments(allResults);

    // Sort by relevance and limit
    const finalResults = uniqueResults
        .sort((a, b) => {
            const scoreA = a.metadata?._score || 0;
            const scoreB = b.metadata?._score || 0;
            return scoreB - scoreA;
        })
        .slice(0, options.k || 10);

    const searchTime = Date.now() - startTime;

    return {
        documents: finalResults,
        searchMetadata: {
            totalResults: finalResults.length,
            searchTime,
            searchStrategies
        }
    };
}

/**
 * Extract location keywords from query
 */
function extractLocationKeywords(query: string): string[] {
    const locationKeywords: string[] = [];
    const lowerQuery = query.toLowerCase();

    // Malayalam place names
    const malayalamPlaces = [
        'കാട്ടക്കട', 'തിരുവനന്തപുരം', 'നെയ്യാറ്റിൻകര', 'കൊല്ലം', 'ആലപ്പുഴ',
        'കൊച്ചി', 'തൃശ്ശൂർ', 'പാലക്കാട്', 'മലപ്പുറം', 'കോഴിക്കോട്', 'കണ്ണൂർ', 'കാസർഗോഡ്'
    ];

    // English place names
    const englishPlaces = [
        'kattakada', 'thiruvananthapuram', 'neyyattinkara', 'kollam', 'alappuzha',
        'kochi', 'thrissur', 'palakkad', 'malappuram', 'kozhikode', 'kannur', 'kasaragod'
    ];

    malayalamPlaces.forEach(place => {
        if (lowerQuery.includes(place.toLowerCase())) {
            locationKeywords.push(place);
        }
    });

    englishPlaces.forEach(place => {
        if (lowerQuery.includes(place)) {
            locationKeywords.push(place);
        }
    });

    return locationKeywords;
}

/**
 * Check if query is about healthcare facilities
 */
function isHealthcareFacilityQuery(query: string): boolean {
    const healthcareTerms = [
        'hospital', 'ആശുപത്രി', 'clinic', 'ക്ലിനിക്', 'medical', 'മെഡിക്കൽ',
        'health', 'ആരോഗ്യ', 'doctor', 'ഡോക്ടർ', 'treatment', 'ചികിത്സ',
        'pharmacy', 'ഫാർമസി', 'ayurveda', 'ആയുർവേദ', 'general hospital', 'ജനറൽ ആശുപത്രി',
        'health centre', 'ആരോഗ്യ കേന്ദ്രം', 'fhc', 'chc', 'phc'
    ];

    const lowerQuery = query.toLowerCase();
    return healthcareTerms.some(term => lowerQuery.includes(term.toLowerCase()));
}

/**
 * Enhanced search specifically for Kattakada General Hospital with known location data
 */
export async function searchKattakadaHospitalInfo(
    query: string,
    namespaces: string[] = [env.PINECONE_NAMESPACE || '']
): Promise<{
    documents: Document[];
    knownLocationInfo: {
        hospitalName: string;
        location: string;
        district: string;
        state: string;
        coordinates?: string;
        nearbyLandmarks?: string[];
        exactAddress?: string;
    };
}> {
    const processor = new MalayalamPineconeProcessor();
    await processor.initialize();

    // Search for hospital information
    const searchResult = await processor.searchAcrossNamespaces(query, namespaces, {
        k: 12,
        scoreThreshold: 0.3
    });

    // Known location information for Kattakada Constituency based on 2024 Assembly Report
    const knownLocationInfo = {
        hospitalName: 'കാട്ടക്കട നിയോജക മണ്ഡലത്തിലെ ആശുപത്രികൾ (Kattakada Constituency Hospitals)',
        location: 'കാട്ടക്കട നിയോജക മണ്ഡലം',
        district: 'തിരുവനന്തപുരം',
        state: 'കേരളം',
        coordinates: '08°30\'27.4" N, 77°04\'56.8" E', // Kattakada town center
        nearbyLandmarks: [
            'മലയിൻകീഴ് താലൂക്ക് ആശുപത്രി',
            'വിളപ്പിൽ കമ്മയൂണിറ്റി ഹെൽത്ത് സെന്റർ',
            'വിളവൂർക്കൽ കമ്മയൂണിറ്റി ഹെൽത്ത് സെന്റർ',
            'കാട്ടക്കട കുടുംബാരോഗ്യ കേന്ദ്രം',
            'മാറനല്ലൂർ കുടുംബാരോഗ്യ കേന്ദ്രം',
            'പള്ളിച്ചൽ കുടുംബാരോഗ്യ കേന്ദ്രം'
        ],
        exactAddress: 'കാട്ടക്കട നിയോജക മണ്ഡലം, തിരുവനന്തപുരം ജില്ല'
    };

    return {
        documents: searchResult.documents,
        knownLocationInfo
    };
}

/**
 * Deduplicate documents based on content similarity
 */
function deduplicateDocuments(documents: Document[]): Document[] {
    const seen = new Set<string>();
    const deduplicated: Document[] = [];

    for (const doc of documents) {
        const contentHash = doc.pageContent.substring(0, 100).toLowerCase().trim();
        if (!seen.has(contentHash)) {
            seen.add(contentHash);
            deduplicated.push(doc);
        }
    }

    return deduplicated;
}
