import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getBaseUrl } from "@/lib/utils";

export async function POST(request: Request) {
    try {
        const { email } = await request.json();

        if (!email) {
            return NextResponse.json(
                { error: "Email is required" },
                { status: 400 }
            );
        }

        const supabase = await createClient();

        // Get the correct redirect URL based on request origin
        const origin = request.headers.get('origin');
        const baseUrl = getBaseUrl(origin);

        const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: `${baseUrl}/api/auth/callback?next=/auth/reset-password`,
        });

        if (error) {
            console.error('Forgot password error:', error);
            return NextResponse.json({ error: error.message }, { status: 400 });
        }

        // Always return success to prevent email enumeration attacks
        return NextResponse.json({
            message: "If an account exists with this email, you will receive a password reset link.",
        });
    } catch (error) {
        console.error('Forgot password API error:', error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}
