import { env } from "@/lib/env";

console.log("🧪 Simple Test Script");
console.log("=".repeat(30));

console.log("Environment variables:");
console.log(`EMBEDDING_MODEL: ${env.EMBEDDING_MODEL}`);
console.log(`EMBEDDING_DIMENSIONS: ${env.EMBEDDING_DIMENSIONS}`);
console.log(`LLM_MODEL: ${env.LLM_MODEL}`);

console.log("✅ Test completed successfully!");
