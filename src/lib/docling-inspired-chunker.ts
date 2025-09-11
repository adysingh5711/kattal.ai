import { Document } from "langchain/document";
import { encoding_for_model } from "tiktoken";
import { env } from "./env";
import crypto from 'crypto';

/**
 * Docling-inspired HybridChunker for TypeScript/Node.js
 * Mimics the Python Docling HybridChunker behavior
 */

export interface TokenizerWrapper {
    encode(text: string): number[];
    decode(tokens: number[]): string;
    countTokens(text: string): number;
}

export class OpenAITokenizerWrapper implements TokenizerWrapper {
    private encoding;
    private modelName: string;

    constructor(modelName: string = "text-embedding-3-large") {
        this.modelName = modelName;
        // Map embedding models to appropriate tokenizer models
        const tokenizerModel = modelName.includes("3-large") || modelName.includes("3-small")
            ? "cl100k_base"
            : "cl100k_base"; // Default for most OpenAI models

        this.encoding = encoding_for_model(tokenizerModel as any);
    }

    encode(text: string): number[] {
        return Array.from(this.encoding.encode(text));
    }

    decode(tokens: number[]): string {
        return this.encoding.decode(new Uint8Array(tokens));
    }

    countTokens(text: string): number {
        return this.encoding.encode(text).length;
    }
}

export interface ChunkMetadata {
    filename?: string;
    pageNumbers?: number[];
    title?: string;
    headings?: string[];
    chunkIndex: number;
    totalChunks?: number;
    hasVisuals?: boolean;
    hasTables?: boolean;
    hasCharts?: boolean;
    contentTypes?: string[];
    chunkType?: 'text' | 'table' | 'heading' | 'list' | 'code';
    origin?: {
        filename?: string;
        source?: string;
    };
}

export interface DoclingChunk {
    text: string;
    metadata: ChunkMetadata;
}

export interface MarkdownElement {
    type: 'heading' | 'paragraph' | 'table' | 'list' | 'code' | 'blockquote';
    content: string;
    level?: number; // For headings
    rawContent: string;
    startIndex: number;
    endIndex: number;
}

export class HybridChunker {
    private tokenizer: TokenizerWrapper;
    private maxTokens: number;
    private mergePeers: boolean;
    private overlapTokens: number;
    private seenHashes: Set<string> = new Set(); // Global deduplication cache

    constructor(
        tokenizer?: TokenizerWrapper,
        maxTokens: number = 8191,
        mergePeers: boolean = true,
        overlapTokens: number = 100
    ) {
        this.tokenizer = tokenizer || new OpenAITokenizerWrapper(env.EMBEDDING_MODEL);
        this.maxTokens = maxTokens;
        this.mergePeers = mergePeers;
        this.overlapTokens = overlapTokens;
    }

    /**
     * Main chunking method that mimics Docling's HybridChunker
     */
    chunk(markdownContent: string, metadata: Partial<ChunkMetadata> = {}): DoclingChunk[] {
        console.log(`🔧 Starting Docling-inspired hybrid chunking...`);

        // Parse markdown into structured elements
        const elements = this.parseMarkdownStructure(markdownContent);
        console.log(`📋 Parsed ${elements.length} markdown elements`);

        // Create hierarchical chunks respecting document structure
        const hierarchicalChunks = this.createHierarchicalChunks(elements);
        console.log(`🏗️  Created ${hierarchicalChunks.length} hierarchical chunks`);

        // Apply token-aware refinements
        const tokenOptimizedChunks = this.optimizeChunksByTokens(hierarchicalChunks);
        console.log(`⚡ Optimized to ${tokenOptimizedChunks.length} token-aware chunks`);

        // Apply peer merging if enabled
        const finalChunks = this.mergePeers ? this.mergePeerChunks(tokenOptimizedChunks) : tokenOptimizedChunks;
        console.log(`🔗 Final result: ${finalChunks.length} chunks after peer merging`);

        // Apply deduplication and add metadata to chunks
        const deduplicatedChunks = finalChunks.filter((chunk, index) => {
            if (this.isDuplicateContent(chunk.content)) {
                console.log(`🔄 Skipping duplicate chunk ${index + 1} (content hash match)`);
                return false;
            }
            return true;
        });

        console.log(`📊 Deduplication results: ${finalChunks.length} → ${deduplicatedChunks.length} chunks (${finalChunks.length - deduplicatedChunks.length} duplicates removed)`);

        return deduplicatedChunks.map((chunk, index) => ({
            text: chunk.content,
            metadata: {
                ...metadata,
                chunkIndex: index,
                totalChunks: deduplicatedChunks.length,
                chunkType: chunk.type,
                headings: chunk.headings,
                contentHash: this.generateContentHash(chunk.content), // Add content hash to metadata
                ...chunk.metadata
            }
        }));
    }

