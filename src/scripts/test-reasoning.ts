import { callChain } from "@/lib/langchain";

// Test queries of different complexity levels
const testQueries = [
    {
        question: "What is the population of Kerala?",
        expected: "FACTUAL",
        complexity: 1
    },
    {
        question: "Compare the performance of different districts in Kerala",
        expected: "COMPARATIVE",
        complexity: 3
    },
    {
        question: "What are the trends in Kerala's development over the past decade?",
        expected: "ANALYTICAL",
        complexity: 4
    },
    {
        question: "Why has Kerala achieved better health outcomes compared to other states?",
        expected: "INFERENTIAL",
        complexity: 4
    },
    {
        question: "How do Kerala's education policies relate to its economic development and what are the future implications?",
        expected: "SYNTHETIC",
        complexity: 5
    }
];

async function testReasoningSystem() {
    console.log("🧠 Testing Advanced Reasoning System\n");

    for (let i = 0; i < testQueries.length; i++) {
        const { question, expected, complexity } = testQueries[i];

        console.log(`\n📝 Test ${i + 1}: ${question}`);
        console.log(`Expected: ${expected} (Complexity: ${complexity})`);
        console.log("─".repeat(80));

        try {
            const startTime = Date.now();
            const result = await callChain({
                question,
                chatHistory: ""
            });
            const endTime = Date.now();

            console.log(`✅ Query Type: ${result.analysis?.queryType}`);
            console.log(`📊 Complexity: ${result.analysis?.complexity}`);
            console.log(`🔍 Strategy: ${result.analysis?.retrievalStrategy}`);
            console.log(`📚 Documents: ${result.analysis?.documentsUsed}`);
            console.log(`🔗 Cross-refs: ${result.analysis?.crossReferences?.length || 0}`);
            console.log(`⏱️  Time: ${endTime - startTime}ms`);
            console.log(`📝 Answer Preview: ${result.text.slice(0, 200)}...`);

            // Validate expectations
            const typeMatch = result.analysis?.queryType === expected;
            const complexityMatch = Math.abs((result.analysis?.complexity || 0) - complexity) <= 1;

            console.log(`✓ Type Match: ${typeMatch ? '✅' : '❌'}`);
            console.log(`✓ Complexity Match: ${complexityMatch ? '✅' : '❌'}`);

        } catch (error) {
            console.error(`❌ Error:`, error);
        }

        console.log("─".repeat(80));
    }

    console.log("\n🎉 Reasoning System Test Complete!");
}

// Run tests
(async () => {
    try {
        await testReasoningSystem();
    } catch (error) {
        console.error("Test failed:", error);
    }
})();
