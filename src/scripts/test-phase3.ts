import { callChain } from "@/lib/langchain";
import { ResponseSynthesizer } from "@/lib/response-synthesizer";
import { QualityValidator } from "@/lib/quality-validator";
import { PerformanceOptimizer } from "@/lib/performance-optimizer";

// Test scenarios for Phase 3 features
const phase3TestQueries = [
    {
        query: "What are Kerala's main achievements in education?",
        expectedStyle: "explanatory",
        expectedComplexity: 2,
        description: "Simple factual query for baseline testing"
    },
    {
        query: "Compare Kerala's health indicators with the national average and explain the contributing factors",
        expectedStyle: "comparative",
        expectedComplexity: 4,
        description: "Complex comparative analysis requiring synthesis"
    },
    {
        query: "How do the economic policies discussed in the documents relate to the social development outcomes, and what are the long-term implications?",
        expectedStyle: "narrative",
        expectedComplexity: 5,
        description: "High-complexity inferential reasoning"
    },
    {
        query: "What is the population of Kattakkada?",
        expectedStyle: "explanatory",
        expectedComplexity: 1,
        description: "Simple factual lookup for caching test"
    },
    {
        query: "Analyze the trends shown in the development charts and their implications for future planning",
        expectedStyle: "analytical",
        expectedComplexity: 4,
        description: "Visual analysis and trend interpretation"
    }
];

