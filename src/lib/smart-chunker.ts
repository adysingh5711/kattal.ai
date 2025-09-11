import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { Document } from "langchain/document";
import crypto from 'crypto';

export const createSmartTextSplitter = () => {
    return new RecursiveCharacterTextSplitter({
        chunkSize: 1500, // Increased from 1000 for better context
        chunkOverlap: 150, // 10% overlap for continuity
        separators: [
            "\n---\n", // Section separators
            "\n\n", // Paragraph breaks
            "\nTABLE:", // Table boundaries
            "\nVISUAL ANALYSIS:", // Visual content boundaries
            "\n",
            ".",
            "?",
            "!",
            "।", // Malayalam sentence ender
            " ",
            ""
        ],
    });
};

/**
 * Generate hash for content deduplication
 */
function generateContentHash(content: string): string {
    return crypto.createHash('md5').update(content.trim()).digest('hex');
}

/**
 * Smart chunking that preserves table and visual content integrity while preventing duplicates
 */
export const chunkMultimodalDocuments = async (docs: Document[]): Promise<Document[]> => {
    const chunkedDocs: Document[] = [];
    const seenHashes = new Set<string>();
    const sourceChunkCounts = new Map<string, number>();

    console.log(`📄 Starting smart chunking for ${docs.length} documents...`);

    for (const doc of docs) {
        const source = doc.metadata?.source || 'unknown';

        // Track chunk counts per source for monitoring
        if (!sourceChunkCounts.has(source)) {
            sourceChunkCounts.set(source, 0);
        }

        const content = doc.pageContent;

        // Skip empty documents
        if (!content || content.trim().length === 0) {
            console.warn(`⚠️  Skipping empty document: ${source}`);
            continue;
        }

        // Check for document-level duplicates
        const docHash = generateContentHash(content);
        if (seenHashes.has(docHash)) {
            console.log(`🔄 Skipping duplicate document: ${source}`);
            continue;
        }
        seenHashes.add(docHash);

        // Check if document has structured content
        const hasStructuredContent = content.includes('VISUAL ANALYSIS:') ||
            content.includes('TABLE:') ||
            doc.metadata.hasTables ||
            doc.metadata.hasCharts;

        let chunks: Document[];

        if (hasStructuredContent) {
            // Use custom chunking for structured content
            chunks = smartChunkStructuredContent(content, doc.metadata, source);
        } else {
            // Use standard text splitter for regular content
            const textSplitter = createSmartTextSplitter();
            const splitChunks = await textSplitter.splitDocuments([doc]);
            chunks = deduplicateChunks(splitChunks, source);
        }

        // Filter out tiny chunks that aren't useful
        const filteredChunks = chunks.filter(chunk => {
            const trimmedContent = chunk.pageContent.trim();
            return trimmedContent.length >= 50; // Minimum useful chunk size
        });

        sourceChunkCounts.set(source, filteredChunks.length);
        chunkedDocs.push(...filteredChunks);

        console.log(`📋 ${source}: ${filteredChunks.length} chunks created`);
    }

    // Log summary
    console.log(`\n📊 Chunking Summary:`);
    console.log(`   Total documents processed: ${docs.length}`);
    console.log(`   Total chunks created: ${chunkedDocs.length}`);
    console.log(`   Average chunks per document: ${(chunkedDocs.length / docs.length).toFixed(1)}`);

    // Show per-source breakdown
    for (const [source, count] of sourceChunkCounts.entries()) {
        console.log(`   ${source}: ${count} chunks`);
    }

    return chunkedDocs;
};

/**
 * Deduplicate chunks to prevent same content being processed multiple times
 */
function deduplicateChunks(chunks: Document[], source: string): Document[] {
    const seenContent = new Set<string>();
    const uniqueChunks: Document[] = [];

    for (const chunk of chunks) {
        const contentHash = generateContentHash(chunk.pageContent);

        if (!seenContent.has(contentHash)) {
            seenContent.add(contentHash);
            uniqueChunks.push({
                ...chunk,
                metadata: {
                    ...chunk.metadata,
                    contentHash,
                    deduplicationApplied: true
                }
            });
        } else {
            console.log(`🔄 Deduplicated chunk from: ${source}`);
        }
    }

    return uniqueChunks;
}

