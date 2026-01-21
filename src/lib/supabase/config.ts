import { env } from '@/lib/env';

// Server-side function to get Supabase configuration
// Uses public Supabase URL for auth operations (DATABASE_URL is for direct DB access only)
export function getSupabaseConfig() {
    return {
        url: env.NEXT_PUBLIC_SUPABASE_URL, // Public Supabase URL for auth
        publishableKey: env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY,
    };
}

// Client-side configuration - uses only public environment variables
export const clientSupabaseConfig = {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL!, // Public Supabase project URL
    publishableKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!,
};

// Server-side configuration - can access all environment variables
export const serverSupabaseConfig = {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL!, // Use public Supabase URL for auth
    publishableKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!,
};
