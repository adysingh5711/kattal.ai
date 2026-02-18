import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";

export async function POST(request: Request) {
    try {
        const { password } = await request.json();

        if (!password) {
            return NextResponse.json(
                { error: "Password is required" },
                { status: 400 }
            );
        }

        if (password.length < 6) {
            return NextResponse.json(
                { error: "Password must be at least 6 characters long" },
                { status: 400 }
            );
        }

        const supabase = await createClient();

        // Verify the user has an active session (from the recovery flow)
        const { data: { user }, error: userError } = await supabase.auth.getUser();

        if (userError || !user) {
            logger.warn('Reset password attempted without valid session', 'auth/reset-password', {
                error: userError?.message ?? 'no user session',
            });
            return NextResponse.json(
                { error: "Invalid or expired reset link. Please request a new password reset." },
                { status: 401 }
            );
        }

        // Update the user's password
        const { error } = await supabase.auth.updateUser({
            password: password,
        });

        if (error) {
            logger.error('Password update failed', 'auth/reset-password', {
                userId: user.id,
                error: error.message,
            });
            return NextResponse.json(
                { error: "Unable to reset password. Please try again." },
                { status: 400 }
            );
        }

        logger.info('Password reset successfully', 'auth/reset-password', {
            userId: user.id,
        });

        return NextResponse.json({
            message: "Password has been reset successfully.",
        });
    } catch (error) {
        logger.error('Reset password API error', 'auth/reset-password', {
            error: error instanceof Error ? error.message : String(error),
        });
        return NextResponse.json(
            { error: "Something went wrong. Please try again later." },
            { status: 500 }
        );
    }
}
