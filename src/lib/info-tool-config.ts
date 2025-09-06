/**
 * Configuration for Info Tool
 * Contains mappings for cities, natural factors, and device configurations
 */

export interface CityConfig {
    queryMappings: Record<string, number>;
    deviceName: string;
    dashboardUid?: string;
    devEui?: string;
}

export interface InfoToolConfig {
    cities: Record<string, CityConfig>;
    naturalFactors: Record<string, {
        measurement: string;
        displayName: string;
        unit: string;
    }>;
}

/**
 * Configuration object for the Info Tool
 * Based on real API mappings from the OpenIoT platform
 */
export const infoToolConfig: InfoToolConfig = {
    // City configurations with query mappings and device names
    cities: {
        'vilavoorkkal': {
            deviceName: 'ICF_AWS02_003',
            queryMappings: {
                'humidity': 101,
                'temperature': 102,
                'rainfall': 103,
                'pressure': 104,
                'wind_speed': 105,
                'wind_direction': 106,
                'battery_voltage': 112
            }
        },
        'kulathummal': {
            deviceName: 'ICF_AWS02_002',
            queryMappings: {
                'humidity': 101,
                'temperature': 102,
                'rainfall': 103,
                'pressure': 104,
                'wind_speed': 105,
                'wind_direction': 106,
                'total_rainfall': 109,
                'battery_voltage': 113
            }
        },
        'malayinkeezhu': {
            deviceName: 'ICF_AWS02_004',
            queryMappings: {
                'humidity': 101,
                'temperature': 102,
                'rainfall': 103,
                'pressure': 104,
                'wind_speed': 105,
                'wind_direction': 106,
                'battery_voltage': 112
            }
        },
        'maranaloor': {
            deviceName: 'ICF_AWS02_001',
            queryMappings: {
                'humidity': 101,
                'temperature': 102,
                'rainfall': 103,
                'pressure': 104,
                'wind_speed': 105,
                'wind_direction': 106,
                'battery_voltage': 109
            }
        },
        'nemom': {
            deviceName: 'ICF_AWS02_005',
            dashboardUid: 'FBvwdZg4kjjjdaads',
            devEui: '0903060000010205',
            queryMappings: {
                'humidity': 101,
                'temperature': 102,
                'rainfall': 103,
                'pressure': 105,
                'wind_speed': 106,
                'wind_direction': 107,
                'battery_voltage': 114
            }
        },
        'peyad': {
            deviceName: 'ICF_AWS02_006',
            queryMappings: {
                'humidity': 101,
                'temperature': 102,
                'rainfall': 103,
                'pressure': 104,
                'wind_speed': 105,
                'wind_direction': 106,
                'battery_voltage': 111
            }
        }
    },

    // Natural factor configurations
    naturalFactors: {
        'temperature': {
            measurement: 'device_frmpayload_data_temperature',
            displayName: 'Temperature',
            unit: '°C'
        },
        'rainfall': {
            measurement: 'device_frmpayload_data_rainfall',
            displayName: 'Rainfall',
            unit: 'mm'
        },
        'total_rainfall': {
            measurement: 'device_frmpayload_data_total_rainfall',
            displayName: 'Total Rainfall',
            unit: 'mm'
        },
        'humidity': {
            measurement: 'device_frmpayload_data_humidity',
            displayName: 'Humidity',
            unit: '%'
        },
        'wind_speed': {
            measurement: 'device_frmpayload_data_wind_speed',
            displayName: 'Wind Speed',
            unit: 'm/s'
        },
        'wind_direction': {
            measurement: 'device_frmpayload_data_wind_direction',
            displayName: 'Wind Direction',
            unit: '°'
        },
        'pressure': {
            measurement: 'device_frmpayload_data_pressure',
            displayName: 'Pressure',
            unit: 'hPa'
        },
        'battery_voltage': {
            measurement: 'device_frmpayload_data_battery_voltage',
            displayName: 'Battery Voltage',
            unit: 'V'
        }
    }
};

/**
 * API Configuration
 */
export const apiConfig = {
    baseUrl: 'https://visualize.openiot.in',
    dashboardUid: 'OBBdNCmVzwsdsd',
    datasourceUid: 'd6ca7071-d94e-429f-8bbb-9b34956e04f3', // Correct datasource UID
    grafanaOrgId: '2',
    panelId: '5', // Correct panel ID
    datasourceId: 3, // Correct datasource ID
    bucket: 'AWSdb' // Correct bucket name
};

/**
 * Default headers for API requests
 */
export const defaultHeaders = {
    "Accept": "application/json, text/plain, */*",
    "Accept-Encoding": "gzip, deflate, br, zstd",
    "Accept-Language": "en-US,en;q=0.9",
    "Host": "visualize.openiot.in",
    "Origin": "https://visualize.openiot.in",
    "Referer": "https://visualize.openiot.in/d/OBBdNCmVzwsdsd/aletty-micro-climate-monitoring?orgId=2&from=now%2Ffy&to=now%2Ffy",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36",
    "content-type": "application/json",
    "sec-ch-ua": '"Not;A=Brand";v="99", "Google Chrome";v="139", "Chromium";v="139"',
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": '"Windows"',
    "x-dashboard-uid": "OBBdNCmVzwsdsd",
    "x-datasource-uid": "denukohoa42kgf",
    "x-grafana-device-id": "9ce10ff066bc28345d129ee3fb6c1018",
    "x-grafana-org-id": "2",
    "x-panel-id": "22",
    "x-panel-plugin-id": "stat",
    "x-plugin-id": "influxdb",
};
