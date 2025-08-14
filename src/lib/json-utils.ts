/**
 * Utility functions for handling JSON extraction from LLM responses
 */

/**
 * Extracts JSON from a string that might contain markdown code blocks or other formatting
 * Handles cases where LLM returns JSON wrapped in ```json...``` blocks
 */
export function extractJSONFromString(content: string): any {
    if (!content || typeof content !== 'string') {
        throw new Error('Invalid content provided for JSON extraction');
    }

    // Try to parse as direct JSON first
    try {
        return JSON.parse(content.trim());
    } catch (error) {
        // If direct parsing fails, try to extract from markdown code blocks
    }

    // Look for JSON in code blocks
    const codeBlockRegex = /```(?:json)?\s*\n?([\s\S]*?)\n?```/gi;
    const match = codeBlockRegex.exec(content);

    if (match && match[1]) {
        try {
            return JSON.parse(match[1].trim());
        } catch (error) {
            // Continue to other extraction methods
        }
    }

    // Look for JSON-like content between braces or brackets
    const jsonPattern = /(\{[\s\S]*\}|\[[\s\S]*\])/;
    const jsonMatch = content.match(jsonPattern);

    if (jsonMatch && jsonMatch[1]) {
        try {
            return JSON.parse(jsonMatch[1].trim());
        } catch (error) {
            // Continue to other extraction methods
        }
    }

    // If all extraction methods fail, throw an error with the original content for debugging
    throw new Error(`Failed to extract JSON from content: ${content.slice(0, 200)}...`);
}

/**
 * Safely extracts JSON with fallback to default value
 */
export function safeExtractJSON<T>(content: string, fallback: T): T {
    try {
        return extractJSONFromString(content);
    } catch (error) {
        console.warn('JSON extraction failed, using fallback:', error);
        return fallback;
    }
}
