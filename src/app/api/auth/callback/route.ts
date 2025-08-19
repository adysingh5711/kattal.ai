import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getBaseUrl } from "@/lib/utils";

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const error = searchParams.get('error');
    const errorDescription = searchParams.get('error_description');

    // if "next" is in param, use it as the redirect URL
    const next = searchParams.get('next') ?? '/chat';

    console.log('Auth callback received:', { code: !!code, error, errorDescription, next });

    if (error) {
        console.error('OAuth error:', error, errorDescription);
        const baseUrl = getBaseUrl();
        const errorRedirectUrl = `${baseUrl}/?auth_error=${encodeURIComponent(error)}`;
        return NextResponse.redirect(errorRedirectUrl);
    }

    if (code) {
        const supabase = await createClient();

        try {
            const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

            if (exchangeError) {
                console.error('Session exchange error:', exchangeError);
                const baseUrl = getBaseUrl();
                const errorRedirectUrl = `${baseUrl}/?auth_error=${encodeURIComponent(exchangeError.message)}`;
                return NextResponse.redirect(errorRedirectUrl);
            }

            if (data.user) {
                console.log('User authenticated successfully:', data.user.email);
                // Get the correct base URL for redirects
                const baseUrl = getBaseUrl();
                const redirectUrl = `${baseUrl}${next}`;

                console.log('Redirecting to:', redirectUrl);
                return NextResponse.redirect(redirectUrl);
            } else {
                console.error('No user data after session exchange');
                const baseUrl = getBaseUrl();
                const errorRedirectUrl = `${baseUrl}/?auth_error=no_user_data`;
                return NextResponse.redirect(errorRedirectUrl);
            }
        } catch (err) {
            console.error('Unexpected error in callback:', err);
            const baseUrl = getBaseUrl();
            const errorRedirectUrl = `${baseUrl}/?auth_error=unexpected_error`;
            return NextResponse.redirect(errorRedirectUrl);
        }
    }

    // No code provided
    console.error('No authentication code provided');
    const baseUrl = getBaseUrl();
    const errorRedirectUrl = `${baseUrl}/?auth_error=no_code`;
    return NextResponse.redirect(errorRedirectUrl);
}
