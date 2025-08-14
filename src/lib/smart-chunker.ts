import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { Document } from "langchain/document";

export const createSmartTextSplitter = () => {
    return new RecursiveCharacterTextSplitter({
        chunkSize: 1000, // Much smaller to ensure we stay under token limits (≈285 tokens)
        chunkOverlap: 100, // Minimal overlap to prevent token overflow
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

// Smart chunking that preserves table and visual content integrity
export const chunkMultimodalDocuments = async (docs: Document[]): Promise<Document[]> => {
    const chunkedDocs: Document[] = [];

    for (const doc of docs) {
        const content = doc.pageContent;

        // Check if document has structured content
        const hasStructuredContent = content.includes('VISUAL ANALYSIS:') ||
            content.includes('TABLE:') ||
            doc.metadata.hasTables ||
            doc.metadata.hasCharts;

        if (hasStructuredContent) {
            // Use custom chunking for structured content
            const chunks = smartChunkStructuredContent(content, doc.metadata);
            chunkedDocs.push(...chunks);
        } else {
            // Use standard text splitter
            const textSplitter = createSmartTextSplitter();
            const chunks = await textSplitter.splitDocuments([doc]);
            chunkedDocs.push(...chunks);
        }
    }

    return chunkedDocs;
};

function smartChunkStructuredContent(content: string, metadata: any): Document[] {
    const chunks: Document[] = [];
    const sections = content.split('\n---\n');
    const MAX_CHUNK_SIZE = 1000; // Much smaller to ensure token limits

    let currentChunk = '';
    let chunkIndex = 0;

    for (const section of sections) {
        // If adding this section would exceed chunk size, create a new chunk
        if (currentChunk.length + section.length > MAX_CHUNK_SIZE && currentChunk.length > 0) {
            chunks.push(new Document({
                pageContent: currentChunk.trim(),
                metadata: {
                    ...metadata,
                    chunkIndex: chunkIndex++,
                    chunkType: detectChunkType(currentChunk)
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
            const subChunks = splitLargeChunk(currentChunk, MAX_CHUNK_SIZE, metadata, chunkIndex);
            chunks.push(...subChunks);
        } else {
            chunks.push(new Document({
                pageContent: currentChunk.trim(),
                metadata: {
                    ...metadata,
                    chunkIndex: chunkIndex++,
                    chunkType: detectChunkType(currentChunk)
                }
            }));
        }
    }

    return chunks;
}

function splitLargeChunk(content: string, maxSize: number, metadata: any, startIndex: number): Document[] {
    const chunks: Document[] = [];
    let chunkIndex = startIndex;

    // Try to split by sentences first
    const sentences = content.split(/[.!?]+\s+/);
    let currentChunk = '';

    for (const sentence of sentences) {
        const potentialChunk = currentChunk + (currentChunk ? '. ' : '') + sentence;

        if (potentialChunk.length > maxSize && currentChunk.length > 0) {
            chunks.push(new Document({
                pageContent: currentChunk.trim(),
                metadata: {
                    ...metadata,
                    chunkIndex: chunkIndex++,
                    chunkType: detectChunkType(currentChunk),
                    isSubChunk: true
                }
            }));
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
                chunks.push(new Document({
                    pageContent: chunk.trim(),
                    metadata: {
                        ...metadata,
                        chunkIndex: chunkIndex++,
                        chunkType: detectChunkType(chunk),
                        isSubChunk: true,
                        isForceSplit: true
                    }
                }));
            }
        } else {
            chunks.push(new Document({
                pageContent: currentChunk.trim(),
                metadata: {
                    ...metadata,
                    chunkIndex: chunkIndex++,
                    chunkType: detectChunkType(currentChunk),
                    isSubChunk: true
                }
            }));
        }
    }

    return chunks;
}

function detectChunkType(content: string): string {
    const lower = content.toLowerCase();
    if (lower.includes('visual analysis:')) return 'multimodal';
    if (lower.includes('table:')) return 'table';
    if (lower.includes('chart') || lower.includes('graph')) return 'chart';
    return 'text';
}
