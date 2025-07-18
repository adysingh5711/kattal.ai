import { env } from './env';
import { HuggingFaceTransformersEmbeddings } from "@langchain/community/embeddings/hf_transformers";
import { PineconeStore } from "@langchain/pinecone";
import { Pinecone } from "@pinecone-database/pinecone";
import type { Document } from 'langchain/document';

// Alternative: Use Sentence Transformers for multilingual support
export async function embedAndStoreDocs(
    client: Pinecone,
    docs: Document<Record<string, unknown>>[]
) {
    try {
        // Option 1: Local multilingual model (best for your use case)
        const embeddings = new HuggingFaceTransformersEmbeddings({
            modelName: "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2",
            // This model supports 50+ languages including English and Malayalam
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
        const embeddings = new HuggingFaceTransformersEmbeddings({
            modelName: "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2",
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

// Alternative Option 2: Use Ollama for local embeddings
export async function embedAndStoreDocsOllama(
    client: Pinecone,
    docs: Document<Record<string, unknown>>[]
) {
    try {
        // Requires Ollama running locally with nomic-embed-text model
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