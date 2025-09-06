/**
 * Info Tool - Environmental Data API Client
 *
 * Production-ready client for fetching environmental monitoring data
 * from the OpenIoT platform for Kerala districts.
 *
 * Features:
 * - Fetch environmental data by city and natural factor
 * - Support for multiple data types (temperature, rainfall, humidity, wind, pressure, battery)
 * - Real city and device mappings based on actual API endpoints
 * - Parameter validation and error handling
 * - TypeScript support with proper types
 *
 * Supported Cities:
 * - Vilavoorkkal, Kulathummal, Malayinkeezhu, Maranaloor, Nemom, Peyad
 *
 * Supported Natural Factors:
 * - temperature, rainfall, total_rainfall, humidity, wind_speed, wind_direction, pressure, battery_voltage
 *
 * Usage:
 * ```typescript
 * import { infoTool, safeInfoTool, getAvailableCities, getAvailableNaturalFactors } from './lib/info-tool-index';
 *
 * // Get available options
 * const cities = getAvailableCities();
 * const factors = getAvailableNaturalFactors();
 *
 * // Fetch data with validation
 * const data = await safeInfoTool({
 *   city: 'nemom',
 *   naturalFactor: 'temperature',
 *   startDate: '2024-01-01',
 *   endDate: '2024-01-31'
 * });
 * ```
 */

// Main functions
export {
    infoTool,
    safeInfoTool,
    getQueryNum,
    convertDate,
    getAvailableCities,
    getAvailableNaturalFactors,
    getNaturalFactorInfo,
    validateInfoToolParams,
    extractDataPoints,
    getDataStatistics,
    getProcessedEnvironmentalData,
    fetchMultipleFactors,
} from './info-tool';

// Configuration
export { infoToolConfig, apiConfig } from './info-tool-config';

// Types
export type {
    InfoToolParams,
    InfoToolResponse,
    NaturalFactorInfo,
    ValidationResult,
    DataPoint,
    DataStatistics,
    InfluxDBFrame,
    ProcessedEnvironmentalData,
} from './info-tool';

// Re-export types from config
export type { CityConfig, InfoToolConfig } from './info-tool-config';
