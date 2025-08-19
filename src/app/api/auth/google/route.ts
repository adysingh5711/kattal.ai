import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
    const supabase = await createClient();

    // FORCE PRODUCTION URL - bypass any environment detection
    const baseUrl = 'https://kattal-ai.vercel.app';
    console.log('Google OAuth - FORCED Base URL:', baseUrl);
    console.log('Google OAuth - Environment:', process.env.NODE_ENV);
    console.log('Google OAuth - NEXT_PUBLIC_SITE_URL:', process.env.NEXT_PUBLIC_SITE_URL);
    console.log('Google OAuth - Request URL:', request.url);
    console.log('Google OAuth - Request Headers:', Object.fromEntries(request.headers.entries()));

    // Redirect to Google OAuth with explicit production URL
    const redirectTo = `${baseUrl}/api/auth/callback`;
    console.log('Google OAuth - Redirect To:', redirectTo);

    const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
            redirectTo,
            queryParams: {
                access_type: 'offline',
                prompt: 'consent',
                redirect_uri: redirectTo, // Try to force the redirect URI
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
