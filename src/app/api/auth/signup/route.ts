import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getBaseUrl } from "@/lib/utils";
import { logger } from "@/lib/logger";

export async function POST(request: Request) {
    try {
        const { email, password, name } = await request.json();

        if (!email || !password) {
            return NextResponse.json(
                { error: "Email and password are required" },
                { status: 400 }
            );
        }

        // Create Supabase client
        const supabase = await createClient();

        // Get the correct redirect URL based on request origin
        const origin = request.headers.get('origin');
        const baseUrl = getBaseUrl(origin);

        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                emailRedirectTo: `${baseUrl}/api/auth/callback`,
                data: {
                    full_name: name,
                    display_name: name,
                },
            },
        });

        if (error) {
            logger.error('Sign-up failed', 'auth/signup', {
                error: error.message,
            });
            // Return a generic error — don't reveal whether the email is already registered
            return NextResponse.json(
                { error: "Unable to create account. Please check your details and try again." },
                { status: 400 }
            );
        }

        // Check if user needs to confirm email
        if (data.user && !data.user.email_confirmed_at) {
            return NextResponse.json({
                message: "Please check your email to confirm your account",
                needsEmailConfirmation: true,
            });
        }

        return NextResponse.json({
            message: "Account created successfully",
        });
    } catch (error) {
        logger.error('Sign-up API error', 'auth/signup', {
            error: error instanceof Error ? error.message : String(error),
        });
        return NextResponse.json(
            { error: "Something went wrong. Please try again later." },
            { status: 500 }
        );
    }
}
