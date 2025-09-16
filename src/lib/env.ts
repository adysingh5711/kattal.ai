import dotenv from 'dotenv';
import { z } from 'zod';

// Only load dotenv on server side
if (typeof window === 'undefined') {
    dotenv.config();
}

/*
ENVIRONMENT VARIABLES SECURITY GUIDE:
====================================

🚫 NEVER EXPOSE TO CLIENT (Server-side only):
- DATABASE_URL: Contains sensitive database connection string
- OPENAI_API_KEY: Contains API secrets
- PINECONE_API_KEY: Contains API secrets
- AWS_API_KEY: Contains API secrets
- Other API keys and sensitive credentials

✅ SAFE FOR CLIENT (Can be exposed):
- NEXT_PUBLIC_SUPABASE_URL: Public Supabase project URL
- NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: Public anonymous key
- Any variable prefixed with NEXT_PUBLIC_

⚠️  IMPORTANT: DATABASE_URL ≠ NEXT_PUBLIC_SUPABASE_URL
   - DATABASE_URL: postgresql://user:pass@host:port/db (SENSITIVE!)
   - NEXT_PUBLIC_SUPABASE_URL: https://project.supabase.co (PUBLIC)
*/

// Environment variables schema
const envSchema = z.object({
    // Node environment
    NODE_ENV: z.enum(['development', 'production', 'test']).optional().default('development'),

    // LLM provider/model
    LLM_PROVIDER: z.string().trim().min(1, 'LLM_PROVIDER is required'),
    LLM_MODEL: z.string().trim().min(1, 'LLM_MODEL is required'),

    // API keys
    OPENAI_API_KEY: z.string().trim().min(1, 'OPENAI_API_KEY is required'),
    OPENROUTER_API_KEY: z.string().trim().min(1, 'OPENROUTER_API_KEY is required'),
    PINECONE_API_KEY: z.string().trim().min(1, 'PINECONE_API_KEY is required'),
    AWS_API_KEY: z.string().trim().min(1, 'AWS_API_KEY is required'),

    // Supabase Configuration
    DATABASE_URL: z.string().trim().min(1, 'DATABASE_URL is required'),
    NEXT_PUBLIC_SUPABASE_URL: z.string().trim().min(1, 'NEXT_PUBLIC_SUPABASE_URL is required'),
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().trim().min(1, 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is required'),

    // Site Configuration
    NEXT_PUBLIC_SITE_URL: z.string().url('NEXT_PUBLIC_SITE_URL must be a valid URL').optional(),

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
    MARKDOWN_PATH: z.string().trim().min(1, 'MARKDOWN_PATH is required'),

    // Timing
    INDEX_INIT_TIMEOUT: z.coerce.number().min(1, 'INDEX_INIT_TIMEOUT must be a number > 0'),
});

// Environment validation - only on server side
export const env = (() => {
    // If running on client side, return empty object to prevent validation errors
    if (typeof window !== 'undefined') {
        return {} as z.infer<typeof envSchema>;
    }

    try {
        return envSchema.parse(process.env);
    } catch (error) {
        console.error('❌ Invalid environment variables:', error);
        throw new Error('Invalid environment variables');
    }
})();
