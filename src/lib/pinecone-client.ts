import { Pinecone } from "@pinecone-database/pinecone";
import { env } from "./env";
import { delay } from "./utils";

let pineconeInstance: Pinecone | null = null;

function parsePineconeEnv(envStr: string): { cloud: 'aws' | 'gcp' | 'azure'; region: string } {
    // Examples: 'us-east-1-aws', 'us-west4-gcp-free'
    let cloud: 'aws' | 'gcp' | 'azure' = 'aws';
    let region = 'us-east-1';

    const cleaned = envStr.replace(/-free$/, '');
    const parts = cleaned.split('-');
    const last = parts[parts.length - 1];

    if (last === 'aws' || last === 'gcp' || last === 'azure') {
        cloud = last as any;
        region = parts.slice(0, parts.length - 1).join('-');
    } else {
        region = cleaned;
    }

    return { cloud, region };
}

// Create pineconeIndex if it doesn't exist
async function createIndex(client: Pinecone, indexName: string) {
    try {
        const { cloud, region } = parsePineconeEnv(env.PINECONE_ENVIRONMENT);
        await client.createIndex({
            name: indexName,
            dimension: env.EMBEDDING_DIMENSIONS, // Match embedding dims
            metric: "cosine",
            spec: {
                serverless: {
                    cloud,
                    region
                }
            }
        });
        console.log(
            `Waiting for ${env.INDEX_INIT_TIMEOUT} seconds for index initialization to complete...`
        );
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