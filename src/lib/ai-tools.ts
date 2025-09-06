/**
 * AI Tool Integration for Environmental Data
 * Integrates the info tool with the chat system for AI-powered environmental data queries
 */

import {
    getProcessedEnvironmentalData,
    fetchMultipleFactors,
    getAvailableCities,
    getAvailableNaturalFactors,
    validateInfoToolParams,
    type ProcessedEnvironmentalData
} from './info-tool-index';

/**
 * Tool definition for AI chat system
 */
export interface EnvironmentalDataTool {
    name: 'get_environmental_data';
    description: string;
    parameters: {
        type: 'object';
        properties: Record<string, {
            type: string;
            description?: string;
            enum?: string[];
            items?: Record<string, unknown>;
            minItems?: number;
            optional?: boolean;
        }>;
        required: string[];
    };
}

/**
 * Tool schema for the AI chat system
 */
export const environmentalDataTool: EnvironmentalDataTool = {
    name: 'get_environmental_data',
    description: `Get real-time environmental monitoring data from IoT sensors across Kerala districts. 
Supported cities: ${getAvailableCities().join(', ')}
Supported factors: ${getAvailableNaturalFactors().join(', ')}
Use this tool when users ask about weather, climate, or environmental conditions.`,
    parameters: {
        type: 'object',
        properties: {
            city: {
                type: 'string',
                description: `City/district name. Available options: ${getAvailableCities().join(', ')}`,
                enum: getAvailableCities()
            },
            naturalFactors: {
                type: 'array',
                items: {
                    type: 'string',
                    enum: getAvailableNaturalFactors()
                },
                description: `Array of environmental factors to fetch. Available: ${getAvailableNaturalFactors().join(', ')}`,
                minItems: 1
            },
            startDate: {
                type: 'string',
                description: 'Start date in ISO format (e.g., \"2024-01-01\" or \"2024-01-01T00:00:00Z\")'
            },
            endDate: {
                type: 'string',
                description: 'End date in ISO format (e.g., \"2024-01-02\" or \"2024-01-02T00:00:00Z\")'
            },
            timeRange: {
                type: 'string',
                description: 'Predefined time range',
                enum: ['last_hour', 'last_24h', 'last_week', 'last_month'],
                optional: true
            }
        },
        required: ['city', 'naturalFactors']
    }
};

/**
 * Execute the environmental data tool
 */
export async function executeEnvironmentalDataTool(params: {
    city: string;
    naturalFactors: string[];
    startDate?: string;
    endDate?: string;
    timeRange?: string;
}): Promise<{
    success: boolean;
    data?: Record<string, ProcessedEnvironmentalData>;
    summary?: string;
    error?: string;
}> {
    try {
        // Handle time range presets
        let startDate = params.startDate;
        let endDate = params.endDate;

        if (params.timeRange && (!startDate || !endDate)) {
            const now = new Date();
            endDate = now.toISOString();

            switch (params.timeRange) {
                case 'last_hour':
                    startDate = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
                    break;
                case 'last_24h':
                    startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
                    break;
                case 'last_week':
                    startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
                    break;
                case 'last_month':
                    startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
                    break;
                default:
                    startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
            }
        }

        // Default to last 24 hours if no dates provided
        if (!startDate || !endDate) {
            const now = new Date();
            endDate = now.toISOString();
            startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
        }

        // Validate each factor individually
        for (const factor of params.naturalFactors) {
            const validation = validateInfoToolParams({
                city: params.city,
                naturalFactor: factor,
                startDate,
                endDate
            });

            if (!validation.valid) {
                return {
                    success: false,
                    error: `Validation failed for ${factor}: ${validation.errors.join(', ')}`
                };
            }
        }

        // Use optimized multi-factor fetch if multiple factors requested
        const results: Record<string, ProcessedEnvironmentalData> = {};

        if (params.naturalFactors.length > 1) {
            // Optimized approach: fetch multiple factors efficiently
            await fetchMultipleFactors(
                params.city,
                params.naturalFactors,
                startDate,
                endDate
            );

            // Process each result
            for (const factor of params.naturalFactors) {
                const processedData = await getProcessedEnvironmentalData(
                    params.city,
                    factor,
                    startDate,
                    endDate
                );
                results[factor] = processedData;
            }
        } else {
            // Single factor request
            const factor = params.naturalFactors[0];
            const processedData = await getProcessedEnvironmentalData(
                params.city,
                factor,
                startDate,
                endDate
            );
            results[factor] = processedData;
        }

        // Generate a summary for the AI
        const summary = generateDataSummary(params.city, results, startDate, endDate);

        return {
            success: true,
            data: results,
            summary
        };

    } catch (error) {
        console.error('Environmental data tool error:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error occurred'
        };
    }
}

