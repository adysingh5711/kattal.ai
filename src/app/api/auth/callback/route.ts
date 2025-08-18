import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getBaseUrl } from "@/lib/utils";

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    // if "next" is in param, use it as the redirect URL
    const next = searchParams.get('next') ?? '/chat';

    if (code) {
        const supabase = await createClient();
        const { error } = await supabase.auth.exchangeCodeForSession(code);

        if (!error) {
            // Get the correct base URL for redirects
            const baseUrl = getBaseUrl(request);
            const redirectUrl = `${baseUrl}${next}`;

            return NextResponse.redirect(redirectUrl);
        }
    }

    // Return the user to an error page with instructions
    const baseUrl = getBaseUrl(request);
    const errorRedirectUrl = `${baseUrl}/auth/auth-code-error`;

    return NextResponse.redirect(errorRedirectUrl);
}