async function testPhase3Features() {
    console.log("🚀 Testing Phase 3: Human-Like Communication & Quality\n");
    console.log("═".repeat(70));

    const performanceOptimizer = new PerformanceOptimizer();
    const qualityValidator = new QualityValidator();
    const responseSynthesizer = new ResponseSynthesizer();

    let totalQueries = 0;
    let totalTime = 0;
    let qualityScores: number[] = [];

    for (let i = 0; i < phase3TestQueries.length; i++) {
        const testCase = phase3TestQueries[i];
        console.log(`\n🧪 Test ${i + 1}: ${testCase.description}`);
        console.log(`Query: "${testCase.query}"`);
        console.log("─".repeat(60));

        try {
            const startTime = Date.now();

            // Test the complete enhanced pipeline
            const result = await callChain({
                question: testCase.query,
                chatHistory: ""
            });

            const endTime = Date.now();
            const processingTime = endTime - startTime;
            totalTime += processingTime;
            totalQueries++;

            // Analyze results
            console.log(`\n📊 Analysis Results:`);
            console.log(`   Query Type: ${result.analysis?.queryType || 'N/A'}`);
            console.log(`   Complexity: ${result.analysis?.complexity || 'N/A'} (expected: ${testCase.expectedComplexity})`);
            console.log(`   Response Style: ${result.analysis?.responseStyle || 'N/A'} (expected: ${testCase.expectedStyle})`);
            console.log(`   Confidence: ${result.analysis?.confidence ? (result.analysis.confidence * 100).toFixed(1) + '%' : 'N/A'}`);

            // Quality metrics
            if (result.quality) {
                console.log(`\n🎯 Quality Metrics:`);
                console.log(`   Overall Score: ${(result.quality.overallScore * 100).toFixed(1)}%`);
                console.log(`   Factual Accuracy: ${(result.quality.factualAccuracy * 100).toFixed(1)}%`);
                console.log(`   Completeness: ${(result.quality.completeness * 100).toFixed(1)}%`);
                console.log(`   Coherence: ${(result.quality.coherence * 100).toFixed(1)}%`);

                qualityScores.push(result.quality.overallScore);

                if (result.quality.issues && result.quality.issues.length > 0) {
                    console.log(`   Issues Found: ${result.quality.issues.length}`);
                    result.quality.issues.forEach((issue, idx) => {
                        console.log(`     ${idx + 1}. ${issue.type} (${issue.severity}): ${issue.description}`);
                    });
                }

                if (result.quality.improvements && result.quality.improvements.length > 0) {
                    console.log(`   Improvements:`);
                    result.quality.improvements.slice(0, 2).forEach((improvement, idx) => {
                        console.log(`     ${idx + 1}. ${improvement}`);
                    });
                }
            }

            // Performance metrics
            console.log(`\n⚡ Performance:`);
            console.log(`   Total Time: ${processingTime}ms`);
            console.log(`   Retrieval: ${result.analysis?.processingTime ? 'Optimized' : 'Standard'}`);
            console.log(`   Documents Used: ${result.analysis?.documentsUsed || 'N/A'}`);
            console.log(`   Strategy: ${result.analysis?.retrievalStrategy || 'N/A'}`);

            // Source attribution
            if (result.sources && result.sources.length > 0) {
                console.log(`\n📚 Sources (${result.sources.length}):`);
                result.sources.slice(0, 3).forEach((source: any, idx) => {
                    console.log(`   ${idx + 1}. ${source.source || `Source ${idx + 1}`} (${source.contentType || 'text'}) - ${source.usedFor || 'information'}`);
                });
            }

            // Response preview
            console.log(`\n💬 Response Preview:`);
            const responsePreview = result.text.slice(0, 300) + (result.text.length > 300 ? '...' : '');
            console.log(`   ${responsePreview}`);

            // Reasoning chain (if available)
            if (result.reasoning && result.reasoning.length > 0) {
                console.log(`\n🧠 Reasoning Chain:`);
                result.reasoning.slice(0, 2).forEach((step, idx) => {
                    console.log(`   ${idx + 1}. ${step.slice(0, 100)}...`);
                });
            }

            // Test expectations
            console.log(`\n✅ Validation:`);
            const complexityMatch = Math.abs((result.analysis?.complexity || 0) - testCase.expectedComplexity) <= 1;
            const styleMatch = result.analysis?.responseStyle === testCase.expectedStyle;
            const qualityGood = (result.quality?.overallScore || 0) > 0.7;

            console.log(`   Complexity Match: ${complexityMatch ? '✅' : '❌'}`);
            console.log(`   Style Match: ${styleMatch ? '✅' : '❌'}`);
            console.log(`   Quality Good: ${qualityGood ? '✅' : '❌'}`);

        } catch (error) {
            console.error(`❌ Error in test ${i + 1}:`, error);
        }

        console.log("─".repeat(60));
    }

    // Overall statistics
    console.log(`\n📈 Overall Test Results:`);
    console.log("═".repeat(70));

    if (qualityScores.length > 0) {
        const avgQuality = qualityScores.reduce((sum, score) => sum + score, 0) / qualityScores.length;
        const minQuality = Math.min(...qualityScores);
        const maxQuality = Math.max(...qualityScores);

        console.log(`Quality Statistics:`);
        console.log(`   Average Quality: ${(avgQuality * 100).toFixed(1)}%`);
        console.log(`   Quality Range: ${(minQuality * 100).toFixed(1)}% - ${(maxQuality * 100).toFixed(1)}%`);
        console.log(`   Queries Above 80%: ${qualityScores.filter(s => s > 0.8).length}/${qualityScores.length}`);
    }

    if (totalQueries > 0) {
        const avgTime = totalTime / totalQueries;
        console.log(`\nPerformance Statistics:`);
        console.log(`   Average Response Time: ${avgTime.toFixed(0)}ms`);
        console.log(`   Total Processing Time: ${(totalTime / 1000).toFixed(1)}s`);
        console.log(`   Queries Processed: ${totalQueries}`);
    }

    // Test individual components
    await testComponentsIndividually();

    // Performance optimization suggestions
    console.log(`\n🔧 Performance Optimization:`);
    const suggestions = performanceOptimizer.generateOptimizationSuggestions();
    if (suggestions.length > 0) {
        suggestions.forEach((suggestion, idx) => {
            console.log(`   ${idx + 1}. [${suggestion.priority.toUpperCase()}] ${suggestion.description}`);
            console.log(`      Expected: ${suggestion.expectedImprovement}`);
        });
    } else {
        console.log(`   No optimization suggestions - system performing well!`);
    }

    console.log(`\n🎉 Phase 3 Testing Complete!`);
    console.log(`\n🌟 Key Features Tested:`);
    console.log(`   ✓ Advanced Response Synthesis with reasoning chains`);
    console.log(`   ✓ Quality validation and scoring`);
    console.log(`   ✓ Performance optimization and caching`);
    console.log(`   ✓ Human-like communication styles`);
    console.log(`   ✓ Source attribution and citations`);
    console.log(`   ✓ Self-improvement suggestions`);
}

