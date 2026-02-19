import { z } from 'zod';

/*
ENVIRONMENT VARIABLES — PUBLIC USAGE
====================================
App is designed for public deployment: anyone can use it. No user GCP login.

For Gemini (public API): set GEMINI_API_KEY only (from https://aistudio.google.com/apikey).
Do NOT set GOOGLE_CLOUD_PROJECT / GOOGLE_CLOUD_LOCATION in production unless you run
on your own GCP with a service account.

Vercel (Vertex AI): Do NOT set GOOGLE_APPLICATION_CREDENTIALS to a file path (it won't exist).
Instead set GOOGLE_APPLICATION_CREDENTIALS_JSON to the full contents of your service account
JSON (paste the whole file in Vercel env). The app writes it to a temp file at runtime; the
value is server-only and never exposed to the client.

🚫 NEVER EXPOSE TO CLIENT (Server-side only):
- DATABASE_URL, OPENAI_API_KEY, PINECONE_API_KEY, GEMINI_API_KEY, other API keys

✅ SAFE FOR CLIENT: NEXT_PUBLIC_* only.

🔒 PRODUCTION: Set secrets in your host (e.g. Vercel). Do not commit .env.
*/

// Environment variables schema
const envSchema = z.object({
    NODE_ENV: z.enum(['development', 'production', 'test']).optional().default('development'),

    // LLM (main RAG pipeline)
    LLM_PROVIDER: z.string().trim().min(1, 'LLM_PROVIDER is required'),
    LLM_MODEL: z.string().trim().min(1, 'LLM_MODEL is required'),

    // API keys
    OPENAI_API_KEY: z.string().trim().min(1, 'OPENAI_API_KEY is required'),
    OPENROUTER_API_KEY: z.string().trim().min(1, 'OPENROUTER_API_KEY is required').optional(),
    PINECONE_API_KEY: z.string().trim().min(1, 'PINECONE_API_KEY is required'),
    AWS_API_KEY: z.string().trim().min(1, 'AWS_API_KEY is required').optional(),

    // --- Public Gemini (for everyone; no GCP login) ---
    /** Gemini API key from https://aistudio.google.com/apikey — set this for public usage. */
    GEMINI_API_KEY: z.string().trim().min(1).optional(),
    /** Alias for GEMINI_API_KEY. */
    GOOGLE_CLOUD_API_KEY: z.string().trim().min(1).optional(),
    /** Model for Gemini, e.g. gemini-2.0-flash. Optional. */
    GEMINI_GROUNDING_MODEL: z.string().trim().min(1).optional(),

    // --- Optional: Vertex AI (Vercel: use GOOGLE_APPLICATION_CREDENTIALS_JSON, not a file path) ---
    GOOGLE_CLOUD_PROJECT: z.string().trim().min(1).optional(),
    GOOGLE_CLOUD_LOCATION: z.string().trim().min(1).optional(),
    /** Full service account JSON string (for Vercel). Never logged or exposed. */
    GOOGLE_APPLICATION_CREDENTIALS_JSON: z.string().trim().min(1).optional(),
    VERTEX_MODEL_ID: z.string().trim().min(1).optional(),
    VERTEX_AI_FILE_SEARCH_STORE_NAMES: z.string().trim().min(1).optional(),
    VERTEX_RAG_CORPUS: z.string().trim().min(1).optional(),

    // Supabase Configuration
    DATABASE_URL: z.string().trim().min(1, 'DATABASE_URL is required'),
    NEXT_PUBLIC_SUPABASE_URL: z.string().trim().min(1, 'NEXT_PUBLIC_SUPABASE_URL is required'),
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY: z.string().trim().min(1, 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY is required'),

    // Site Configuration
    NEXT_PUBLIC_SITE_URL: z.string().url('NEXT_PUBLIC_SITE_URL must be a valid URL').optional(),

    // Pinecone
    PINECONE_ENVIRONMENT: z.string().trim().min(1, 'PINECONE_ENVIRONMENT is required'),
    PINECONE_INDEX_NAME: z.string().trim().min(1, 'PINECONE_INDEX_NAME is required'),

    // Embeddings
    EMBEDDING_MODEL: z.string().trim().min(1, 'EMBEDDING_MODEL is required'),
    EMBEDDING_DIMENSIONS: z.coerce.number().min(1, 'EMBEDDING_DIMENSIONS must be a number > 0'),

    // Document paths
    PDF_PATH: z.string().trim().min(1, 'PDF_PATH is required').optional(),
    DOCX_PATH: z.string().trim().min(1, 'DOCX_PATH is required').optional(),
    DOC_PATH: z.string().trim().min(1, 'DOC_PATH is required').optional(),
    MARKDOWN_PATH: z.string().trim().min(1, 'MARKDOWN_PATH is required'),

    // Timing
    INDEX_INIT_TIMEOUT: z.coerce.number().min(1, 'INDEX_INIT_TIMEOUT must be a number > 0'),

    // Pinecone Configuration
    PINECONE_NAMESPACE: z.string().trim().min(1, 'PINECONE_NAMESPACE is required').optional(),

    // Search Configuration
    DEFAULT_SEARCH_K: z.coerce.number().min(1, 'DEFAULT_SEARCH_K must be a number > 0').optional(),

    // Chunking Configuration
    CHUNK_SIZE: z.coerce.number().min(100, 'CHUNK_SIZE must be at least 100').optional(),
    CHUNK_OVERLAP: z.coerce.number().min(0, 'CHUNK_OVERLAP must be non-negative').optional(),
});

// Environment validation - only on server side
export const env = (() => {
    // If running on client side, return empty object to prevent validation errors
    if (typeof window !== 'undefined') {
        return {} as z.infer<typeof envSchema>;
    }

    try {
        const parsedEnv = envSchema.parse(process.env);

        // Apply hardcoded defaults for optional values and ensure types are correct
        const result = {
            ...parsedEnv,
            PINECONE_NAMESPACE: parsedEnv.PINECONE_NAMESPACE ?? '', // Empty string = default namespace (single namespace strategy)
            DEFAULT_SEARCH_K: parsedEnv.DEFAULT_SEARCH_K ?? 5,
            CHUNK_SIZE: parsedEnv.CHUNK_SIZE ?? 1000,
            CHUNK_OVERLAP: parsedEnv.CHUNK_OVERLAP ?? 150,
        };

        // Return with explicit non-optional types for the defaults we applied
        return result as Omit<typeof result, 'PINECONE_NAMESPACE' | 'DEFAULT_SEARCH_K' | 'CHUNK_SIZE' | 'CHUNK_OVERLAP'> & {
            PINECONE_NAMESPACE: string;
            DEFAULT_SEARCH_K: number;
            CHUNK_SIZE: number;
            CHUNK_OVERLAP: number;
        };
    } catch (error) {
        console.error('❌ Invalid environment variables. Check your .env file.');
        throw new Error('Invalid environment variables');
    }
})();
