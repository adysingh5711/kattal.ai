import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { env } from "@/lib/env";

export async function GET() {
    const supabase = await createClient();

    // Use production URL for the redirect
    const baseUrl = 'https://kattal-ai.vercel.app';
    console.log('Google OAuth - Base URL:', baseUrl);
    console.log('Google OAuth - Environment:', env.NODE_ENV);
    console.log('Google OAuth - NEXT_PUBLIC_SITE_URL:', env.NEXT_PUBLIC_SITE_URL);

    // Let Supabase handle the redirect URL (it will use the project configuration)
    const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
            redirectTo: `${baseUrl}/api/auth/callback`,
            queryParams: {
                access_type: 'offline',
                prompt: 'consent',
            },
        },
    });

    if (error) {
        console.error('Google OAuth error:', error);
        return NextResponse.json({ error: error.message }, { status: 400 });
    }

    console.log('Google OAuth - Supabase redirect URL:', data.url);
    console.log('Google OAuth - Supabase data:', data);

    // Redirect user to Google login
    return NextResponse.redirect(data.url);
}
