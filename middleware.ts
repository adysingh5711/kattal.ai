import { updateSession } from '@/lib/supabase/middleware'
import { type NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { applyCorsHeaders, handleCorsPreflightRequest } from '@/lib/security'

export async function middleware(request: NextRequest) {
    // ── Handle CORS preflight (OPTIONS) requests ──
    const preflightResponse = handleCorsPreflightRequest(request)
    if (preflightResponse) return preflightResponse

    // Skip authentication check for auth-related routes
    if (request.nextUrl.pathname.startsWith('/api/auth')) {
        const response = NextResponse.next()
        return applyCorsHeaders(request, response)
    }

    // Normal session update path
    const response = await updateSession(request)

    // Apply CORS headers to all responses
    return applyCorsHeaders(request, response)
}

export const config = {
    matcher: [
        /*
         * Match all request paths except for the ones starting with:
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         * Feel free to modify this pattern to include more paths.
         */
        '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    ],
}
