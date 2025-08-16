import { createBrowserClient } from '@supabase/ssr'
import { clientSupabaseConfig } from './config'

export function createClient() {
    return createBrowserClient(
        clientSupabaseConfig.url,
        clientSupabaseConfig.publishableKey
    )
}
