import { env } from './env';
import { OpenAIEmbeddings } from "@langchain/openai";
import { PineconeStore } from "@langchain/pinecone";
import { Pinecone } from "@pinecone-database/pinecone";
import type { Document } from 'langchain/document';

export async function embedAndStoreDocs(
    client: Pinecone,
    docs: Document<Record<string, unknown>>[]
) {
    /*create and store the embeddings in the vectorStore*/
    try {
        const embeddings = new OpenAIEmbeddings({
            openAIApiKey: env.OPENAI_API_KEY,
            modelName: "text-embedding-3-large", // Better multilingual support
            dimensions: 3072, // Higher dimensional embeddings
        });
        const index = client.Index(env.PINECONE_INDEX_NAME);

        //embed the PDF documents
        await PineconeStore.fromDocuments(docs, embeddings, {
            pineconeIndex: index,
            textKey: 'text',
        });
    } catch (error) {
        console.log('error ', error);
        throw new Error('Failed to load your docs !');
    }
}

// Returns vector-store handle to be used a retrievers on langchains
export async function getVectorStore(client: Pinecone) {
    try {
        const embeddings = new OpenAIEmbeddings({
            openAIApiKey: env.OPENAI_API_KEY,
            modelName: "text-embedding-3-large",
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