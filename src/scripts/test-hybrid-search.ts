#!/usr/bin/env tsx

import { config } from 'dotenv';
import { OptimizedVectorStore } from '../lib/optimized-vector-store';
import { HybridSearchEngine } from '../lib/hybrid-search-engine';
import { QueryAnalyzer } from '../lib/query-analyzer';
import { AdaptiveRetriever } from '../lib/adaptive-retriever';
import { Document } from 'langchain/document';

// Load environment variables
config();

interface TestCase {
    name: string;
    query: string;
    expectedDocuments?: number;
    expectedSearchMethod?: string[];
}

const testCases: TestCase[] = [
    {
        name: "Factual Query Test",
        query: "What are the development activities in Neyyattinkara?",
        expectedDocuments: 3,
        expectedSearchMethod: ["bm25", "hybrid"]
    },
    {
        name: "Analytical Query Test",
        query: "How does water quality impact community health outcomes?",
        expectedDocuments: 2,
        expectedSearchMethod: ["semantic", "hybrid"]
    },
    {
        name: "Procedural Query Test",
        query: "What steps are involved in project implementation?",
        expectedDocuments: 3,
        expectedSearchMethod: ["hybrid"]
    },
    {
        name: "Short Keyword Test",
        query: "Oppam",
        expectedDocuments: 2,
        expectedSearchMethod: ["bm25"]
    },
    {
        name: "Complex Conceptual Test",
        query: "Community engagement strategies for sustainable development initiatives",
        expectedDocuments: 4,
        expectedSearchMethod: ["semantic", "hybrid"]
    }
];

