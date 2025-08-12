import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { Document } from "langchain/document";

export const createSmartTextSplitter = () => {
    return new RecursiveCharacterTextSplitter({
        chunkSize: 2000, // Larger chunks for multimodal content
        chunkOverlap: 400, // More overlap for context preservation
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

    let currentChunk = '';
    let chunkIndex = 0;

    for (const section of sections) {
        // If adding this section would exceed chunk size, create a new chunk
        if (currentChunk.length + section.length > 2000 && currentChunk.length > 0) {
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
        chunks.push(new Document({
            pageContent: currentChunk.trim(),
            metadata: {
                ...metadata,
                chunkIndex: chunkIndex++,
                chunkType: detectChunkType(currentChunk)
            }
        }));
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
