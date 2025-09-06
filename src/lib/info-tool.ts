/**
 * Info Tool - Environmental Data API Client
 * Fetches environmental monitoring data from OpenIoT platform
 */

import { infoToolConfig, apiConfig } from './info-tool-config';

/**
 * Get query number based on city and natural factor
 */
export function getQueryNum(city: string, naturalFactor: string): number {
    const cityConfig = infoToolConfig.cities[city.toLowerCase()];
    if (!cityConfig) {
        throw new Error(`Unknown city: ${city}. Available cities: ${Object.keys(infoToolConfig.cities).join(', ')}`);
    }

    const queryNum = cityConfig.queryMappings[naturalFactor.toLowerCase()];
    if (!queryNum) {
        const availableFactors = Object.keys(cityConfig.queryMappings).join(', ');
        throw new Error(`Unknown natural factor: ${naturalFactor} for city: ${city}. Available factors: ${availableFactors}`);
    }

    return queryNum;
}

/**
 * Convert date string to timestamp format required by the API
 * Returns timestamp in milliseconds as string
 */
export function convertDate(dateStr: string): string {
    try {
        // Parse the date string
        const date = new Date(dateStr);

        if (isNaN(date.getTime())) {
            throw new Error(`Invalid date format: ${dateStr}`);
        }

        // Return timestamp in milliseconds as string
        return date.getTime().toString();
    } catch (error) {
        throw new Error(`Failed to convert date ${dateStr}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

/**
 * Get measurement name for a natural factor
 */
function getMeasurement(naturalFactor: string): string {
    const factorConfig = infoToolConfig.naturalFactors[naturalFactor.toLowerCase()];
    if (!factorConfig) {
        const availableFactors = Object.keys(infoToolConfig.naturalFactors).join(', ');
        throw new Error(`Unknown natural factor: ${naturalFactor}. Available factors: ${availableFactors}`);
    }
    return factorConfig.measurement;
}

/**
 * Get device name for a city
 */
function getDeviceName(city: string): string {
    const cityConfig = infoToolConfig.cities[city.toLowerCase()];
    if (!cityConfig) {
        throw new Error(`Unknown city: ${city}`);
    }
    return cityConfig.deviceName;
}

/**
 * Info Tool - Fetch environmental data from OpenIoT platform
 * Based on the refined method from the test notebook
 */
export async function infoTool(
    city: string,
    naturalFactor: string,
    startDate: string,
    endDate: string
): Promise<InfoToolResponse> {
    try {
        // Get query number and validate inputs
        const queryNum = getQueryNum(city, naturalFactor);

        // Convert dates to timestamp format
        const startTimestamp = convertDate(startDate);
        const endTimestamp = convertDate(endDate);

        // Get measurement and device mappings
        const measurement = getMeasurement(naturalFactor);
        const cityConfig = infoToolConfig.cities[city.toLowerCase()];
        const deviceName = cityConfig.deviceName;

        // API endpoint
        const url = `${apiConfig.baseUrl}/api/ds/query?ds_type=influxdb&requestId=Q${queryNum}`;

        // Headers (matching working API request)
        const dashboardUid = cityConfig.dashboardUid || apiConfig.dashboardUid;
        const headers = {
            "Accept": "application/json, text/plain, */*",
            "Accept-Encoding": "gzip, deflate, br, zstd",
            "Accept-Language": "en-US,en;q=0.9",
            "Host": "visualize.openiot.in",
            "Origin": "https://visualize.openiot.in",
            "Referer": `https://visualize.openiot.in/d/${dashboardUid}/aws-${city}?orgId=2&refresh=30s`,
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36",
            "content-type": "application/json",
            "sec-ch-ua": '"Not;A=Brand";v="99", "Google Chrome";v="139", "Chromium";v="139"',
            "sec-ch-ua-mobile": "?0",
            "sec-ch-ua-platform": '"Windows"',
            "x-dashboard-uid": dashboardUid,
            "x-datasource-uid": apiConfig.datasourceUid,
            "x-grafana-device-id": "fc87ffafff429df80b1da59e24bf3e21", // Correct device ID
            "x-grafana-org-id": apiConfig.grafanaOrgId,
            "x-panel-id": apiConfig.panelId,
            "x-panel-plugin-id": "stat",
            "x-plugin-id": "influxdb",
        };

        // Build InfluxDB Flux query (matching working API request)
        const fluxQuery = `from(bucket: "${apiConfig.bucket}")
  |> range(start: v.timeRangeStart, stop: v.timeRangeStop)
  |> filter(fn: (r) => r["device_name"] == "${deviceName}")
  |> filter(fn: (r) => r["_measurement"] == "${measurement}")
  |> aggregateWindow(every: v.windowPeriod, fn: last, createEmpty: false)
  |> map(fn:(r) => ({ r with _value: float(v: r._value)/10.0 })) 
  |> filter(fn: (r) => r["f_port"] == "2")
  |> yield(name: "last")`;

        // Payload (matching working API request)
        const payload = {
            queries: [
                {
                    datasource: { type: "influxdb", uid: apiConfig.datasourceUid },
                    query: fluxQuery,
                    refId: "A",
                    datasourceId: apiConfig.datasourceId,
                    intervalMs: 1,
                    maxDataPoints: 99999999,
                }
            ],
            from: startTimestamp,
            to: endTimestamp,
        };

        // Make the HTTP request
        console.log('🔧 API Request Details:', {
            url,
            city,
            naturalFactor,
            deviceName,
            measurement,
            queryNum,
            dashboardUid: cityConfig.dashboardUid,
            devEui: cityConfig.devEui
        });

        const response = await fetch(url, {
            method: 'POST',
            headers,
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('❌ API Error Response:', errorText);
            throw new Error(`API request failed with status ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        console.log('📊 API Response:', {
            hasResults: !!data.results,
            hasFrames: !!data.results?.A?.frames,
            frameCount: data.results?.A?.frames?.length || 0,
            dataValues: data.results?.A?.frames?.[0]?.data?.values?.length || 0
        });
        return data;

    } catch (error) {
        console.error('Error in infoTool:', error);
        throw new Error(`Failed to fetch environmental data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

/**
 * Get available cities
 */
export function getAvailableCities(): string[] {
    return Object.keys(infoToolConfig.cities);
}

/**
 * Get available natural factors
 */
export function getAvailableNaturalFactors(): string[] {
    return Object.keys(infoToolConfig.naturalFactors);
}

/**
 * Get natural factor information
 */
export function getNaturalFactorInfo(naturalFactor: string) {
    return infoToolConfig.naturalFactors[naturalFactor.toLowerCase()];
}

/**
 * Validate parameters before making API call
 */
export function validateInfoToolParams(params: InfoToolParams): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Validate city
    const availableCities = getAvailableCities();
    if (!availableCities.includes(params.city.toLowerCase())) {
        errors.push(`Invalid city "${params.city}". Available cities: ${availableCities.join(', ')}`);
    }

    // Validate natural factor
    const availableFactors = getAvailableNaturalFactors();
    if (!availableFactors.includes(params.naturalFactor.toLowerCase())) {
        errors.push(`Invalid natural factor "${params.naturalFactor}". Available factors: ${availableFactors.join(', ')}`);
    }

    // Validate dates
    try {
        convertDate(params.startDate);
    } catch (error) {
        errors.push(`Invalid start date "${params.startDate}": ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    try {
        convertDate(params.endDate);
    } catch (error) {
        errors.push(`Invalid end date "${params.endDate}": ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    // Validate date range
    if (errors.length === 0) {
        const startDate = new Date(params.startDate);
        const endDate = new Date(params.endDate);
        if (startDate >= endDate) {
            errors.push('Start date must be before end date');
        }
    }

    return {
        valid: errors.length === 0,
        errors
    };
}

/**
 * Optimized function to fetch multiple natural factors from the same device/sensor
 * Reuses the same query structure with only _measurement parameter changes
 */
export async function fetchMultipleFactors(
    city: string,
    naturalFactors: string[],
    startDate: string,
    endDate: string
): Promise<Record<string, InfoToolResponse>> {
    const cityConfig = infoToolConfig.cities[city.toLowerCase()];
    const deviceName = cityConfig.deviceName;
    const startTimestamp = convertDate(startDate);
    const endTimestamp = convertDate(endDate);

    // Group factors by their query numbers to batch API calls
    const factorsByQuery: Record<number, string[]> = {};

    naturalFactors.forEach(factor => {
        const queryNum = getQueryNum(city, factor);
        if (!factorsByQuery[queryNum]) {
            factorsByQuery[queryNum] = [];
        }
        factorsByQuery[queryNum].push(factor);
    });

    const results: Record<string, InfoToolResponse> = {};

    // Execute API calls for each unique query number
    const promises = Object.entries(factorsByQuery).map(async ([queryNumStr, factors]) => {
        const queryNum = parseInt(queryNumStr);

        // For each factor with the same query number, make separate calls
        // (since measurement is the key differentiator)
        const factorPromises = factors.map(async (factor) => {
            const measurement = getMeasurement(factor);

            const url = `${apiConfig.baseUrl}/api/ds/query?ds_type=influxdb&requestId=Q${queryNum}`;

            const dashboardUid = cityConfig.dashboardUid || apiConfig.dashboardUid;
            const headers = {
                "Accept": "application/json, text/plain, */*",
                "Accept-Encoding": "gzip, deflate, br, zstd",
                "Accept-Language": "en-US,en;q=0.9",
                "Host": "visualize.openiot.in",
                "Origin": "https://visualize.openiot.in",
                "Referer": `https://visualize.openiot.in/d/${dashboardUid}/aws-${city}?orgId=2&refresh=30s`,
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36",
                "content-type": "application/json",
                "sec-ch-ua": '"Not;A=Brand";v="99", "Google Chrome";v="139", "Chromium";v="139"',
                "sec-ch-ua-mobile": "?0",
                "sec-ch-ua-platform": '"Windows"',
                "x-dashboard-uid": dashboardUid,
                "x-datasource-uid": apiConfig.datasourceUid,
                "x-grafana-device-id": "fc87ffafff429df80b1da59e24bf3e21", // Correct device ID
                "x-grafana-org-id": apiConfig.grafanaOrgId,
                "x-panel-id": apiConfig.panelId,
                "x-panel-plugin-id": "stat",
                "x-plugin-id": "influxdb",
            };

            // The key optimization: only _measurement changes per factor
            const fluxQuery = `from(bucket: "${apiConfig.bucket}")
  |> range(start: v.timeRangeStart, stop: v.timeRangeStop)
  |> filter(fn: (r) => r["device_name"] == "${deviceName}")
  |> filter(fn: (r) => r["_measurement"] == "${measurement}")
  |> aggregateWindow(every: v.windowPeriod, fn: last, createEmpty: false)
  |> map(fn:(r) => ({ r with _value: float(v: r._value)/10.0 })) 
  |> filter(fn: (r) => r["f_port"] == "2")
  |> yield(name: "last")`;

            const payload = {
                queries: [
                    {
                        datasource: { type: "influxdb", uid: apiConfig.datasourceUid },
                        query: fluxQuery,
                        refId: "A",
                        datasourceId: apiConfig.datasourceId,
                        intervalMs: 1,
                        maxDataPoints: 99999999,
                    }
                ],
                from: startTimestamp,
                to: endTimestamp,
            };

            const response = await fetch(url, {
                method: 'POST',
                headers,
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                throw new Error(`API request failed for ${factor}: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();
            return { factor, data };
        });

        const factorResults = await Promise.all(factorPromises);
        factorResults.forEach(({ factor, data }) => {
            results[factor] = data;
        });
    });

    await Promise.all(promises);
    return results;
}

/**
 * Convenience function that validates parameters before calling infoTool
 */
export async function safeInfoTool(params: InfoToolParams): Promise<InfoToolResponse> {
    const validation = validateInfoToolParams(params);

    if (!validation.valid) {
        throw new Error(`Parameter validation failed: ${validation.errors.join(', ')}`);
    }

    return infoTool(params.city, params.naturalFactor, params.startDate, params.endDate);
}

/**
 * Extract data points from the API response
 * Returns an array of [timestamp, value] pairs
 */
export function extractDataPoints(apiResponse: InfoToolResponse): DataPoint[] {
    try {
        if (!apiResponse?.results?.A?.frames?.[0]?.data?.values) {
            return [];
        }

        const frame = apiResponse.results.A.frames[0];
        const timestamps = frame.data.values[0] || [];
        const values = frame.data.values[1] || [];

        // Combine timestamps and values into pairs
        const dataPoints: DataPoint[] = [];
        for (let i = 0; i < Math.min(timestamps.length, values.length); i++) {
            const timestamp = timestamps[i];
            const value = values[i];

            // Ensure we have valid numeric values
            if (timestamp !== null && timestamp !== undefined &&
                value !== null && value !== undefined &&
                typeof timestamp === 'number' && typeof value === 'number') {
                dataPoints.push([timestamp, value]);
            }
        }

        return dataPoints;
    } catch (error) {
        console.error('Error extracting data points:', error);
        return [];
    }
}

/**
 * Get basic statistics from data points
 */
export function getDataStatistics(dataPoints: Array<[number, number]>): {
    count: number;
    min: number | null;
    max: number | null;
    average: number | null;
    latest: number | null;
    latestTimestamp: number | null;
} {
    if (dataPoints.length === 0) {
        return {
            count: 0,
            min: null,
            max: null,
            average: null,
            latest: null,
            latestTimestamp: null
        };
    }

    const values = dataPoints.map(point => point[1]);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const average = values.reduce((sum, val) => sum + val, 0) / values.length;

    // Get the latest data point (assuming data is chronologically ordered)
    const latestPoint = dataPoints[dataPoints.length - 1];

    return {
        count: dataPoints.length,
        min,
        max,
        average: Number(average.toFixed(2)),
        latest: latestPoint[1],
        latestTimestamp: latestPoint[0]
    };
}

/**
 * Convenience function that fetches data and returns processed results
 */
export async function getProcessedEnvironmentalData(
    city: string,
    naturalFactor: string,
    startDate: string,
    endDate: string
): Promise<ProcessedEnvironmentalData> {
    const rawData = await safeInfoTool({ city, naturalFactor, startDate, endDate });
    const dataPoints = extractDataPoints(rawData);
    const statistics = getDataStatistics(dataPoints);
    const naturalFactorInfo = getNaturalFactorInfo(naturalFactor);

    return {
        rawData,
        dataPoints,
        statistics,
        naturalFactorInfo
    };
}

// Export types for better TypeScript support
export type InfoToolParams = {
    city: string;
    naturalFactor: string;
    startDate: string;
    endDate: string;
};

export interface InfluxDBFrame {
    schema: {
        name: string;
        refId: string;
        meta?: Record<string, unknown>;
        fields: Array<{
            name: string;
            type: string;
            typeInfo?: Record<string, unknown>;
            labels?: Record<string, string>;
        }>;
    };
    data: {
        values: Array<Array<number | string | null>>;
        nanos?: Array<number | null>;
    };
}

export interface InfoToolResponse {
    results: {
        A: {
            status: number;
            frames: InfluxDBFrame[];
        };
    };
}

export type NaturalFactorInfo = {
    measurement: string;
    displayName: string;
    unit: string;
};

export type ValidationResult = {
    valid: boolean;
    errors: string[];
};

export type DataPoint = [number, number]; // [timestamp, value]

export type DataStatistics = {
    count: number;
    min: number | null;
    max: number | null;
    average: number | null;
    latest: number | null;
    latestTimestamp: number | null;
};

export interface ProcessedEnvironmentalData {
    rawData: InfoToolResponse;
    dataPoints: DataPoint[];
    statistics: DataStatistics;
    naturalFactorInfo: NaturalFactorInfo | undefined;
}
