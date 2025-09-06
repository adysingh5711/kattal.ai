/**
 * Test environmental query detection
 */

// Test the function directly
const testQuery = "What is the temperature in Nemom?";
const environmentalKeywords = [
    'weather', 'temperature', 'rainfall', 'humidity', 'wind', 'pressure',
    'climate', 'environmental', 'sensor', 'monitoring', 'data',
    'vilavoorkkal', 'kulathummal', 'malayinkeezhu', 'maranaloor', 'nemom', 'peyad',
    'temperature', 'rainfall', 'total_rainfall', 'humidity', 'wind_speed', 'wind_direction', 'pressure', 'battery_voltage'
];

const lowerQuery = testQuery.toLowerCase();
const result = environmentalKeywords.some(keyword => lowerQuery.includes(keyword.toLowerCase()));

console.log('🧪 Testing environmental query detection:');
console.log('Query:', testQuery);
console.log('Lower query:', lowerQuery);
console.log('Keywords:', environmentalKeywords);
console.log('Result:', result);

// Test individual keywords
console.log('\n🔍 Individual keyword tests:');
environmentalKeywords.forEach(keyword => {
    const matches = lowerQuery.includes(keyword.toLowerCase());
    if (matches) {
        console.log(`✅ "${keyword}" matches`);
    }
});
