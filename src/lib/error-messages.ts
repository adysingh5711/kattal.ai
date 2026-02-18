/**
 * Malayalam error messages for user-friendly frontend display
 * Technical errors are logged server-side only via structured logger
 */

import { logger } from './logger';

export interface ErrorContext {
    error: Error | string;
    context?: string;
    additionalInfo?: Record<string, any>;
}

export interface MalayalamError {
    userMessage: string; // Friendly Malayalam message for user
    technicalMessage: string; // English technical message for server logs
    errorCode?: string;
}

/**
 * Get user-friendly Malayalam error messages
 */
export function getMalayalamErrorMessage(context: ErrorContext): MalayalamError {
    const error = typeof context.error === 'string' ? new Error(context.error) : context.error;
    const errorMessage = error.message.toLowerCase();
    const contextInfo = context.context || '';

    // Only log technical details when there's an actual error (not during normal operations)
    if (error.message && !error.message.includes('success') && !error.message.includes('completed')) {
        logger.error('Technical error details', contextInfo || 'error-messages', {
            message: error.message,
            context: contextInfo,
            ...(context.additionalInfo ?? {}),
        });
    }

    // Network/Connection errors
    if (errorMessage.includes('network') || errorMessage.includes('fetch') || errorMessage.includes('connection')) {
        return {
            userMessage: "ഇന്റർനെറ്റ് കണക്ഷൻ പ്രശ്നമുണ്ട്. ദയവായി നെറ്റ്‌വർക്ക് പരിശോധിച്ച് വീണ്ടും ശ്രമിക്കുക.",
            technicalMessage: `Network error: ${error.message}`,
            errorCode: 'NETWORK_ERROR'
        };
    }

    // API/Server errors
    if (errorMessage.includes('api') || errorMessage.includes('server') || errorMessage.includes('500') || errorMessage.includes('timeout')) {
        return {
            userMessage: "സെർവറിൽ ഒരു പ്രശ്നമുണ്ട്. കുറച്ച് നിമിഷങ്ങൾ കഴിഞ്ഞ് വീണ്ടും ശ്രമിക്കുക.",
            technicalMessage: `Server error: ${error.message}`,
            errorCode: 'SERVER_ERROR'
        };
    }

    // Authentication errors
    if (errorMessage.includes('auth') || errorMessage.includes('unauthorized') || errorMessage.includes('401')) {
        return {
            userMessage: "ലോഗിൻ പ്രശ്നമുണ്ട്. ദയവായി വീണ്ടും ലോഗിൻ ചെയ്യുക.",
            technicalMessage: `Authentication error: ${error.message}`,
            errorCode: 'AUTH_ERROR'
        };
    }

    // Rate limiting
    if (errorMessage.includes('rate limit') || errorMessage.includes('too many requests') || errorMessage.includes('429')) {
        return {
            userMessage: "വളരെയധികം അഭ്യർത്ഥനകൾ അയച്ചിരിക്കുന്നു. കുറച്ച് നിമിഷങ്ങൾ കാത്തിരുന്ന് വീണ്ടും ശ്രമിക്കുക.",
            technicalMessage: `Rate limit exceeded: ${error.message}`,
            errorCode: 'RATE_LIMIT'
        };
    }

    // Streaming errors
    if (errorMessage.includes('stream') || errorMessage.includes('streaming')) {
        return {
            userMessage: "സന്ദേശം സ്വീകരിക്കുന്നതിൽ പ്രശ്നമുണ്ട്. ദയവായി വീണ്ടും ശ്രമിക്കുക.",
            technicalMessage: `Streaming error: ${error.message}`,
            errorCode: 'STREAMING_ERROR'
        };
    }

    // LLM/Processing errors
    if (errorMessage.includes('llm') || errorMessage.includes('synthesis') || errorMessage.includes('timeout')) {
        return {
            userMessage: "ഉത്തരം തയ്യാറാക്കുന്നതിൽ കാലതാമസമുണ്ട്. ദയവായി വീണ്ടും ശ്രമിക്കുക.",
            technicalMessage: `LLM processing error: ${error.message}`,
            errorCode: 'LLM_ERROR'
        };
    }

    // Cache errors
    if (errorMessage.includes('cache') || errorMessage.includes('memory')) {
        return {
            userMessage: "സിസ്റ്റം മെമ്മറി പ്രശ്നമുണ്ട്. പേജ് റിഫ്രെഷ് ചെയ്ത് വീണ്ടും ശ്രമിക്കുക.",
            technicalMessage: `Cache/memory error: ${error.message}`,
            errorCode: 'CACHE_ERROR'
        };
    }

    // Validation errors
    if (errorMessage.includes('validation') || errorMessage.includes('invalid') || errorMessage.includes('400')) {
        return {
            userMessage: "അഭ്യർത്ഥനയിൽ പ്രശ്നമുണ്ട്. ദയവായി ചോദ്യം വീണ്ടും ടൈപ്പ് ചെയ്യുക.",
            technicalMessage: `Validation error: ${error.message}`,
            errorCode: 'VALIDATION_ERROR'
        };
    }

    // Pinecone/Vector database errors
    if (errorMessage.includes('pinecone') || errorMessage.includes('vector') || errorMessage.includes('embedding')) {
        return {
            userMessage: "വിവരങ്ങൾ തിരയുന്നതിൽ പ്രശ്നമുണ്ട്. ദയവായി വീണ്ടും ശ്രമിക്കുക.",
            technicalMessage: `Vector database error: ${error.message}`,
            errorCode: 'VECTOR_DB_ERROR'
        };
    }

    // Generic fallback
    return {
        userMessage: "ക്ഷമിക്കണം, ഒരു പ്രശ്നമുണ്ടായി. ദയവായി വീണ്ടും ശ്രമിക്കുക.",
        technicalMessage: `Generic error: ${error.message}`,
        errorCode: 'GENERIC_ERROR'
    };
}

