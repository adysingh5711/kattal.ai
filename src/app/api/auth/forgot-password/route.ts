import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getBaseUrl } from "@/lib/utils";
import { checkRateLimit } from "@/lib/security";
import { logger } from "@/lib/logger";

export async function POST(request: Request) {
    try {
        const { email } = await request.json();

        if (!email || typeof email !== 'string') {
            return NextResponse.json(
                { error: "Email is required" },
                { status: 400 }
            );
        }

        // ── Rate limit: max 3 requests per email per hour ──
        const rateLimitKey = `forgot-password:${email.toLowerCase().trim()}`;
        const rateLimit = checkRateLimit(rateLimitKey, {
            maxRequests: 3,
            windowMs: 3600_000, // 1 hour
        });

        if (!rateLimit.allowed) {
            logger.warn('Password reset rate limit exceeded', 'auth/forgot-password', {
                email: email.replace(/(.{2}).*(@.*)/, '$1***$2'), // Redact email for logs
                resetAt: new Date(rateLimit.resetAt).toISOString(),
            });

            return NextResponse.json(
                { error: "Too many password reset requests. Please try again later." },
                {
                    status: 429,
                    headers: {
                        'Retry-After': String(Math.ceil((rateLimit.resetAt - Date.now()) / 1000)),
                        'X-RateLimit-Remaining': '0',
                    },
                }
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
            logger.error('Forgot password Supabase error', 'auth/forgot-password', {
                error: error.message,
            });
            // Don't reveal the specific error to the user — always return success
        }

        // Always return success to prevent email enumeration attacks
        return NextResponse.json({
            message: "If an account exists with this email, you will receive a password reset link.",
        }, {
            headers: {
                'X-RateLimit-Remaining': String(rateLimit.remaining),
            },
        });
    } catch (error) {
        logger.error('Forgot password API error', 'auth/forgot-password', {
            error: error instanceof Error ? error.message : String(error),
        });
        return NextResponse.json(
            { error: "Something went wrong. Please try again later." },
            { status: 500 }
        );
    }
}
