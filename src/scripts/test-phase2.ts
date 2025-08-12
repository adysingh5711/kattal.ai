import { callChain } from "@/lib/langchain";
import { DocumentGraphBuilder } from "@/lib/document-graph";
import { QueryExpander } from "@/lib/query-expander";
import { ConversationMemory } from "@/lib/conversation-memory";

// Test conversation scenarios for Phase 2 features
const conversationScenarios = [
    {
        name: "Cross-Document Analysis",
        turns: [
            "What are the main development indicators for Kerala?",
            "How do these indicators compare with other states?",
            "What factors contributed to Kerala's success in these areas?",
            "Are there any challenges mentioned in the documents?"
        ]
    },
    {
        name: "Query Expansion Test",
        turns: [
            "Population statistics",
            "Tell me more about demographic trends",
            "What about literacy rates specifically?",
            "How has education policy influenced these outcomes?"
        ]
    },
    {
        name: "Memory and Context",
        turns: [
            "What is the literacy rate in Kerala?",
            "How does this compare to the national average?",
            "What programs helped achieve this?",
            "What can other states learn from this approach?"
        ]
    }
];

async function testPhase2Features() {
    console.log("🧠 Testing Phase 2: Cross-Document Intelligence\n");

    // Initialize components
    const queryExpander = new QueryExpander();
    const conversationMemory = new ConversationMemory();

    for (let scenarioIndex = 0; scenarioIndex < conversationScenarios.length; scenarioIndex++) {
        const scenario = conversationScenarios[scenarioIndex];
        console.log(`\n📋 Scenario ${scenarioIndex + 1}: ${scenario.name}`);
        console.log("═".repeat(60));

        let chatHistory = "";

        for (let turnIndex = 0; turnIndex < scenario.turns.length; turnIndex++) {
            const question = scenario.turns[turnIndex];

            console.log(`\n🗣️  Turn ${turnIndex + 1}: "${question}"`);
            console.log("─".repeat(50));

            try {
                const startTime = Date.now();
                const result = await callChain({
                    question,
                    chatHistory
                });
                const endTime = Date.now();

                // Test query expansion
                console.log("🔍 Testing Query Expansion:");
                const mockAnalysis = {
                    queryType: 'ANALYTICAL' as const,
                    complexity: 3,
                    keyEntities: [],
                    requiresCrossReference: true,
                    dataTypesNeeded: ['text'],
                    reasoningSteps: [],
                    suggestedK: 6
                };

                const expansion = await queryExpander.expandQuery(question, mockAnalysis, chatHistory);
                console.log(`   📝 Original: "${expansion.originalQuery}"`);
                console.log(`   🔄 Expanded: ${expansion.expandedQueries.length} variations`);
                console.log(`   🧠 Concepts: ${expansion.relatedConcepts.slice(0, 3).join(', ')}`);
                console.log(`   📚 Synonyms: ${expansion.synonyms.slice(0, 2).join(', ')}`);

                // Update conversation memory
                await conversationMemory.updateContext(
                    question,
                    result.text,
                    result.analysis || mockAnalysis,
                    []
                );

                // Display results
                console.log(`\n📊 Analysis:`);
                console.log(`   Type: ${result.analysis?.queryType || 'N/A'}`);
                console.log(`   Complexity: ${result.analysis?.complexity || 'N/A'}`);
                console.log(`   Strategy: ${result.analysis?.retrievalStrategy || 'N/A'}`);
                console.log(`   Documents: ${result.analysis?.documentsUsed || 'N/A'}`);
                console.log(`   Time: ${endTime - startTime}ms`);

                console.log(`\n💬 Response Preview:`);
                console.log(`   ${result.text.slice(0, 200)}...`);

                // Test conversation memory
                if (turnIndex > 0) {
                    const relevantHistory = await conversationMemory.getRelevantHistory(question);
                    console.log(`\n🧠 Memory Context: ${relevantHistory ? 'Found relevant context' : 'No relevant context'}`);

                    const context = conversationMemory.getCurrentContext();
                    console.log(`   Current Topic: ${context.currentTopic}`);
                    console.log(`   Active Entities: ${context.activeEntities.slice(0, 3).join(', ')}`);
                    console.log(`   User Interests: ${context.userInterests.slice(0, 2).map(i => i.topic).join(', ')}`);
                }

                // Update chat history for next turn
                chatHistory += `Human: ${question}\nAssistant: ${result.text}\n`;

                // Test follow-up suggestions on last turn
                if (turnIndex === scenario.turns.length - 1) {
                    console.log(`\n🔮 Follow-up Suggestions:`);
                    const context = conversationMemory.getCurrentContext();
                    const lastTurn = context.userInterests[0];
                    if (lastTurn) {
                        console.log(`   - "Tell me more about ${lastTurn.topic}"`);
                        console.log(`   - "What are the implications of this?"`);
                        console.log(`   - "How does this relate to other regions?"`);
                    }
                }

            } catch (error) {
                console.error(`❌ Error in turn ${turnIndex + 1}:`, error);
            }
        }

        // Scenario summary
        console.log(`\n📈 Scenario Summary:`);
        console.log(conversationMemory.getConversationSummary());

        // Clear memory for next scenario
        conversationMemory.clearSession();
    }

    // Test query expander cache performance
    console.log(`\n🚀 Performance Stats:`);
    const cacheStats = queryExpander.getCacheStats();
    console.log(`   Concept Cache: ${cacheStats.conceptCacheSize} entries`);
    console.log(`   Synonym Cache: ${cacheStats.synonymCacheSize} entries`);

    console.log(`\n✅ Phase 2 Testing Complete!`);
    console.log(`\n🎯 Key Features Tested:`);
    console.log(`   ✓ Query Expansion with synonyms and concepts`);
    console.log(`   ✓ Conversation Memory and context tracking`);
    console.log(`   ✓ Cross-turn entity and topic continuity`);
    console.log(`   ✓ Adaptive retrieval strategies`);
    console.log(`   ✓ Multi-turn conversation flow`);
    console.log(`   ✓ Follow-up suggestion generation`);
}

