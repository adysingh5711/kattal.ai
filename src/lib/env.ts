// src/lib/env.ts (or wherever)
import dotenv from "dotenv";
import { z } from "zod";
dotenv.config();

export const envSchema = z.object({
    OPENAI_API_KEY: z.string().trim().optional(),
    OPENROUTER_API_KEY: z.string().trim().optional(),
    AWS_API_KEY: z.string().trim().min(1, "AWS_API_KEY is required"),
    PINECONE_API_KEY: z.string().trim().min(1, "PINECONE_API_KEY is required"),
    PINECONE_ENVIRONMENT: z.string().trim().min(1, "PINECONE_ENVIRONMENT is required"),
    PINECONE_INDEX_NAME: z.string().trim().min(1, "PINECONE_INDEX_NAME is required"),
    PDF_PATH: z.string().trim().min(1, "PDF_PATH is required"),
    DOCX_PATH: z.string().trim().optional(),
    EMBEDDING_MODEL: z.string().trim().optional(),
    INDEX_INIT_TIMEOUT: z.coerce.number().min(1, "INDEX_INIT_TIMEOUT must be > 0"),

    // LLM provider-agnostic variables:
    LLM_PROVIDER: z.string().trim().optional(), // e.g. "openrouter" or "openai"
    LLM_MODEL: z.string().trim().optional(),    // e.g. "qwen-7b-chat" or "gpt-4o-mini"
});

export const env = (() => {
    try {
        return envSchema.parse(process.env);
    } catch (error) {
        console.error("❌ Invalid environment variables:", error);
        process.exit(1);
    }
})();
