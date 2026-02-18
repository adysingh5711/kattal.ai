/**
 * Security utilities: CORS, redirect allowlist, rate limiting.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { logger } from './logger';

// ─── CORS Configuration ───────────────────────────────────────────────

/** Allowed origins for CORS. Add all production and dev domains here. */
const ALLOWED_ORIGINS: string[] = [
    'https://kaattaal.ai.in',
    'https://www.kaattaal.ai.in',
    // Development origins (only active in non-production)
    ...(process.env.NODE_ENV !== 'production'
        ? ['http://localhost:3000', 'http://localhost:3001', 'http://127.0.0.1:3000']
        : []),
];

const CORS_HEADERS = {
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
    'Access-Control-Max-Age': '86400', // 24 hours preflight cache
    'Access-Control-Allow-Credentials': 'true',
};

/**
 * Check if the given origin is allowed.
 */
export function isAllowedOrigin(origin: string | null): boolean {
    if (!origin) return false;
    const normalised = origin.replace(/\/$/, ''); // strip trailing slash
    return ALLOWED_ORIGINS.includes(normalised);
}

/**
 * Apply CORS headers to a response based on the request origin.
 * Returns null when the origin is not in the allowlist (request should be rejected).
 */
export function applyCorsHeaders(request: NextRequest, response: NextResponse): NextResponse {
    const origin = request.headers.get('origin');

    if (origin && isAllowedOrigin(origin)) {
        const normalised = origin.replace(/\/$/, '');
        response.headers.set('Access-Control-Allow-Origin', normalised);
        Object.entries(CORS_HEADERS).forEach(([key, value]) => {
            response.headers.set(key, value);
        });
    }

    return response;
}

/**
 * Handle preflight OPTIONS request for API routes.
 */
export function handleCorsPreflightRequest(request: NextRequest): NextResponse | null {
    if (request.method !== 'OPTIONS') return null;

    const origin = request.headers.get('origin');

    if (!isAllowedOrigin(origin)) {
        return new NextResponse(null, { status: 403 });
    }

    const normalised = origin!.replace(/\/$/, '');
    const headers: Record<string, string> = {
        'Access-Control-Allow-Origin': normalised,
        ...CORS_HEADERS,
    };

    return new NextResponse(null, { status: 204, headers });
}

// ─── Redirect URL Allowlist ───────────────────────────────────────────

/** Allowed hostnames for redirect targets. */
const ALLOWED_REDIRECT_HOSTS: string[] = [
    'kaattaal.ai.in',
    'www.kaattaal.ai.in',
    ...(process.env.NODE_ENV !== 'production'
        ? ['localhost', '127.0.0.1']
        : []),
];

/** Allowed relative path prefixes for redirects. */
const ALLOWED_REDIRECT_PATHS: string[] = [
    '/',
    '/chat',
    '/upload',
    '/auth/reset-password',
];

/**
 * Validate a redirect URL against the allowlist.
 * - Only allows relative paths or absolute URLs whose host is in the allowlist.
 * - Returns a safe URL (or fallback) — never an attacker-controlled URL.
 */
export function validateRedirectUrl(redirectUrl: string, fallback: string = '/'): string {
    // Handle relative paths (most common case)
    if (redirectUrl.startsWith('/') && !redirectUrl.startsWith('//')) {
        const pathOnly = redirectUrl.split('?')[0].split('#')[0];
        const isAllowed = ALLOWED_REDIRECT_PATHS.some(prefix => pathOnly === prefix || pathOnly.startsWith(prefix + '/'));
        if (isAllowed) {
            return redirectUrl;
        }
        logger.warn('Redirect path not in allowlist', 'security', { path: pathOnly });
        return fallback;
    }

    // Handle absolute URLs
    try {
        const url = new URL(redirectUrl);
        if (!ALLOWED_REDIRECT_HOSTS.includes(url.hostname)) {
            logger.warn('Redirect host not in allowlist', 'security', { host: url.hostname, url: redirectUrl });
            return fallback;
        }
        // Only allow http/https
        if (url.protocol !== 'http:' && url.protocol !== 'https:') {
            logger.warn('Redirect protocol not allowed', 'security', { protocol: url.protocol });
            return fallback;
        }
        return redirectUrl;
    } catch {
        logger.warn('Invalid redirect URL', 'security', { url: redirectUrl });
        return fallback;
    }
}

// ─── Rate Limiting ────────────────────────────────────────────────────

interface RateLimitEntry {
    count: number;
    windowStart: number;
}

/** In-memory store for rate limiting, keyed by a composite key. */
const rateLimitStore = new Map<string, RateLimitEntry>();

/** Periodically clean up expired entries (every 10 minutes). */
let cleanupScheduled = false;
function scheduleCleanup() {
    if (cleanupScheduled) return;
    cleanupScheduled = true;
    setInterval(() => {
        const now = Date.now();
        for (const [key, entry] of rateLimitStore) {
            if (now - entry.windowStart > 3600_000) { // 1 hour
                rateLimitStore.delete(key);
            }
        }
    }, 600_000); // every 10 min
}

interface RateLimitOptions {
    /** Maximum number of requests allowed in the window. */
    maxRequests: number;
    /** Window duration in milliseconds. Default: 1 hour (3600000). */
    windowMs?: number;
}

interface RateLimitResult {
    allowed: boolean;
    remaining: number;
    resetAt: number; // Unix timestamp (ms)
}

/**
 * Check rate limit for a given key (e.g., email address).
 * Uses a sliding-window counter stored in memory.
 *
 * @param key  Unique identifier for the rate limit bucket (e.g., email).
 * @param opts Rate limit configuration.
 * @returns Whether the request is allowed and metadata.
 */
export function checkRateLimit(key: string, opts: RateLimitOptions): RateLimitResult {
    scheduleCleanup();
    const windowMs = opts.windowMs ?? 3600_000; // 1 hour default
    const now = Date.now();
    const normalizedKey = key.toLowerCase().trim();

    const entry = rateLimitStore.get(normalizedKey);

    if (!entry || now - entry.windowStart > windowMs) {
        // New window
        rateLimitStore.set(normalizedKey, { count: 1, windowStart: now });
        return { allowed: true, remaining: opts.maxRequests - 1, resetAt: now + windowMs };
    }

    if (entry.count >= opts.maxRequests) {
        const resetAt = entry.windowStart + windowMs;
        return { allowed: false, remaining: 0, resetAt };
    }

    entry.count += 1;
    return { allowed: true, remaining: opts.maxRequests - entry.count, resetAt: entry.windowStart + windowMs };
}