/**
 * Helper function to show error in chat interface
 */
export function showErrorInChat(
    error: Error | string,
    context: string = '',
    additionalInfo?: Record<string, any>
): { userMessage: string; technicalMessage: string; errorCode?: string } {
    const malayalamError = getMalayalamErrorMessage({
        error,
        context,
        additionalInfo
    });

    return malayalamError;
}

/**
 * Common error messages for different scenarios
 */
export const COMMON_ERRORS = {
    NETWORK_ISSUE: "ഇന്റർനെറ്റ് കണക്ഷൻ പ്രശ്നമുണ്ട്. ദയവായി നെറ്റ്‌വർക്ക് പരിശോധിച്ച് വീണ്ടും ശ്രമിക്കുക.",
    SERVER_BUSY: "സെർവർ തിരക്കിലാണ്. കുറച്ച് നിമിഷങ്ങൾ കാത്തിരുന്ന് വീണ്ടും ശ്രമിക്കുക.",
    PROCESSING_DELAY: "ഉത്തരം തയ്യാറാക്കുന്നതിൽ കാലതാമസമുണ്ട്. ദയവായി വീണ്ടും ശ്രമിക്കുക.",
    INVALID_REQUEST: "അഭ്യർത്ഥനയിൽ പ്രശ്നമുണ്ട്. ദയവായി ചോദ്യം വീണ്ടും ടൈപ്പ് ചെയ്യുക.",
    GENERIC_ERROR: "ക്ഷമിക്കണം, ഒരു പ്രശ്നമുണ്ടായി. ദയവായി വീണ്ടും ശ്രമിക്കുക.",
    AUTHENTICATION_FAILED: "ലോഗിൻ പ്രശ്നമുണ്ട്. ദയവായി വീണ്ടും ലോഗിൻ ചെയ്യുക.",
    RATE_LIMITED: "വളരെയധികം അഭ്യർത്ഥനകൾ അയച്ചിരിക്കുന്നു. കുറച്ച് നിമിഷങ്ങൾ കാത്തിരുന്ന് വീണ്ടും ശ്രമിക്കുക."
} as const;
