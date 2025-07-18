import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
    OPENAI_API_KEY: z.string().trim().min(1, 'OPENAI_API_KEY is required'),
    OPENROUTER_API_KEY: z.string().trim().min(1, 'OPENROUTER_API_KEY is required'),
    AWS_API_KEY: z.string().trim().min(1, 'AWS_API_KEY is required'),
    PINECONE_API_KEY: z.string().trim().min(1, 'PINECONE_API_KEY is required'),
    PINECONE_ENVIRONMENT: z.string().trim().min(1, 'PINECONE_ENVIRONMENT is required'),
    PINECONE_INDEX_NAME: z.string().trim().min(1, 'PINECONE_INDEX_NAME is required'),
    PDF_PATH: z.string().trim().min(1, 'PDF_PATH is required'),
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
