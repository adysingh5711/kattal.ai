import { env } from './env';
import { PineconeStore } from "@langchain/pinecone";
import { Pinecone } from "@pinecone-database/pinecone";
import type { Document } from 'langchain/document';

export async function embedAndStoreDocs(
    client: Pinecone,
    docs: Document<Record<string, unknown>>[]
) {
    try {
        // Using Ollama embeddings for local processing
        const { OllamaEmbeddings } = await import("@langchain/community/embeddings/ollama");

        const embeddings = new OllamaEmbeddings({
            model: "nomic-embed-text", // Good for multilingual content
            baseUrl: "http://localhost:11434", // Default Ollama URL
        });

        const index = client.Index(env.PINECONE_INDEX_NAME);

        await PineconeStore.fromDocuments(docs, embeddings, {
            pineconeIndex: index,
            textKey: 'text',
        });
    } catch (error) {
        console.log('error ', error);
        throw new Error('Failed to load your docs !');
    }
}

export async function getVectorStore(client: Pinecone) {
    try {
        // Using Ollama embeddings for local processing
        const { OllamaEmbeddings } = await import("@langchain/community/embeddings/ollama");

        const embeddings = new OllamaEmbeddings({
            model: "nomic-embed-text", // Good for multilingual content
            baseUrl: "http://localhost:11434", // Default Ollama URL
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