async function testHybridSearch() {
    console.log('🧪 Starting Hybrid Search Performance Tests\n');

    try {
        // Initialize components
        const vectorStore = new OptimizedVectorStore();
        const hybridSearch = new HybridSearchEngine(vectorStore);
        const queryAnalyzer = new QueryAnalyzer();
        const adaptiveRetriever = new AdaptiveRetriever(vectorStore, undefined, undefined, hybridSearch);

        // Check hybrid search health
        console.log('🏥 Checking hybrid search health...');
        const healthCheck = await hybridSearch.healthCheck();
        console.log(`Status: ${healthCheck.status}`);

        if (healthCheck.status !== 'healthy') {
            console.log('Issues:', healthCheck.issues);
            console.log('\n💡 To build the index, run: npm run build:hybrid-index\n');
        }

        console.log('Index Stats:', healthCheck.stats);
        console.log('');

        // Test each case
        const results = [];
        let totalTime = 0;

        for (let i = 0; i < testCases.length; i++) {
            const testCase = testCases[i];
            console.log(`\n📋 Test ${i + 1}: ${testCase.name}`);
            console.log(`Query: "${testCase.query}"`);

            const startTime = Date.now();

            try {
                // Step 1: Analyze query
                const analysis = await queryAnalyzer.classifyQuery(testCase.query);
                console.log(`   🧠 Analysis: ${analysis.queryType}, complexity: ${analysis.complexity}`);

                // Step 2: Test hybrid search directly (if available)
                let hybridResults;
                if (healthCheck.status === 'healthy') {
                    hybridResults = await hybridSearch.intelligentSearch(testCase.query, analysis, {
                        k: 5,
                        enableFuse: true
                    });
                    console.log(`   🔍 Hybrid Search: ${hybridResults.documents.length} docs, strategy: ${hybridResults.searchMetadata.searchStrategy}`);
                }

                // Step 3: Test adaptive retriever
                const adaptiveResults = await adaptiveRetriever.retrieve(testCase.query, analysis);
                console.log(`   🔄 Adaptive Retrieval: ${adaptiveResults.documents.length} docs, strategy: ${adaptiveResults.retrievalStrategy}`);

                const testTime = Date.now() - startTime;
                totalTime += testTime;

                // Step 4: Analyze results
                const searchMethods = new Set();
                adaptiveResults.documents.forEach(doc => {
                    if (doc.metadata?._searchMethod) {
                        searchMethods.add(doc.metadata._searchMethod);
                    }
                });

                const result = {
                    testCase: testCase.name,
                    query: testCase.query,
                    documentsFound: adaptiveResults.documents.length,
                    searchMethods: Array.from(searchMethods),
                    retrievalStrategy: adaptiveResults.retrievalStrategy,
                    confidence: adaptiveResults.confidence,
                    testTime,
                    hybridMetadata: adaptiveResults.hybridSearchMetadata,
                    success: true
                };

                results.push(result);

                console.log(`   ⏱️  Time: ${testTime}ms`);
                console.log(`   🎯 Confidence: ${(adaptiveResults.confidence * 100).toFixed(1)}%`);
                console.log(`   🔧 Search Methods: ${Array.from(searchMethods).join(', ') || 'none detected'}`);

                // Validate expectations
                const issues = [];
                if (testCase.expectedDocuments && adaptiveResults.documents.length < testCase.expectedDocuments) {
                    issues.push(`Expected ${testCase.expectedDocuments}+ docs, got ${adaptiveResults.documents.length}`);
                }

                if (testCase.expectedSearchMethod) {
                    const foundExpected = testCase.expectedSearchMethod.some(method => searchMethods.has(method));
                    if (!foundExpected) {
                        issues.push(`Expected search methods ${testCase.expectedSearchMethod.join('/')}, got ${Array.from(searchMethods).join('/')}`);
                    }
                }

                if (issues.length > 0) {
                    console.log(`   ⚠️  Issues: ${issues.join(', ')}`);
                } else {
                    console.log(`   ✅ Passed all expectations`);
                }

            } catch (error) {
                const testTime = Date.now() - startTime;
                totalTime += testTime;

                console.log(`   ❌ Failed: ${error.message}`);
                results.push({
                    testCase: testCase.name,
                    query: testCase.query,
                    error: error.message,
                    testTime,
                    success: false
                });
            }
        }

        // Summary
        console.log('\n📊 Test Summary');
        console.log('================');

        const successful = results.filter(r => r.success).length;
        const failed = results.length - successful;

        console.log(`✅ Successful tests: ${successful}/${results.length}`);
        console.log(`❌ Failed tests: ${failed}/${results.length}`);
        console.log(`⏱️  Total time: ${totalTime}ms`);
        console.log(`📈 Average time per test: ${(totalTime / results.length).toFixed(1)}ms`);

        if (successful > 0) {
            const successfulResults = results.filter(r => r.success);
            const avgDocs = successfulResults.reduce((sum, r) => sum + (r.documentsFound || 0), 0) / successfulResults.length;
            const avgConfidence = successfulResults.reduce((sum, r) => sum + (r.confidence || 0), 0) / successfulResults.length;

            console.log(`📚 Average documents found: ${avgDocs.toFixed(1)}`);
            console.log(`🎯 Average confidence: ${(avgConfidence * 100).toFixed(1)}%`);

            const strategies = new Set(successfulResults.map(r => r.retrievalStrategy));
            console.log(`🔧 Retrieval strategies used: ${Array.from(strategies).join(', ')}`);

            const allSearchMethods = new Set();
            successfulResults.forEach(r => {
                if (r.searchMethods) {
                    r.searchMethods.forEach(method => allSearchMethods.add(method));
                }
            });
            console.log(`🔍 Search methods used: ${Array.from(allSearchMethods).join(', ')}`);
        }

        // Performance recommendations
        console.log('\n💡 Recommendations');
        console.log('==================');

        if (healthCheck.status !== 'healthy') {
            console.log('🏗️  Build hybrid search index for better performance: npm run build:hybrid-index');
        }

        const slowTests = results.filter(r => r.testTime > 2000);
        if (slowTests.length > 0) {
            console.log(`⚡ Optimize slow queries (${slowTests.length} tests > 2s)`);
        }

        const lowConfidenceTests = results.filter(r => r.success && r.confidence && r.confidence < 0.7);
        if (lowConfidenceTests.length > 0) {
            console.log(`🎯 Review low confidence results (${lowConfidenceTests.length} tests < 70%)`);
        }

        if (failed === 0) {
            console.log('🎉 All tests passed! Hybrid search is working well.');
        }

    } catch (error) {
        console.error('❌ Test suite failed:', error);
        process.exit(1);
    }
}

// Run tests
testHybridSearch().catch(error => {
    console.error('❌ Test execution failed:', error);
    process.exit(1);
});
