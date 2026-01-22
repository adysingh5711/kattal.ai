import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const error = searchParams.get('error');
    const errorDescription = searchParams.get('error_description');

    // Get the origin from the request URL itself (not referer, which would be Google)
    // The callback URL is called by Google, so we need to use the request's own origin
    const requestUrl = new URL(request.url);
    const origin = requestUrl.origin;

    // if "next" is in param, use it as the redirect URL
    const next = searchParams.get('next') ?? '/chat';

    console.log('Auth callback received:', { code: !!code, error, errorDescription, next, origin });

    if (error) {
        console.error('OAuth error:', error, errorDescription);
        const errorRedirectUrl = `${origin}/?auth_error=${encodeURIComponent(error)}`;
        return NextResponse.redirect(errorRedirectUrl);
    }

    if (code) {
        const supabase = await createClient();

        try {
            const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

            if (exchangeError) {
                console.error('Session exchange error:', exchangeError);
                const errorRedirectUrl = `${origin}/?auth_error=${encodeURIComponent(exchangeError.message)}`;
                return NextResponse.redirect(errorRedirectUrl);
            }

            if (data.user) {
                console.log('User authenticated successfully:', data.user.email);
                const redirectUrl = `${origin}${next}`;

                console.log('Redirecting to:', redirectUrl);
                return NextResponse.redirect(redirectUrl);
            } else {
                console.error('No user data after session exchange');
                const errorRedirectUrl = `${origin}/?auth_error=no_user_data`;
                return NextResponse.redirect(errorRedirectUrl);
            }
        } catch (err) {
            console.error('Unexpected error in callback:', err);
            const errorRedirectUrl = `${origin}/?auth_error=unexpected_error`;
            return NextResponse.redirect(errorRedirectUrl);
        }
    }

    // No code provided
    console.error('No authentication code provided');
    const errorRedirectUrl = `${origin}/?auth_error=no_code`;
    return NextResponse.redirect(errorRedirectUrl);
}