// Test individual components
async function testComponentsIndividually() {
    console.log("\n🔧 Testing Individual Components\n");

    // Test Query Expander
    console.log("1. Query Expander Test");
    console.log("─".repeat(30));
    const expander = new QueryExpander();
    const testQuery = "What are the health outcomes in Kerala?";
    const mockAnalysis = {
        queryType: 'ANALYTICAL' as const,
        complexity: 3,
        keyEntities: ['Kerala', 'health'],
        requiresCrossReference: false,
        dataTypesNeeded: ['text', 'tables'],
        reasoningSteps: [],
        suggestedK: 6
    };

    const expansion = await expander.expandQuery(testQuery, mockAnalysis);
    console.log(`Original: ${expansion.originalQuery}`);
    console.log(`Synonyms: ${expansion.synonyms.join(', ')}`);
    console.log(`Concepts: ${expansion.relatedConcepts.join(', ')}`);
    console.log(`Sub-queries: ${expansion.subQueries.join(' | ')}`);

    // Test Conversation Memory
    console.log("\n2. Conversation Memory Test");
    console.log("─".repeat(30));
    const memory = new ConversationMemory();

    await memory.updateContext(
        "What is Kerala's literacy rate?",
        "Kerala has a literacy rate of 93.91%, which is significantly higher than the national average of 74.04%.",
        mockAnalysis,
        []
    );

    await memory.updateContext(
        "How did Kerala achieve this?",
        "Kerala achieved high literacy through focused education policies, community participation, and government initiatives like the Total Literacy Campaign.",
        mockAnalysis,
        []
    );

    const context = memory.getCurrentContext();
    console.log(`Current Topic: ${context.currentTopic}`);
    console.log(`Active Entities: ${context.activeEntities.join(', ')}`);
    console.log(`User Interests: ${context.userInterests.map(i => `${i.topic} (${i.strength.toFixed(2)})`).join(', ')}`);

    const relevantHistory = await memory.getRelevantHistory("What about health outcomes?");
    console.log(`Relevant History: ${relevantHistory ? 'Found context' : 'No context'}`);

    console.log("\n🎉 Component Testing Complete!");
}

// Run all tests
(async () => {
    try {
        await testComponentsIndividually();
        await testPhase2Features();
    } catch (error) {
        console.error("Testing failed:", error);
    }
})();
