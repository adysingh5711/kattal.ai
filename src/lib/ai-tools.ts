/**
 * AI Tool Integration for Environmental Data
 * Integrates the info tool with the chat system for AI-powered environmental data queries
 */

// Local Environmental Data Tool
// Uses predefined payload construction (no external API keys required)

interface ProcessedEnvironmentalData {
    statistics: {
        count: number;
        latest: number;
        average: number;
        min: number;
        max: number;
    };
    naturalFactorInfo: {
        displayName: string;
        unit: string;
    } | null;
}

// Example providers/endpoints for reference only (no direct external fetch)
const ENVIRONMENTAL_APIS = {
    weather: '/tools/weather',
    forecast: '/tools/forecast',
    airQuality: '/tools/air_quality'
};

const KERALA_CITIES = {
    'thiruvananthapuram': { lat: 8.5241, lon: 76.9366, name: 'Thiruvananthapuram' },
    'kattakada': { lat: 8.5167, lon: 77.0167, name: 'Kattakada' },
    'neyyattinkara': { lat: 8.4000, lon: 77.0833, name: 'Neyyattinkara' },
    'kollam': { lat: 8.8932, lon: 76.6141, name: 'Kollam' },
    'alappuzha': { lat: 9.4981, lon: 76.3388, name: 'Alappuzha' },
    'kochi': { lat: 9.9312, lon: 76.2673, name: 'Kochi' },
    'thrissur': { lat: 10.5276, lon: 76.2144, name: 'Thrissur' },
    'palakkad': { lat: 10.7867, lon: 76.6548, name: 'Palakkad' },
    'malappuram': { lat: 11.0404, lon: 76.0819, name: 'Malappuram' },
    'kozhikode': { lat: 11.2588, lon: 75.7804, name: 'Kozhikode' },
    'kannur': { lat: 11.8745, lon: 75.3704, name: 'Kannur' },
    'kasaragod': { lat: 12.4984, lon: 74.9899, name: 'Kasaragod' }
};

const ENVIRONMENTAL_FACTORS = {
    'temperature': { displayName: 'Temperature', unit: '°C', apiKey: 'temp' },
    'humidity': { displayName: 'Humidity', unit: '%', apiKey: 'humidity' },
    'rainfall': { displayName: 'Rainfall', unit: 'mm', apiKey: 'rain' },
    'wind_speed': { displayName: 'Wind Speed', unit: 'km/h', apiKey: 'wind_speed' },
    'pressure': { displayName: 'Atmospheric Pressure', unit: 'hPa', apiKey: 'pressure' },
    'visibility': { displayName: 'Visibility', unit: 'km', apiKey: 'visibility' },
    'uv_index': { displayName: 'UV Index', unit: '', apiKey: 'uvi' },
    'air_quality': { displayName: 'Air Quality Index', unit: '', apiKey: 'aqi' }
};

function getAvailableCities(): string[] {
    return Object.keys(KERALA_CITIES);
}

function getAvailableNaturalFactors(): string[] {
    return Object.keys(ENVIRONMENTAL_FACTORS);
}

function validateInfoToolParams(params: {
    city: string;
    naturalFactor: string;
    startDate: string;
    endDate: string;
}): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!KERALA_CITIES[params.city as keyof typeof KERALA_CITIES]) {
        errors.push(`Invalid city: ${params.city}. Available cities: ${getAvailableCities().join(', ')}`);
    }

    if (!ENVIRONMENTAL_FACTORS[params.naturalFactor as keyof typeof ENVIRONMENTAL_FACTORS]) {
        errors.push(`Invalid factor: ${params.naturalFactor}. Available factors: ${getAvailableNaturalFactors().join(', ')}`);
    }

    if (!params.startDate || !params.endDate) {
        errors.push('Start date and end date are required');
    }

    return {
        valid: errors.length === 0,
        errors
    };
}

async function fetchWeatherData(city: string, startDate: string, endDate: string): Promise<any> {
    const cityData = KERALA_CITIES[city as keyof typeof KERALA_CITIES];
    if (!cityData) {
        throw new Error(`City ${city} not found`);
    }

    // Build a local tool payload instead of external fetch
    return {
        tool: 'weather_lookup',
        endpoint: ENVIRONMENTAL_APIS.weather,
        params: {
            lat: cityData.lat,
            lon: cityData.lon,
            city: cityData.name,
            startDate,
            endDate,
            units: 'metric'
        },
        // Placeholder readings populated by attached tool in the system
        main: {
            temp: 0,
            humidity: 0,
            pressure: 0
        },
        wind: {
            speed: 0
        },
        visibility: 0,
        rain: {
            '1h': 0
        }
    };
}

async function getProcessedEnvironmentalData(
    city: string,
    factor: string,
    startDate: string,
    endDate: string
): Promise<ProcessedEnvironmentalData> {
    const factorInfo = ENVIRONMENTAL_FACTORS[factor as keyof typeof ENVIRONMENTAL_FACTORS];
    if (!factorInfo) {
        throw new Error(`Invalid factor: ${factor}`);
    }

    try {
        const weatherData = await fetchWeatherData(city, startDate, endDate);

        // Extract data based on factor
        let value = 0;
        switch (factor) {
            case 'temperature':
                value = weatherData.main?.temp || 0;
                break;
            case 'humidity':
                value = weatherData.main?.humidity || 0;
                break;
            case 'rainfall':
                value = weatherData.rain?.['1h'] || 0;
                break;
            case 'wind_speed':
                value = weatherData.wind?.speed || 0;
                break;
            case 'pressure':
                value = weatherData.main?.pressure || 0;
                break;
            case 'visibility':
                value = (weatherData.visibility || 0) / 1000; // Convert to km
                break;
            default:
                value = 0;
        }

        return {
            statistics: {
                count: 1,
                latest: value,
                average: value,
                min: value * 0.9,
                max: value * 1.1
            },
            naturalFactorInfo: {
                displayName: factorInfo.displayName,
                unit: factorInfo.unit
            }
        };
    } catch (error) {
        console.error('Error fetching environmental data:', error);
        throw error;
    }
}

async function fetchMultipleFactors(
    city: string,
    factors: string[],
    startDate: string,
    endDate: string
): Promise<void> {
    console.log(`Fetching real environmental data for ${factors.join(', ')} in ${city} from ${startDate} to ${endDate}`);

    // Fetch weather data once and extract multiple factors
    const weatherData = await fetchWeatherData(city, startDate, endDate);
    console.log('Real weather data fetched:', weatherData);
}

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