async function testComponentsIndividually() {
    console.log(`\n🔧 Individual Component Testing:`);
    console.log("─".repeat(40));

    // Test Response Synthesizer
    console.log(`\n1. Response Synthesizer Test`);
    const synthesizer = new ResponseSynthesizer();

    // Mock data for testing
    const mockQuery = "What are the key development indicators?";
    const mockAnalysis = {
        queryType: 'ANALYTICAL' as const,
        complexity: 3,
        keyEntities: ['Kerala', 'development'],
        requiresCrossReference: false,
        dataTypesNeeded: ['text', 'tables'],
        reasoningSteps: [],
        suggestedK: 6
    };

    const mockDocuments = [
        {
            pageContent: "Kerala has achieved significant progress in human development indicators, particularly in education and health sectors. The literacy rate stands at 93.91%, which is among the highest in India.",
            metadata: { source: "Development Report", hasTables: true }
        }
    ];

    try {
        const synthesis = await synthesizer.synthesizeResponse(
            mockQuery,
            mockAnalysis,
            mockDocuments as any[]
        );

        console.log(`   Response Style: ${synthesis.responseStyle}`);
        console.log(`   Confidence: ${(synthesis.confidence * 100).toFixed(1)}%`);
        console.log(`   Completeness: ${synthesis.completeness}`);
        console.log(`   Sources: ${synthesis.sourceAttribution.length}`);
        console.log(`   Reasoning Steps: ${synthesis.reasoningChain.length}`);
    } catch (error) {
        console.error(`   ❌ Synthesizer test failed:`, error);
    }

    // Test Quality Validator
    console.log(`\n2. Quality Validator Test`);
    const validator = new QualityValidator();

    const mockSynthesis = {
        synthesizedResponse: "Based on the available data, Kerala has achieved remarkable progress in human development indicators. The state's literacy rate of 93.91% significantly exceeds the national average, reflecting successful educational policies and community engagement.",
        reasoningChain: ["Identified key metrics", "Compared with benchmarks", "Drew conclusions"],
        confidence: 0.85,
        sourceAttribution: [{
            source: "Development Report",
            relevance: 0.9,
            usedFor: "statistical evidence",
            contentType: 'table' as const
        }],
        responseStyle: 'analytical' as const,
        completeness: 'complete' as const
    };

    try {
        const validation = await validator.validateResponse(
            mockQuery,
            mockAnalysis,
            mockSynthesis,
            mockDocuments as any[]
        );

        console.log(`   Overall Score: ${(validation.overallScore * 100).toFixed(1)}%`);
        console.log(`   Factual Accuracy: ${(validation.factualAccuracy * 100).toFixed(1)}%`);
        console.log(`   Completeness: ${(validation.completeness * 100).toFixed(1)}%`);
        console.log(`   Issues Found: ${validation.issues.length}`);
        console.log(`   Improvements: ${validation.improvements.length}`);
    } catch (error) {
        console.error(`   ❌ Validator test failed:`, error);
    }

    // Test Performance Optimizer
    console.log(`\n3. Performance Optimizer Test`);
    const optimizer = new PerformanceOptimizer();

    try {
        const optimization = await optimizer.optimizeQuery(mockQuery, mockAnalysis);
        console.log(`   Cache Key Generated: ${optimization.cacheKey.length > 0 ? '✅' : '❌'}`);
        console.log(`   Should Cache: ${optimization.shouldCache ? '✅' : '❌'}`);
        console.log(`   Estimated Time: ${optimization.estimatedTime}ms`);
        console.log(`   Optimized Query: "${optimization.optimizedQuery}"`);

        // Test performance tracking
        optimizer.trackPerformance({
            queryProcessingTime: 500,
            retrievalTime: 1200,
            synthesisTime: 800,
            validationTime: 300,
            totalTime: 2800,
            cacheHitRate: 0.3,
            documentsRetrieved: 6,
            qualityScore: 0.85
        });

        const stats = optimizer.getPerformanceStats();
        if (stats) {
            console.log(`   Performance Tracking: ✅`);
            console.log(`   Average Time: ${stats.avgTotalTime.toFixed(0)}ms`);
            console.log(`   Cache Hit Rate: ${(stats.cacheHitRate * 100).toFixed(1)}%`);
        }

    } catch (error) {
        console.error(`   ❌ Optimizer test failed:`, error);
    }

    console.log(`\n✅ Component Testing Complete!`);
}

// Run the tests
(async () => {
    try {
        await testPhase3Features();
    } catch (error) {
        console.error("Phase 3 testing failed:", error);
    }
})();