function smartChunkStructuredContent(content: string, metadata: Record<string, unknown>, source: string): Document[] {
    const chunks: Document[] = [];
    const sections = content.split('\n---\n');
    const MAX_CHUNK_SIZE = 1500; // Increased for better context
    const seenHashes = new Set<string>();

    let currentChunk = '';
    let chunkIndex = 0;

    for (const section of sections) {
        const sectionHash = generateContentHash(section);

        // Skip if we've seen this exact section before
        if (seenHashes.has(sectionHash)) {
            console.log(`🔄 Skipping duplicate section in: ${source}`);
            continue;
        }
        seenHashes.add(sectionHash);

        // If adding this section would exceed chunk size, create a new chunk
        if (currentChunk.length + section.length > MAX_CHUNK_SIZE && currentChunk.length > 0) {
            const chunkHash = generateContentHash(currentChunk);

            chunks.push(new Document({
                pageContent: currentChunk.trim(),
                metadata: {
                    ...metadata,
                    chunkIndex: chunkIndex++,
                    chunkType: detectChunkType(currentChunk),
                    contentHash: chunkHash,
                    source: source
                }
            }));
            currentChunk = section;
        } else {
            currentChunk += (currentChunk ? '\n---\n' : '') + section;
        }
    }

    // Add the last chunk
    if (currentChunk.trim().length > 0) {
        // If the last chunk is still too large, split it further
        if (currentChunk.length > MAX_CHUNK_SIZE) {
            const subChunks = splitLargeChunk(currentChunk, MAX_CHUNK_SIZE, metadata, chunkIndex, source);
            chunks.push(...subChunks);
        } else {
            const chunkHash = generateContentHash(currentChunk);

            chunks.push(new Document({
                pageContent: currentChunk.trim(),
                metadata: {
                    ...metadata,
                    chunkIndex: chunkIndex++,
                    chunkType: detectChunkType(currentChunk),
                    contentHash: chunkHash,
                    source: source
                }
            }));
        }
    }

    return chunks;
}

function splitLargeChunk(content: string, maxSize: number, metadata: Record<string, unknown>, startIndex: number, source: string): Document[] {
    const chunks: Document[] = [];
    let chunkIndex = startIndex;
    const seenHashes = new Set<string>();

    // Try to split by sentences first to maintain readability
    const sentences = content.split(/[.!?]+\s+/);
    let currentChunk = '';

    for (const sentence of sentences) {
        const potentialChunk = currentChunk + (currentChunk ? '. ' : '') + sentence;

        if (potentialChunk.length > maxSize && currentChunk.length > 0) {
            const chunkHash = generateContentHash(currentChunk);

            // Only add if not a duplicate
            if (!seenHashes.has(chunkHash)) {
                seenHashes.add(chunkHash);

                chunks.push(new Document({
                    pageContent: currentChunk.trim(),
                    metadata: {
                        ...metadata,
                        chunkIndex: chunkIndex++,
                        chunkType: detectChunkType(currentChunk),
                        isSubChunk: true,
                        contentHash: chunkHash,
                        source: source
                    }
                }));
            }
            currentChunk = sentence;
        } else {
            currentChunk = potentialChunk;
        }
    }

    // Add the last chunk
    if (currentChunk.trim().length > 0) {
        // If still too large, force split by characters
        if (currentChunk.length > maxSize) {
            for (let i = 0; i < currentChunk.length; i += maxSize) {
                const chunk = currentChunk.slice(i, i + maxSize);
                const chunkHash = generateContentHash(chunk);

                if (!seenHashes.has(chunkHash) && chunk.trim().length >= 50) {
                    seenHashes.add(chunkHash);

                    chunks.push(new Document({
                        pageContent: chunk.trim(),
                        metadata: {
                            ...metadata,
                            chunkIndex: chunkIndex++,
                            chunkType: detectChunkType(chunk),
                            isSubChunk: true,
                            isForceSplit: true,
                            contentHash: chunkHash,
                            source: source
                        }
                    }));
                }
            }
        } else {
            const chunkHash = generateContentHash(currentChunk);

            if (!seenHashes.has(chunkHash)) {
                chunks.push(new Document({
                    pageContent: currentChunk.trim(),
                    metadata: {
                        ...metadata,
                        chunkIndex: chunkIndex++,
                        chunkType: detectChunkType(currentChunk),
                        isSubChunk: true,
                        contentHash: chunkHash,
                        source: source
                    }
                }));
            }
        }
    }

    return chunks;
}

function detectChunkType(content: string): string {
    const lower = content.toLowerCase();
    const lines = content.split('\n');

    // Check for table patterns in the content
    const tablePatterns = [
        lower.includes('table:'),
        lower.includes('tabular'),
        lower.includes('schedule'),
        /\d+\.\s+.*?\s{2,}/.test(content), // Numbered items with spacing
        /\|.*\|/.test(content), // Pipe separators
        /\t.*\t/.test(content), // Tab separators
        /\s{3,}/.test(content) && lines.length > 3, // Multiple lines with spacing
        lines.some(line => /^\s*\w+\s+\w+\s+\w+/.test(line)) // Multiple words with spacing
    ];

    if (tablePatterns.some(pattern => pattern)) {
        return 'table';
    }

    // Visual content detection
    if (lower.includes('visual analysis:') || lower.includes('image:') || lower.includes('figure:')) {
        return 'multimodal';
    }

    // Chart/graph detection
    if (lower.includes('chart') || lower.includes('graph') || lower.includes('plot')) {
        return 'chart';
    }

    // List detection
    if (lines.length > 2 && lines.filter(line => /^\s*[-*•]\s/.test(line)).length > lines.length * 0.5) {
        return 'list';
    }

    // Header detection
    if (content.length < 100 && /^[A-Z][^.]*$/.test(content.trim())) {
        return 'header';
    }

    return 'text';
}
