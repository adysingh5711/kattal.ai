/**
 * API Integration Test Script
 * Tests the environmental data API tool integration to ensure AI can access sensor data
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Test configuration
const TEST_CONFIG = {
    baseUrl: 'http://localhost:3000',
    testQueries: [
        {
            name: 'Temperature Query',
            query: 'What is the current temperature in Nemom?',
            expectedToolCall: true,
            expectedCity: 'nemom',
            expectedFactor: 'temperature'
        },
        {
            name: 'Rainfall Query',
            query: 'Show me rainfall data for Vilavoorkkal in the last 24 hours',
            expectedToolCall: true,
            expectedCity: 'vilavoorkkal',
            expectedFactor: 'rainfall'
        },
        {
            name: 'Multiple Factors Query',
            query: 'Get temperature and humidity data for Malayinkeezhu',
            expectedToolCall: true,
            expectedCity: 'malayinkeezhu',
            expectedFactors: ['temperature', 'humidity']
        },
        {
            name: 'Non-Environmental Query',
            query: 'What is the capital of Kerala?',
            expectedToolCall: false
        }
    ]
};

// Colors for console output
const colors = {
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    reset: '\x1b[0m',
    bold: '\x1b[1m'
};

function log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

function logTest(testName, status, details = '') {
    const statusColor = status === 'PASS' ? 'green' : status === 'FAIL' ? 'red' : 'yellow';
    const statusSymbol = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⚠️';

    log(`${statusSymbol} ${testName}: ${status}`, statusColor);
    if (details) {
        log(`   ${details}`, 'blue');
    }
}

async function testAPIIntegration() {
    log('\n🧪 Starting API Integration Tests', 'bold');
    log('='.repeat(50), 'blue');

    let passedTests = 0;
    let totalTests = 0;

    // Test 1: Check if the application is running
    log('\n📡 Test 1: Application Health Check', 'bold');
    try {
        const response = await fetch(`${TEST_CONFIG.baseUrl}/api/chat`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                messages: [{ role: 'user', content: 'Hello' }]
            })
        });

        if (response.ok) {
            logTest('Application Health Check', 'PASS', 'Application is running and responding');
            passedTests++;
        } else {
            logTest('Application Health Check', 'FAIL', `HTTP ${response.status}: ${response.statusText}`);
        }
    } catch (error) {
        logTest('Application Health Check', 'FAIL', `Connection failed: ${error.message}`);
        log('\n❌ Cannot proceed with API tests. Please ensure the application is running on localhost:3000', 'red');
        return {
            totalTests: 1,
            passedTests: 0,
            successRate: 0
        };
    }
    totalTests++;

    // Test 2: Test environmental data tool calls
    log('\n🌡️ Test 2: Environmental Data Tool Calls', 'bold');

    for (const testCase of TEST_CONFIG.testQueries) {
        totalTests++;

        try {
            log(`\n   Testing: "${testCase.query}"`, 'blue');

            const response = await fetch(`${TEST_CONFIG.baseUrl}/api/chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    messages: [{ role: 'user', content: testCase.query }]
                })
            });

            if (!response.ok) {
                logTest(testCase.name, 'FAIL', `HTTP ${response.status}: ${response.statusText}`);
                continue;
            }

            const result = await response.json();

            // Check if environmental data was fetched
            const hasEnvironmentalData = result.environmentalData || result.environmentalSummary;
            const hasAnalysis = result.analysis;

            if (testCase.expectedToolCall) {
                if (hasEnvironmentalData || (hasAnalysis && hasAnalysis.queryType === 'environmental_data')) {
                    logTest(testCase.name, 'PASS', 'Environmental data tool was called successfully');
                    passedTests++;

                    // Log the response details
                    if (result.environmentalSummary) {
                        log(`   📊 Data Summary: ${result.environmentalSummary}`, 'green');
                    }
                    if (result.analysis) {
                        log(`   🔍 Query Type: ${result.analysis.queryType}`, 'blue');
                        log(`   ⚡ Processing Time: ${result.analysis.processingTime}ms`, 'blue');
                    }
                } else {
                    logTest(testCase.name, 'FAIL', 'Expected environmental data tool call but none was made');
                }
            } else {
                if (!hasEnvironmentalData && (!hasAnalysis || hasAnalysis.queryType !== 'environmental_data')) {
                    logTest(testCase.name, 'PASS', 'Correctly skipped environmental data tool call');
                    passedTests++;
                } else {
                    logTest(testCase.name, 'FAIL', 'Unexpectedly called environmental data tool');
                }
            }

        } catch (error) {
            logTest(testCase.name, 'FAIL', `Error: ${error.message}`);
        }
    }

    // Test 3: Test API configuration
    log('\n⚙️ Test 3: API Configuration Check', 'bold');
    totalTests++;

    try {
        // Check if info-tool-config exists and is properly configured
        const configPath = path.join(__dirname, '..', 'src', 'lib', 'info-tool-config.ts');
        if (fs.existsSync(configPath)) {
            const configContent = fs.readFileSync(configPath, 'utf8');

            // Check for required configuration elements
            const hasApiConfig = configContent.includes('apiConfig');
            const hasCities = configContent.includes('cities');
            const hasNaturalFactors = configContent.includes('naturalFactors');

            if (hasApiConfig && hasCities && hasNaturalFactors) {
                logTest('API Configuration', 'PASS', 'Configuration file is properly set up');
                passedTests++;
            } else {
                logTest('API Configuration', 'FAIL', 'Configuration file is missing required elements');
            }
        } else {
            logTest('API Configuration', 'FAIL', 'Configuration file not found');
        }
    } catch (error) {
        logTest('API Configuration', 'FAIL', `Error reading config: ${error.message}`);
    }

    // Test 4: Test tool integration in langchain
    log('\n🔗 Test 4: Tool Integration Check', 'bold');
    totalTests++;

    try {
        const langchainPath = path.join(__dirname, '..', 'src', 'lib', 'langchain.ts');
        if (fs.existsSync(langchainPath)) {
            const langchainContent = fs.readFileSync(langchainPath, 'utf8');

            // Check for environmental tool integration
            const hasEnvironmentalImport = langchainContent.includes('executeEnvironmentalDataTool');
            const hasEnvironmentalCheck = langchainContent.includes('isEnvironmentalQuery');
            const hasToolExecution = langchainContent.includes('environmentalData = await executeEnvironmentalDataTool');

            if (hasEnvironmentalImport && hasEnvironmentalCheck && hasToolExecution) {
                logTest('Tool Integration', 'PASS', 'Environmental tools are properly integrated');
                passedTests++;
            } else {
                logTest('Tool Integration', 'FAIL', 'Environmental tools are not properly integrated');
            }
        } else {
            logTest('Tool Integration', 'FAIL', 'Langchain file not found');
        }
    } catch (error) {
        logTest('Tool Integration', 'FAIL', `Error reading langchain: ${error.message}`);
    }

    // Summary
    log('\n📊 Test Summary', 'bold');
    log('='.repeat(50), 'blue');
    log(`Total Tests: ${totalTests}`, 'blue');
    log(`Passed: ${passedTests}`, 'green');
    log(`Failed: ${totalTests - passedTests}`, totalTests - passedTests > 0 ? 'red' : 'green');
    log(`Success Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`, passedTests === totalTests ? 'green' : 'yellow');

    if (passedTests === totalTests) {
        log('\n🎉 All tests passed! API tool integration is working correctly.', 'green');
    } else {
        log('\n⚠️ Some tests failed. Please check the issues above.', 'yellow');
    }

    return {
        totalTests,
        passedTests,
        successRate: (passedTests / totalTests) * 100
    };
}

// Run the tests
if (import.meta.url === `file://${process.argv[1]}`) {
    testAPIIntegration()
        .then((results) => {
            process.exit(results.successRate === 100 ? 0 : 1);
        })
        .catch((error) => {
            log(`\n💥 Test execution failed: ${error.message}`, 'red');
            process.exit(1);
        });
}

export { testAPIIntegration };
