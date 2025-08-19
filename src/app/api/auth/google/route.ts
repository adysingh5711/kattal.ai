import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getBaseUrl } from "@/lib/utils";

export async function GET(request: Request) {
    const supabase = await createClient();

    // Get the correct redirect URL based on environment
    const baseUrl = getBaseUrl();
    console.log('Google OAuth - Base URL:', baseUrl);
    console.log('Google OAuth - Environment:', process.env.NODE_ENV);
    console.log('Google OAuth - NEXT_PUBLIC_SITE_URL:', process.env.NEXT_PUBLIC_SITE_URL);

    // Redirect to Google OAuth
    const redirectTo = `${baseUrl}/api/auth/callback`;
    console.log('Google OAuth - Redirect To:', redirectTo);

    const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
            redirectTo,
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
    // Redirect user to Google login
    return NextResponse.redirect(data.url);
}
