import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

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
            console.error('Reset password error:', error);
            return NextResponse.json({ error: error.message }, { status: 400 });
        }

        return NextResponse.json({
            message: "Password has been reset successfully.",
        });
    } catch (error) {
        console.error('Reset password API error:', error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}
