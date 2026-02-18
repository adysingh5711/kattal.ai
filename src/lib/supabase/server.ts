import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { serverSupabaseConfig } from './config'

export async function createClient() {
    const cookieStore = await cookies()

    return createServerClient(
        serverSupabaseConfig.url,
        serverSupabaseConfig.publishableKey,
        {
            auth: {
                // Token refresh: ensures server-side also refreshes tokens
                autoRefreshToken: true,
                persistSession: true,
            },
            cookies: {
                getAll() {
                    return cookieStore.getAll()
                },
                setAll(cookiesToSet) {
                    try {
                        cookiesToSet.forEach(({ name, value, options }) =>
                            cookieStore.set(name, value, options)
                        )
                    } catch {
                        // The `setAll` method was called from a Server Component.
                        // This can be ignored if you have middleware refreshing
                        // user sessions.
                    }
                },
            },
        }
    )
}
