import { Pinecone } from "@pinecone-database/pinecone";
import { env } from "../lib/env";

// Script to delete the existing Pinecone index
(async () => {
    try {
        console.log(`Attempting to delete Pinecone index: ${env.PINECONE_INDEX_NAME}`);

        const pinecone = new Pinecone({
            apiKey: env.PINECONE_API_KEY,
        });

        const existingIndexes = await pinecone.listIndexes();
        const indexNames = existingIndexes.indexes?.map(index => index.name) || [];

        if (indexNames.includes(env.PINECONE_INDEX_NAME)) {
            console.log(`Found index ${env.PINECONE_INDEX_NAME}, deleting...`);
            await pinecone.deleteIndex(env.PINECONE_INDEX_NAME);
            console.log(`Successfully deleted index ${env.PINECONE_INDEX_NAME}`);
        } else {
            console.log(`Index ${env.PINECONE_INDEX_NAME} not found, nothing to delete.`);
        }
    } catch (error) {
        console.error("Error deleting Pinecone index:", error);
    }
})();