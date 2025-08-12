import { Pinecone } from "@pinecone-database/pinecone";
import { env } from "../lib/env";

(async () => {
    try {
        const pc = new Pinecone({ apiKey: env.PINECONE_API_KEY });
        const index = pc.Index(env.PINECONE_INDEX_NAME);

        // Delete all vectors in the default namespace
        console.log(`Clearing all vectors in index "${env.PINECONE_INDEX_NAME}" (namespace "__default__")...`);
        await index.namespace('').deleteAll();
        console.log("Cleared.");
    } catch (e) {
        console.error("Failed to clear data:", e);
        process.exit(1);
    }
})();
