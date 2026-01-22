import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { env } from "@/lib/env";

export async function GET(request: Request) {
    const supabase = await createClient();

    // Get the origin from the request to ensure we redirect back to the same environment
    const requestUrl = new URL(request.url);
    const referer = request.headers.get('referer');
    let origin = request.headers.get('origin') ||
        (referer ? new URL(referer).origin : null) ||
        requestUrl.origin ||
        env.NEXT_PUBLIC_SITE_URL ||
        'https://kattal-ai.vercel.app';

    // Ensure origin is a valid URL (starts with http:// or https://)
    if (!origin.startsWith('http://') && !origin.startsWith('https://')) {
        origin = `https://${origin}`;
    }

    // Remove trailing slash if present
    origin = origin.replace(/\/$/, '');

    // Construct the absolute callback URL
    const callbackUrl = `${origin}/api/auth/callback`;

    console.log('Google OAuth - Request URL:', request.url);
    console.log('Google OAuth - Origin header:', request.headers.get('origin'));
    console.log('Google OAuth - Referer header:', referer);
    console.log('Google OAuth - Detected origin:', origin);
    console.log('Google OAuth - Callback URL:', callbackUrl);
    console.log('Google OAuth - Environment:', env.NODE_ENV);

    // Let Supabase handle the redirect URL (it will use the project configuration)
    const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
            redirectTo: callbackUrl,
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
