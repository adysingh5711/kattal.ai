import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
    // LLM provider/model
    LLM_PROVIDER: z.string().trim().min(1, 'LLM_PROVIDER is required'),
    LLM_MODEL: z.string().trim().min(1, 'LLM_MODEL is required'),

    // API keys
    OPENAI_API_KEY: z.string().trim().min(1, 'OPENAI_API_KEY is required'),
    OPENROUTER_API_KEY: z.string().trim().min(1, 'OPENROUTER_API_KEY is required'),
    PINECONE_API_KEY: z.string().trim().min(1, 'PINECONE_API_KEY is required'),
    AWS_API_KEY: z.string().trim().min(1, 'AWS_API_KEY is required'),

    // Pinecone
    PINECONE_ENVIRONMENT: z.string().trim().min(1, 'PINECONE_ENVIRONMENT is required'),
    PINECONE_INDEX_NAME: z.string().trim().min(1, 'PINECONE_INDEX_NAME is required'),

    // Embeddings
    EMBEDDING_MODEL: z.string().trim().min(1, 'EMBEDDING_MODEL is required'),
    EMBEDDING_DIMENSIONS: z.coerce.number().min(1, 'EMBEDDING_DIMENSIONS must be a number > 0'),

    // Document paths
    PDF_PATH: z.string().trim().min(1, 'PDF_PATH is required'),
    DOCX_PATH: z.string().trim().min(1, 'DOCX_PATH is required'),
    DOC_PATH: z.string().trim().min(1, 'DOC_PATH is required'),

    // Timing
    INDEX_INIT_TIMEOUT: z.coerce.number().min(1, 'INDEX_INIT_TIMEOUT must be a number > 0'),
});

export const env = (() => {
    try {
        return envSchema.parse(process.env);
    } catch (error) {
        console.error('❌ Invalid environment variables:', error);
        process.exit(1); // crash fast in development/build
    }
})();