/**
 * Generate a human-readable summary of the environmental data
 */
function generateDataSummary(
    city: string,
    results: Record<string, ProcessedEnvironmentalData>,
    startDate: string,
    endDate: string
): string {
    const summaryParts: string[] = [];

    summaryParts.push(`Environmental data for ${city.charAt(0).toUpperCase() + city.slice(1)} from ${new Date(startDate).toLocaleDateString()} to ${new Date(endDate).toLocaleDateString()}:`);

    for (const [factor, data] of Object.entries(results)) {
        const stats = data.statistics;
        const factorInfo = data.naturalFactorInfo;

        if (stats.count > 0 && factorInfo) {
            const unit = factorInfo.unit;
            summaryParts.push(
                `\n• ${factorInfo.displayName}: Latest: ${stats.latest}${unit}, ` +
                `Average: ${stats.average}${unit}, ` +
                `Range: ${stats.min}${unit} - ${stats.max}${unit} ` +
                `(${stats.count} readings)`
            );
        } else {
            summaryParts.push(`\n• ${factor}: No data available`);
        }
    }

    return summaryParts.join('');
}

/**
 * Check if a query is related to environmental data
 */
export function isEnvironmentalQuery(query: string): boolean {
    const environmentalKeywords = [
        'weather', 'temperature', 'rainfall', 'humidity', 'wind', 'pressure',
        'climate', 'environmental', 'sensor', 'monitoring', 'data',
        ...getAvailableCities(),
        ...getAvailableNaturalFactors()
    ];

    const lowerQuery = query.toLowerCase();
    const result = environmentalKeywords.some(keyword => lowerQuery.includes(keyword.toLowerCase()));

    console.log('🔍 Environmental query detection:', {
        query: query,
        lowerQuery: lowerQuery,
        keywords: environmentalKeywords,
        result: result
    });

    return result;
}

/**
 * Extract parameters from natural language query
 */
export function extractParametersFromQuery(query: string): Partial<{
    city: string;
    naturalFactors: string[];
    timeRange: string;
}> {
    const lowerQuery = query.toLowerCase();
    const params: Partial<{
        city: string;
        naturalFactors: string[];
        timeRange: string;
    }> = {};

    // Extract city
    const cities = getAvailableCities();
    for (const city of cities) {
        if (lowerQuery.includes(city.toLowerCase())) {
            params.city = city;
            break;
        }
    }

    // Extract natural factors
    const factors = getAvailableNaturalFactors();
    const foundFactors: string[] = [];
    for (const factor of factors) {
        if (lowerQuery.includes(factor.toLowerCase()) ||
            lowerQuery.includes(factor.replace('_', ' ').toLowerCase())) {
            foundFactors.push(factor);
        }
    }
    if (foundFactors.length > 0) {
        params.naturalFactors = foundFactors;
    }

    // Extract time range
    if (lowerQuery.includes('last hour') || lowerQuery.includes('past hour')) {
        params.timeRange = 'last_hour';
    } else if (lowerQuery.includes('today') || lowerQuery.includes('last 24') || lowerQuery.includes('past 24')) {
        params.timeRange = 'last_24h';
    } else if (lowerQuery.includes('last week') || lowerQuery.includes('past week')) {
        params.timeRange = 'last_week';
    } else if (lowerQuery.includes('last month') || lowerQuery.includes('past month')) {
        params.timeRange = 'last_month';
    }

    return params;
}

// Export the tool configuration for easy integration
export const ENVIRONMENTAL_TOOLS = [
    environmentalDataTool
] as const;

export type EnvironmentalToolResult = Awaited<ReturnType<typeof executeEnvironmentalDataTool>>;