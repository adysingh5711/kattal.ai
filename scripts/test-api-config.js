/**
 * API Configuration Test Script
 * Tests the API tool configuration without requiring the application to be running
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

function testAPIConfiguration() {
    log('\n🧪 Starting API Configuration Tests', 'bold');
    log('='.repeat(50), 'blue');

    let passedTests = 0;
    let totalTests = 0;

    // Test 1: Check info-tool-config.ts
    log('\n⚙️ Test 1: API Configuration File', 'bold');
    totalTests++;

    try {
        const configPath = path.join(__dirname, '..', 'src', 'lib', 'info-tool-config.ts');
        if (fs.existsSync(configPath)) {
            const configContent = fs.readFileSync(configPath, 'utf8');

            // Check for required configuration elements
            const hasApiConfig = configContent.includes('apiConfig');
            const hasCities = configContent.includes('cities');
            const hasNaturalFactors = configContent.includes('naturalFactors');
            const hasBaseUrl = configContent.includes('baseUrl');
            const hasBucket = configContent.includes('bucket');

            if (hasApiConfig && hasCities && hasNaturalFactors && hasBaseUrl && hasBucket) {
                logTest('API Configuration File', 'PASS', 'Configuration file is properly set up');
                passedTests++;

                // Extract and display configuration details
                const cityMatches = configContent.match(/cities:\s*\{[^}]+}/s);
                if (cityMatches) {
                    const cityCount = (cityMatches[0].match(/[a-zA-Z_]+:/g) || []).length;
                    log(`   📍 Cities configured: ${cityCount}`, 'green');
                }

                const factorMatches = configContent.match(/naturalFactors:\s*\{[^}]+}/s);
                if (factorMatches) {
                    const factorCount = (factorMatches[0].match(/[a-zA-Z_]+:/g) || []).length;
                    log(`   🌡️ Natural factors configured: ${factorCount}`, 'green');
                }
            } else {
                const missing = [];
                if (!hasApiConfig) missing.push('apiConfig');
                if (!hasCities) missing.push('cities');
                if (!hasNaturalFactors) missing.push('naturalFactors');
                if (!hasBaseUrl) missing.push('baseUrl');
                if (!hasBucket) missing.push('bucket');
                logTest('API Configuration File', 'FAIL', `Missing elements: ${missing.join(', ')}`);
            }
        } else {
            logTest('API Configuration File', 'FAIL', 'Configuration file not found');
        }
    } catch (error) {
        logTest('API Configuration File', 'FAIL', `Error reading config: ${error.message}`);
    }

    // Test 2: Check info-tool.ts
    log('\n🔧 Test 2: API Client Implementation', 'bold');
    totalTests++;

    try {
        const toolPath = path.join(__dirname, '..', 'src', 'lib', 'info-tool.ts');
        if (fs.existsSync(toolPath)) {
            const toolContent = fs.readFileSync(toolPath, 'utf8');

            // Check for required functions
            const hasInfoTool = toolContent.includes('export async function infoTool');
            const hasSafeInfoTool = toolContent.includes('export async function safeInfoTool');
            const hasValidation = toolContent.includes('validateInfoToolParams');
            const hasDataExtraction = toolContent.includes('extractDataPoints');
            const hasStatistics = toolContent.includes('getDataStatistics');

            if (hasInfoTool && hasSafeInfoTool && hasValidation && hasDataExtraction && hasStatistics) {
                logTest('API Client Implementation', 'PASS', 'All required functions are implemented');
                passedTests++;
            } else {
                const missing = [];
                if (!hasInfoTool) missing.push('infoTool');
                if (!hasSafeInfoTool) missing.push('safeInfoTool');
                if (!hasValidation) missing.push('validateInfoToolParams');
                if (!hasDataExtraction) missing.push('extractDataPoints');
                if (!hasStatistics) missing.push('getDataStatistics');
                logTest('API Client Implementation', 'FAIL', `Missing functions: ${missing.join(', ')}`);
            }
        } else {
            logTest('API Client Implementation', 'FAIL', 'API client file not found');
        }
    } catch (error) {
        logTest('API Client Implementation', 'FAIL', `Error reading tool file: ${error.message}`);
    }

    // Test 3: Check ai-tools.ts
    log('\n🤖 Test 3: AI Tools Integration', 'bold');
    totalTests++;

    try {
        const aiToolsPath = path.join(__dirname, '..', 'src', 'lib', 'ai-tools.ts');
        if (fs.existsSync(aiToolsPath)) {
            const aiToolsContent = fs.readFileSync(aiToolsPath, 'utf8');

            // Check for required elements
            const hasToolDefinition = aiToolsContent.includes('environmentalDataTool');
            const hasExecuteFunction = aiToolsContent.includes('executeEnvironmentalDataTool');
            const hasQueryDetection = aiToolsContent.includes('isEnvironmentalQuery');
            const hasParameterExtraction = aiToolsContent.includes('extractParametersFromQuery');
            const hasToolSchema = aiToolsContent.includes('parameters:');

            if (hasToolDefinition && hasExecuteFunction && hasQueryDetection && hasParameterExtraction && hasToolSchema) {
                logTest('AI Tools Integration', 'PASS', 'All required elements are implemented');
                passedTests++;
            } else {
                const missing = [];
                if (!hasToolDefinition) missing.push('environmentalDataTool');
                if (!hasExecuteFunction) missing.push('executeEnvironmentalDataTool');
                if (!hasQueryDetection) missing.push('isEnvironmentalQuery');
                if (!hasParameterExtraction) missing.push('extractParametersFromQuery');
                if (!hasToolSchema) missing.push('tool schema');
                logTest('AI Tools Integration', 'FAIL', `Missing elements: ${missing.join(', ')}`);
            }
        } else {
            logTest('AI Tools Integration', 'FAIL', 'AI tools file not found');
        }
    } catch (error) {
        logTest('AI Tools Integration', 'FAIL', `Error reading AI tools file: ${error.message}`);
    }

    // Test 4: Check langchain.ts integration
    log('\n🔗 Test 4: Langchain Integration', 'bold');
    totalTests++;

    try {
        const langchainPath = path.join(__dirname, '..', 'src', 'lib', 'langchain.ts');
        if (fs.existsSync(langchainPath)) {
            const langchainContent = fs.readFileSync(langchainPath, 'utf8');

            // Check for environmental tool integration
            const hasEnvironmentalImport = langchainContent.includes('executeEnvironmentalDataTool');
            const hasEnvironmentalCheck = langchainContent.includes('isEnvironmentalQuery');
            const hasToolExecution = langchainContent.includes('environmentalData = await executeEnvironmentalDataTool');
            const hasEnvironmentalResponse = langchainContent.includes('environmentalData');

            if (hasEnvironmentalImport && hasEnvironmentalCheck && hasToolExecution && hasEnvironmentalResponse) {
                logTest('Langchain Integration', 'PASS', 'Environmental tools are properly integrated');
                passedTests++;
            } else {
                const missing = [];
                if (!hasEnvironmentalImport) missing.push('import executeEnvironmentalDataTool');
                if (!hasEnvironmentalCheck) missing.push('isEnvironmentalQuery check');
                if (!hasToolExecution) missing.push('tool execution');
                if (!hasEnvironmentalResponse) missing.push('environmental response handling');
                logTest('Langchain Integration', 'FAIL', `Missing elements: ${missing.join(', ')}`);
            }
        } else {
            logTest('Langchain Integration', 'FAIL', 'Langchain file not found');
        }
    } catch (error) {
        logTest('Langchain Integration', 'FAIL', `Error reading langchain file: ${error.message}`);
    }

    // Test 5: Check chat API route
    log('\n💬 Test 5: Chat API Route', 'bold');
    totalTests++;

    try {
        const chatRoutePath = path.join(__dirname, '..', 'src', 'app', 'api', 'chat', 'route.ts');
        if (fs.existsSync(chatRoutePath)) {
            const chatRouteContent = fs.readFileSync(chatRoutePath, 'utf8');

            // Check for required elements
            const hasCallChain = chatRouteContent.includes('callChain');
            const hasMessageHandling = chatRouteContent.includes('messages');
            const hasErrorHandling = chatRouteContent.includes('catch');
            const hasResponseFormat = chatRouteContent.includes('NextResponse.json');

            if (hasCallChain && hasMessageHandling && hasErrorHandling && hasResponseFormat) {
                logTest('Chat API Route', 'PASS', 'Chat API route is properly configured');
                passedTests++;
            } else {
                const missing = [];
                if (!hasCallChain) missing.push('callChain import');
                if (!hasMessageHandling) missing.push('message handling');
                if (!hasErrorHandling) missing.push('error handling');
                if (!hasResponseFormat) missing.push('response formatting');
                logTest('Chat API Route', 'FAIL', `Missing elements: ${missing.join(', ')}`);
            }
        } else {
            logTest('Chat API Route', 'FAIL', 'Chat API route file not found');
        }
    } catch (error) {
        logTest('Chat API Route', 'FAIL', `Error reading chat route file: ${error.message}`);
    }

    // Summary
    log('\n📊 Test Summary', 'bold');
    log('='.repeat(50), 'blue');
    log(`Total Tests: ${totalTests}`, 'blue');
    log(`Passed: ${passedTests}`, 'green');
    log(`Failed: ${totalTests - passedTests}`, totalTests - passedTests > 0 ? 'red' : 'green');
    log(`Success Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`, passedTests === totalTests ? 'green' : 'yellow');

    if (passedTests === totalTests) {
        log('\n🎉 All configuration tests passed! API tool integration is properly set up.', 'green');
        log('\n📋 Next Steps:', 'bold');
        log('1. Start the application: npm run dev', 'blue');
        log('2. Test with actual queries in the chat interface', 'blue');
        log('3. Monitor logs for tool execution', 'blue');
    } else {
        log('\n⚠️ Some configuration tests failed. Please check the issues above.', 'yellow');
    }

    return {
        totalTests,
        passedTests,
        successRate: (passedTests / totalTests) * 100
    };
}

// Run the tests
testAPIConfiguration();
