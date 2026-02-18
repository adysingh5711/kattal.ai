/**
 * Server-side structured logger.
 * 
 * In production: only error and warn level are emitted.
 * In development: all levels are emitted.
 * 
 * NEVER expose log output to the client.
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
    level: LogLevel;
    message: string;
    context?: string;
    timestamp: string;
    data?: Record<string, unknown>;
}

const IS_PRODUCTION = process.env.NODE_ENV === 'production';

/** Sensitive keys that should be redacted from log data (production-safe) */
const SENSITIVE_KEYS = new Set([
    'password', 'token', 'secret', 'api_key', 'apikey',
    'authorization', 'cookie', 'session', 'credit_card',
    'ssn', 'access_token', 'refresh_token',
    // Env / API key names (never log values)
    'openai_api_key', 'pinecone_api_key', 'database_url',
    'openrouter_api_key', 'aws_api_key', 'supabase_key',
]);

/**
 * Recursively redact sensitive fields from an object for safe logging.
 */
function redactSensitive(data: unknown, depth = 0): unknown {
    if (depth > 5) return '[DEPTH_LIMIT]';
    if (data === null || data === undefined) return data;
    if (typeof data === 'string') return data;
    if (typeof data === 'number' || typeof data === 'boolean') return data;

    if (Array.isArray(data)) {
        return data.map(item => redactSensitive(item, depth + 1));
    }

    if (typeof data === 'object') {
        const redacted: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
            if (SENSITIVE_KEYS.has(key.toLowerCase())) {
                redacted[key] = '[REDACTED]';
            } else {
                redacted[key] = redactSensitive(value, depth + 1);
            }
        }
        return redacted;
    }

    return String(data);
}

function formatLog(entry: LogEntry): string {
    const prefix = `[${entry.timestamp}] [${entry.level.toUpperCase()}]`;
    const ctx = entry.context ? ` [${entry.context}]` : '';
    return `${prefix}${ctx} ${entry.message}`;
}

function shouldLog(level: LogLevel): boolean {
    if (!IS_PRODUCTION) return true;
    // In production, only warn and error
    return level === 'warn' || level === 'error';
}

function log(level: LogLevel, message: string, context?: string, data?: Record<string, unknown>) {
    if (!shouldLog(level)) return;

    const entry: LogEntry = {
        level,
        message,
        context,
        timestamp: new Date().toISOString(),
        data: data ? redactSensitive(data) as Record<string, unknown> : undefined,
    };

    const formatted = formatLog(entry);

    switch (level) {
        case 'error':
            if (entry.data) {
                console.error(formatted, entry.data);
            } else {
                console.error(formatted);
            }
            break;
        case 'warn':
            if (entry.data) {
                console.warn(formatted, entry.data);
            } else {
                console.warn(formatted);
            }
            break;
        case 'info':
            if (entry.data) {
                console.info(formatted, entry.data);
            } else {
                console.info(formatted);
            }
            break;
        case 'debug':
            if (entry.data) {
                console.debug(formatted, entry.data);
            } else {
                console.debug(formatted);
            }
            break;
    }
}

/**
 * Structured server-side logger.
 *
 * Usage:
 *   logger.info('User signed in', 'auth', { email: user.email });
 *   logger.error('Failed to process request', 'api', { error: err.message });
 */
export const logger = {
    debug: (message: string, context?: string, data?: Record<string, unknown>) =>
        log('debug', message, context, data),

    info: (message: string, context?: string, data?: Record<string, unknown>) =>
        log('info', message, context, data),

    warn: (message: string, context?: string, data?: Record<string, unknown>) =>
        log('warn', message, context, data),

    error: (message: string, context?: string, data?: Record<string, unknown>) =>
        log('error', message, context, data),
};
