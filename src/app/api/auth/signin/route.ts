import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";

export async function POST(request: Request) {
    try {
        const { email, password } = await request.json();

        if (!email || !password) {
            return NextResponse.json(
                { error: "Email and password are required" },
                { status: 400 }
            );
        }

        const supabase = await createClient();

        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        if (error) {
            logger.error('Sign-in failed', 'auth/signin', {
                error: error.message,
            });
            // Return generic error — don't reveal whether email exists or password is wrong
            return NextResponse.json(
                { error: "Invalid email or password" },
                { status: 401 }
            );
        }

        return NextResponse.json({
            message: "Signed in successfully",
            user: {
                id: data.user?.id,
                email: data.user?.email,
            },
        });
    } catch (error) {
        logger.error('Sign-in API error', 'auth/signin', {
            error: error instanceof Error ? error.message : String(error),
        });
        return NextResponse.json(
            { error: "Something went wrong. Please try again later." },
            { status: 500 }
        );
    }
}