    /**
     * Parse markdown content into structured elements
     * Mimics Docling's document structure analysis
     */
    private parseMarkdownStructure(content: string): MarkdownElement[] {
        const elements: MarkdownElement[] = [];
        const lines = content.split('\n');
        let currentIndex = 0;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const trimmed = line.trim();

            if (!trimmed) {
                currentIndex += line.length + 1;
                continue;
            }

            // Detect headings
            if (trimmed.startsWith('#')) {
                const level = trimmed.match(/^#+/)?.[0].length || 1;
                const content = trimmed.replace(/^#+\s*/, '');
                elements.push({
                    type: 'heading',
                    content,
                    level,
                    rawContent: line,
                    startIndex: currentIndex,
                    endIndex: currentIndex + line.length
                });
            }
            // Detect tables
            else if (trimmed.includes('|') && trimmed.split('|').length > 2) {
                const tableLines = [line];
                let j = i + 1;

                // Collect all table lines
                while (j < lines.length && lines[j].trim().includes('|')) {
                    tableLines.push(lines[j]);
                    j++;
                }

                elements.push({
                    type: 'table',
                    content: tableLines.join('\n'),
                    rawContent: tableLines.join('\n'),
                    startIndex: currentIndex,
                    endIndex: currentIndex + tableLines.join('\n').length
                });

                i = j - 1; // Skip processed lines
            }
            // Detect code blocks
            else if (trimmed.startsWith('```')) {
                const codeLines = [line];
                let j = i + 1;

                // Collect until closing ```
                while (j < lines.length && !lines[j].trim().startsWith('```')) {
                    codeLines.push(lines[j]);
                    j++;
                }

                if (j < lines.length) {
                    codeLines.push(lines[j]); // Include closing ```
                }

                elements.push({
                    type: 'code',
                    content: codeLines.join('\n'),
                    rawContent: codeLines.join('\n'),
                    startIndex: currentIndex,
                    endIndex: currentIndex + codeLines.join('\n').length
                });

                i = j; // Skip processed lines
            }
            // Detect lists
            else if (trimmed.match(/^[-*+]\s/) || trimmed.match(/^\d+\.\s/)) {
                const listLines = [line];
                let j = i + 1;

                // Collect consecutive list items
                while (j < lines.length &&
                    (lines[j].trim().match(/^[-*+]\s/) ||
                        lines[j].trim().match(/^\d+\.\s/) ||
                        lines[j].startsWith('  ') || // Indented continuation
                        lines[j].trim() === '')) {
                    listLines.push(lines[j]);
                    j++;
                }

                elements.push({
                    type: 'list',
                    content: listLines.join('\n'),
                    rawContent: listLines.join('\n'),
                    startIndex: currentIndex,
                    endIndex: currentIndex + listLines.join('\n').length
                });

                i = j - 1; // Skip processed lines
            }
            // Default to paragraph
            else {
                const paragraphLines = [line];
                let j = i + 1;

                // Collect until empty line or different element type
                while (j < lines.length &&
                    lines[j].trim() !== '' &&
                    !lines[j].trim().startsWith('#') &&
                    !lines[j].trim().includes('|') &&
                    !lines[j].trim().startsWith('```') &&
                    !lines[j].trim().match(/^[-*+]\s/) &&
                    !lines[j].trim().match(/^\d+\.\s/)) {
                    paragraphLines.push(lines[j]);
                    j++;
                }

                elements.push({
                    type: 'paragraph',
                    content: paragraphLines.join('\n'),
                    rawContent: paragraphLines.join('\n'),
                    startIndex: currentIndex,
                    endIndex: currentIndex + paragraphLines.join('\n').length
                });

                i = j - 1; // Skip processed lines
            }

            currentIndex += line.length + 1;
        }

        return elements;
    }

    /**
     * Create hierarchical chunks that respect document structure
     */
    private createHierarchicalChunks(elements: MarkdownElement[]): {
        content: string;
        type: ChunkMetadata['chunkType'];
        headings: string[];
        metadata: Partial<ChunkMetadata>;
    }[] {
        const chunks: {
            content: string;
            type: ChunkMetadata['chunkType'];
            headings: string[];
            metadata: Partial<ChunkMetadata>;
        }[] = [];

        let currentHeadings: string[] = [];
        let currentChunk = '';
        let currentType: ChunkMetadata['chunkType'] = 'text';

        for (const element of elements) {
            // Update heading context
            if (element.type === 'heading') {
                // Reset headings based on level
                const level = element.level || 1;
                currentHeadings = currentHeadings.slice(0, level - 1);
                currentHeadings[level - 1] = element.content;
            }

            // Determine if we should start a new chunk
            const shouldStartNewChunk = this.shouldStartNewChunk(currentChunk, element, currentType);

            if (shouldStartNewChunk && currentChunk.trim()) {
                chunks.push({
                    content: currentChunk.trim(),
                    type: currentType,
                    headings: [...currentHeadings],
                    metadata: this.extractElementMetadata(currentType, currentChunk)
                });
                currentChunk = '';
            }

            // Add element to current chunk
            currentChunk += (currentChunk ? '\n\n' : '') + element.rawContent;
            currentType = this.determineChunkType(element.type, currentType);
        }

        // Add final chunk
        if (currentChunk.trim()) {
            chunks.push({
                content: currentChunk.trim(),
                type: currentType,
                headings: [...currentHeadings],
                metadata: this.extractElementMetadata(currentType, currentChunk)
            });
        }

        return chunks;
    }

    /**
     * Optimize chunks based on token counts
     */
    private optimizeChunksByTokens(chunks: {
        content: string;
        type: ChunkMetadata['chunkType'];
        headings: string[];
        metadata: Partial<ChunkMetadata>;
    }[]): {
        content: string;
        type: ChunkMetadata['chunkType'];
        headings: string[];
        metadata: Partial<ChunkMetadata>;
    }[] {
        const optimizedChunks: typeof chunks = [];

        for (const chunk of chunks) {
            const tokenCount = this.tokenizer.countTokens(chunk.content);

            if (tokenCount <= this.maxTokens) {
                optimizedChunks.push(chunk);
            } else {
                // Split large chunk
                const splitChunks = this.splitLargeChunk(chunk);
                optimizedChunks.push(...splitChunks);
            }
        }

        return optimizedChunks;
    }

    /**
     * Merge peer chunks if they fit within token limits
     */
    private mergePeerChunks(chunks: {
        content: string;
        type: ChunkMetadata['chunkType'];
        headings: string[];
        metadata: Partial<ChunkMetadata>;
    }[]): typeof chunks {
        const mergedChunks: typeof chunks = [];
        let currentMergedChunk: typeof chunks[0] | null = null;

        for (const chunk of chunks) {
            if (!currentMergedChunk) {
                currentMergedChunk = { ...chunk };
                continue;
            }

            const combinedContent = currentMergedChunk.content + '\n\n' + chunk.content;
            const combinedTokens = this.tokenizer.countTokens(combinedContent);

            if (combinedTokens <= this.maxTokens && this.canMergeChunks(currentMergedChunk, chunk)) {
                // Merge chunks
                currentMergedChunk.content = combinedContent;
                currentMergedChunk.metadata = {
                    ...currentMergedChunk.metadata,
                    ...chunk.metadata,
                    hasTables: currentMergedChunk.metadata.hasTables || chunk.metadata.hasTables,
                    hasVisuals: currentMergedChunk.metadata.hasVisuals || chunk.metadata.hasVisuals,
                    hasCharts: currentMergedChunk.metadata.hasCharts || chunk.metadata.hasCharts
                };
            } else {
                // Cannot merge, push current and start new
                mergedChunks.push(currentMergedChunk);
                currentMergedChunk = { ...chunk };
            }
        }

        if (currentMergedChunk) {
            mergedChunks.push(currentMergedChunk);
        }

        return mergedChunks;
    }

    /**
     * Generate content hash for deduplication (same algorithm as old smart-chunker)
     */
    private generateContentHash(content: string): string {
        return crypto
            .createHash('sha256')
            .update(content.trim().toLowerCase())
            .digest('hex')
            .substring(0, 16); // Use first 16 chars for efficiency
    }

    /**
     * Check if content is duplicate and add to seen set
     */
    private isDuplicateContent(content: string): boolean {
        const hash = this.generateContentHash(content);
        if (this.seenHashes.has(hash)) {
            return true;
        }
        this.seenHashes.add(hash);
        return false;
    }

    /**
     * Reset deduplication cache (useful for new processing sessions)
     */
    public resetDeduplicationCache(): void {
        this.seenHashes.clear();
        console.log('🔄 Deduplication cache reset');
    }

    /**
     * Get deduplication statistics
     */
    public getDeduplicationStats(): { totalSeen: number; cacheSize: number } {
        return {
            totalSeen: this.seenHashes.size,
            cacheSize: this.seenHashes.size
        };
    }

    /**
     * Helper methods
     */
    private shouldStartNewChunk(
        currentChunk: string,
        element: MarkdownElement,
        currentType: ChunkMetadata['chunkType']
    ): boolean {
        // Always start new chunk for tables and code blocks
        if (element.type === 'table' || element.type === 'code') {
            return true;
        }

        // Start new chunk for high-level headings
        if (element.type === 'heading' && (element.level || 1) <= 2) {
            return true;
        }

        // Check token limit
        const potentialContent = currentChunk + '\n\n' + element.rawContent;
        const tokenCount = this.tokenizer.countTokens(potentialContent);

        return tokenCount > this.maxTokens;
    }

    private determineChunkType(
        elementType: MarkdownElement['type'],
        currentType: ChunkMetadata['chunkType']
    ): ChunkMetadata['chunkType'] {
        const typeMap: Record<MarkdownElement['type'], ChunkMetadata['chunkType']> = {
            'heading': 'heading',
            'table': 'table',
            'code': 'code',
            'list': 'list',
            'paragraph': 'text',
            'blockquote': 'text'
        };

        return typeMap[elementType] || 'text';
    }

    private extractElementMetadata(type: ChunkMetadata['chunkType'], content: string): Partial<ChunkMetadata> {
        return {
            hasTables: type === 'table' || content.includes('|'),
            hasVisuals: content.toLowerCase().includes('image') || content.includes('!['),
            hasCharts: content.toLowerCase().includes('chart') || content.toLowerCase().includes('graph'),
            contentTypes: [type === 'table' ? 'tables' : type === 'code' ? 'code' : 'text']
        };
    }

    private canMergeChunks(chunk1: any, chunk2: any): boolean {
        // Don't merge different content types
        if (chunk1.type !== chunk2.type &&
            (chunk1.type === 'table' || chunk2.type === 'table' ||
                chunk1.type === 'code' || chunk2.type === 'code')) {
            return false;
        }

        // Can merge if under same heading context
        return JSON.stringify(chunk1.headings) === JSON.stringify(chunk2.headings);
    }

    private splitLargeChunk(chunk: {
        content: string;
        type: ChunkMetadata['chunkType'];
        headings: string[];
        metadata: Partial<ChunkMetadata>;
    }): typeof chunk[] {
        const chunks: typeof chunk[] = [];
        const sentences = chunk.content.split(/(?<=[.!?])\s+/);
        let currentContent = '';

        for (const sentence of sentences) {
            const potentialContent = currentContent + (currentContent ? ' ' : '') + sentence;
            const tokenCount = this.tokenizer.countTokens(potentialContent);

            if (tokenCount > this.maxTokens && currentContent) {
                chunks.push({
                    ...chunk,
                    content: currentContent.trim()
                });
                currentContent = sentence;
            } else {
                currentContent = potentialContent;
            }
        }

        if (currentContent.trim()) {
            chunks.push({
                ...chunk,
                content: currentContent.trim()
            });
        }

        return chunks.length > 0 ? chunks : [chunk];
    }
}

/**
 * Utility function to convert DoclingChunks to LangChain Documents
 */
export function convertToLangChainDocuments(
    chunks: DoclingChunk[],
    sourceFile: string
): Document[] {
    return chunks.map(chunk => new Document({
        pageContent: chunk.text,
        metadata: {
            source: sourceFile,
            ...chunk.metadata,
            origin: {
                filename: sourceFile,
                source: sourceFile
            }
        }
    }));
}
