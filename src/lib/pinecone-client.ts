import { Pinecone } from "@pinecone-database/pinecone";
import { env } from "./env";
import { delay } from "./utils";

let pineconeInstance: Pinecone | null = null;

// Create pineconeIndex if it doesn't exist
async function createIndex(client: Pinecone, indexName: string) {
    try {
        await client.createIndex({
            name: indexName,
            dimension: 1024, // bge-m3:567m embedding dimension
            metric: "cosine",
            spec: {
                serverless: {
                    cloud: 'aws',
                    region: 'us-east-1'
                }
            }
        });
        console.log(`Waiting for ${env.INDEX_INIT_TIMEOUT} ms for index initialization to complete...`);
        await delay(env.INDEX_INIT_TIMEOUT);
        console.log("Index created !!");
    } catch (error) {
        console.error("error ", error);
        throw new Error("Index creation failed");
    }
}

// Initialize index and ready to be accessed.
async function initPinecone() {
    try {
        const pinecone = new Pinecone({
            apiKey: env.PINECONE_API_KEY,
        });
        const indexName = env.PINECONE_INDEX_NAME;

        const existingIndexes = await pinecone.listIndexes();
        const indexNames = existingIndexes.indexes?.map(index => index.name) || [];

        if (!indexNames.includes(indexName)) {
            await createIndex(pinecone, indexName);
        } else {
            console.log("Your index already exists. nice !!");
        }

        return pinecone;
    } catch (error) {
        console.error("error", error);
        throw new Error("Failed to initialize Pinecone Client");
    }
}

export async function getPinecone() {
    if (!pineconeInstance) {
        pineconeInstance = await initPinecone();
    }

    return pineconeInstance;
}