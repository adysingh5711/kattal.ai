import { env } from './env';
import { OpenAIEmbeddings } from "@langchain/openai";
import { PineconeStore } from "@langchain/pinecone";
import { Pinecone } from "@pinecone-database/pinecone";
import { Document } from 'langchain/document';

export async function embedAndStoreDocs(
    client: Pinecone,
    docs: Document<Record<string, unknown>>[]
) {
    /*create and store the embeddings in the vectorStore with batch processing*/
    try {
        const embeddings = new OpenAIEmbeddings({
            openAIApiKey: env.OPENAI_API_KEY,
            modelName: env.EMBEDDING_MODEL,
            dimensions: env.EMBEDDING_DIMENSIONS,
        });
        const index = client.Index(env.PINECONE_INDEX_NAME);

        // Process documents individually to avoid token limits
        const MAX_TOKENS_PER_DOC = 1000; // Very conservative limit (≈285 tokens)

        // Stream processing: process documents one by one to avoid memory issues
        console.log('Starting streaming document processing...');

        let processedCount = 0;
        let successCount = 0;

        for (let i = 0; i < docs.length; i++) {
            const doc = docs[i];
            processedCount++;

            try {
                // Pre-process individual document to ensure token limits
                const processedDocs = await processAllDocsWithTokenLimit([doc], MAX_TOKENS_PER_DOC);

                // Process each chunk from this document
                for (const processedDoc of processedDocs) {
                    try {
                        await PineconeStore.fromDocuments([processedDoc], embeddings, {
                            pineconeIndex: index,
                            textKey: 'text',
                        });
                        successCount++;

                        // Small delay to avoid rate limits
                        await new Promise(resolve => setTimeout(resolve, 200));

                    } catch (chunkError) {
                        console.error(`Failed to process chunk from document ${i + 1}:`, chunkError);
                    }
                }

                console.log(`Processed document ${processedCount}/${docs.length} (${successCount} chunks embedded)`);

            } catch (docError) {
                console.error(`Failed to process document ${i + 1}:`, docError);
            }
        }

        console.log(`Streaming complete: ${successCount} chunks successfully embedded from ${processedCount} documents`);
    } catch (error) {
        console.log('error ', error);
        throw new Error('Failed to load your docs !');
    }
}

async function processAllDocsWithTokenLimit(
    docs: Document<Record<string, unknown>>[],
    maxTokens: number
): Promise<Document<Record<string, unknown>>[]> {
    const processedDocs: Document<Record<string, unknown>>[] = [];

    for (const doc of docs) {
        // Very conservative token estimation (1 token ≈ 3 characters)
        const estimatedTokens = doc.pageContent.length / 3;

        if (estimatedTokens > maxTokens) {
            // Split large documents very aggressively
            const chunks = splitLargeDocument(doc, maxTokens);
            processedDocs.push(...chunks);
        } else {
            processedDocs.push(doc);
        }
    }

    return processedDocs;
}

function splitLargeDocument(
    doc: Document<Record<string, unknown>>,
    maxTokens: number
): Document<Record<string, unknown>>[] {
    const maxChars = Math.floor(maxTokens * 3); // Very conservative conversion
    const content = doc.pageContent;
    const chunks: Document<Record<string, unknown>>[] = [];

    // Split by sentences first to maintain readability
    const sentences = content.split(/[.!?]+\s+/);
    let currentChunk = '';
    let chunkIndex = 0;

    for (const sentence of sentences) {
        const potentialChunk = currentChunk + (currentChunk ? '. ' : '') + sentence;

        if (potentialChunk.length > maxChars && currentChunk.length > 0) {
            // Create chunk from current content
            chunks.push(new Document({
                pageContent: currentChunk.trim(),
                metadata: {
                    ...doc.metadata,
                    chunkIndex: chunkIndex++,
                    isSubChunk: true,
                    originalLength: content.length
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
        if (currentChunk.length > maxChars) {
            for (let i = 0; i < currentChunk.length; i += maxChars) {
                const chunk = currentChunk.slice(i, i + maxChars);
                chunks.push(new Document({
                    pageContent: chunk.trim(),
                    metadata: {
                        ...doc.metadata,
                        chunkIndex: chunkIndex++,
                        isSubChunk: true,
                        isForceSplit: true,
                        originalLength: content.length
                    }
                }));
            }
        } else {
            chunks.push(new Document({
                pageContent: currentChunk.trim(),
                metadata: {
                    ...doc.metadata,
                    chunkIndex: chunkIndex++,
                    isSubChunk: true,
                    originalLength: content.length
                }
            }));
        }
    }

    return chunks;
}



// Returns vector-store handle to be used a retrievers on langchains
export async function getVectorStore(client: Pinecone) {
    try {
        const embeddings = new OpenAIEmbeddings({
            openAIApiKey: env.OPENAI_API_KEY,
            modelName: env.EMBEDDING_MODEL,
            dimensions: env.EMBEDDING_DIMENSIONS,
        });
        const index = client.Index(env.PINECONE_INDEX_NAME);

        const vectorStore = await PineconeStore.fromExistingIndex(embeddings, {
            pineconeIndex: index,
            textKey: 'text',
        });

        return vectorStore;
    } catch (error) {
        console.log('error ', error);
        throw new Error('Something went wrong while getting vector store !');
    }
}