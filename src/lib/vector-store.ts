import { env } from './env';
import { PineconeStore } from "@langchain/pinecone";
import { Pinecone } from "@pinecone-database/pinecone";
import type { Document } from 'langchain/document';
import crypto from 'crypto';

export async function embedAndStoreDocs(
    client: Pinecone,
    docs: Document<Record<string, unknown>>[]
) {
    try {
        // Using Ollama embeddings for local processing
        const { OllamaEmbeddings } = await import("@langchain/community/embeddings/ollama");

        const embeddings = new OllamaEmbeddings({
            model: env.EMBEDDING_MODEL || "bge-m3:567m",
            baseUrl: "http://localhost:11434",
        });

        // De-duplicate by normalized content hash
        const uniqueDocs = dedupeByContent(docs);
        console.log(`Deduped ${docs.length - uniqueDocs.length} duplicate chunks`);

        const index = client.Index(env.PINECONE_INDEX_NAME);

        await PineconeStore.fromDocuments(uniqueDocs, embeddings, {
            pineconeIndex: index,
            textKey: 'text',
        });
    } catch (error) {
        console.log('error ', error);
        throw new Error('Failed to load your docs !');
    }
}

function dedupeByContent(docs: Document<Record<string, unknown>>[]) {
    const seen = new Set<string>();
    const out: typeof docs = [];
    for (const d of docs) {
        const text = (d.pageContent || '').trim().replace(/\s+/g, ' ');
        const hash = crypto.createHash('sha256').update(text).digest('hex');
        if (!seen.has(hash)) {
            seen.add(hash);
            out.push(d);
        }
    }
    return out;
}

export async function getVectorStore(client: Pinecone) {
    try {
        // Using Ollama embeddings for local processing
        const { OllamaEmbeddings } = await import("@langchain/community/embeddings/ollama");

        const embeddings = new OllamaEmbeddings({
            model: env.EMBEDDING_MODEL || "bge-m3:567m",
            baseUrl: "http://localhost:11434",
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

// This function is now redundant as the main embedAndStoreDocs uses Ollama
// Keeping it for backward compatibility
export const embedAndStoreDocsOllama = embedAndStoreDocs;