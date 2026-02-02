import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getBaseUrl } from "@/lib/utils";

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
            console.error('Signup error:', error);
            return NextResponse.json({ error: error.message }, { status: 400 });
        }

        // Check if user needs to confirm email
        if (data.user && !data.user.email_confirmed_at) {
            return NextResponse.json({
                message: "Please check your email to confirm your account",
                user: data.user,
                needsEmailConfirmation: true,
            });
        }

        return NextResponse.json({
            message: "Account created successfully",
            user: data.user,
            session: data.session,
        });
    } catch (error) {
        console.error('Signup API error:', error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}
