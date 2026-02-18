import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";

export async function POST() {
    try {
        const supabase = await createClient();

        const { error } = await supabase.auth.signOut();

        if (error) {
            logger.error('Sign-out failed', 'auth/signout', {
                error: error.message,
            });
            return NextResponse.json(
                { error: "Something went wrong. Please try again." },
                { status: 500 }
            );
        }

        return NextResponse.json({ message: "Signed out successfully" });
    } catch (error) {
        logger.error('Sign-out API error', 'auth/signout', {
            error: error instanceof Error ? error.message : String(error),
        });
        return NextResponse.json(
            { error: "Something went wrong. Please try again." },
            { status: 500 }
        );
    }
}
