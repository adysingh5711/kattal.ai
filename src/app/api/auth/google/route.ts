import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";

export async function GET(request: Request) {
    try {
        const supabase = await createClient();

        // Get the origin from the request to ensure we redirect back to the same environment
        const requestUrl = new URL(request.url);
        const referer = request.headers.get('referer');
        let origin = request.headers.get('origin') ||
            (referer ? new URL(referer).origin : null) ||
            requestUrl.origin ||
            env.NEXT_PUBLIC_SITE_URL ||
            'https://kaattaal.ai.in';

        // Ensure origin is a valid URL (starts with http:// or https://)
        if (!origin.startsWith('http://') && !origin.startsWith('https://')) {
            origin = `https://${origin}`;
        }

        // Remove trailing slash if present
        origin = origin.replace(/\/$/, '');

        // Construct the absolute callback URL
        const callbackUrl = `${origin}/api/auth/callback`;

        logger.info('Google OAuth initiated', 'auth/google', {
            origin,
            environment: env.NODE_ENV,
        });

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
            logger.error('Google OAuth Supabase error', 'auth/google', {
                error: error.message,
            });
            return NextResponse.json(
                { error: "Unable to initiate sign in. Please try again." },
                { status: 500 }
            );
        }

        // Redirect user to Google login
        return NextResponse.redirect(data.url);
    } catch (error) {
        logger.error('Google OAuth API error', 'auth/google', {
            error: error instanceof Error ? error.message : String(error),
        });
        return NextResponse.json(
            { error: "Something went wrong. Please try again later." },
            { status: 500 }
        );
    }
}
