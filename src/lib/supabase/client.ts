import { createBrowserClient } from '@supabase/ssr'
import { clientSupabaseConfig } from './config'

export function createClient() {
    return createBrowserClient(
        clientSupabaseConfig.url,
        clientSupabaseConfig.publishableKey,
        {
            auth: {
                // Token expiration & refresh configuration
                // JWT expiry is set to 7 days in Supabase Dashboard → Authentication → Settings
                // The client will automatically refresh the token before it expires
                autoRefreshToken: true,
                persistSession: true,
                detectSessionInUrl: true,
            },
        }
    )
}
