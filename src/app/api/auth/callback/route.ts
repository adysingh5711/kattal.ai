import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { validateRedirectUrl } from "@/lib/security";
import { logger } from "@/lib/logger";

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const error = searchParams.get('error');
    const errorDescription = searchParams.get('error_description');

    // Get the origin from the request URL itself (not referer, which would be Google)
    const requestUrl = new URL(request.url);
    const origin = requestUrl.origin;

    // Validate the "next" redirect parameter against the allowlist
    const rawNext = searchParams.get('next') ?? '/chat';
    const next = validateRedirectUrl(rawNext, '/chat');

    logger.info('Auth callback received', 'auth/callback', {
        hasCode: String(!!code),
        error: error ?? undefined,
        next,
        origin,
    });

    if (error) {
        logger.error('OAuth error in callback', 'auth/callback', {
            error: error ?? 'unknown',
            errorDescription: errorDescription ?? 'none',
        });
        // Return a generic error to the user — no details leaked
        const errorRedirectUrl = `${origin}/?auth_error=${encodeURIComponent('authentication_failed')}`;
        return NextResponse.redirect(errorRedirectUrl);
    }

    if (code) {
        const supabase = await createClient();

        try {
            const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

            if (exchangeError) {
                logger.error('Session exchange failed', 'auth/callback', {
                    error: exchangeError.message,
                });
                const errorRedirectUrl = `${origin}/?auth_error=${encodeURIComponent('authentication_failed')}`;
                return NextResponse.redirect(errorRedirectUrl);
            }

            if (data.user) {
                logger.info('User authenticated successfully', 'auth/callback', {
                    userId: data.user.id,
                });
                const redirectUrl = `${origin}${next}`;
                return NextResponse.redirect(redirectUrl);
            } else {
                logger.error('No user data after session exchange', 'auth/callback');
                const errorRedirectUrl = `${origin}/?auth_error=${encodeURIComponent('authentication_failed')}`;
                return NextResponse.redirect(errorRedirectUrl);
            }
        } catch (err) {
            logger.error('Unexpected error in auth callback', 'auth/callback', {
                error: err instanceof Error ? err.message : String(err),
            });
            const errorRedirectUrl = `${origin}/?auth_error=${encodeURIComponent('authentication_failed')}`;
            return NextResponse.redirect(errorRedirectUrl);
        }
    }

    // No code provided
    logger.error('No authentication code provided in callback', 'auth/callback');
    const errorRedirectUrl = `${origin}/?auth_error=${encodeURIComponent('authentication_failed')}`;
    return NextResponse.redirect(errorRedirectUrl);
}
