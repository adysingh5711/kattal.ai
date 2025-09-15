import { HybridChunker, OpenAITokenizerWrapper } from "@/lib/docling-inspired-chunker";
import { env } from "@/lib/env";

/**
 * Test script to compare different table serialization strategies
 * Tests plain text flattening vs structured table serialization
 */

interface TableSerializationResult {
    strategy: string;
    preservesHeaders: boolean;
    preservesStructure: boolean;
    readabilityScore: number;
    chunkCount: number;
    averageChunkSize: number;
}

const SAMPLE_TABLES = {
    simple: `
| പദ്ധതി | ബജറ്റ് | സ്ഥിതി |
|--------|---------|---------|
| റോഡ് നിർമ്മാണം | ₹50 ലക്ഷം | പുരോഗമിക്കുന്നു |
| സ്കൂൾ കെട്ടിടം | ₹30 ലക്ഷം | പൂർത്തീകരിച്ചു |
| ആശുപത്രി | ₹75 ലക്ഷം | ആരംഭിച്ചു |
`,

    complex: `
| ജില്ല | പ്രോജക്ട് | വിഭാഗം | ബജറ്റ് (₹ ലക്ഷം) | പുരോഗതി (%) | പൂർത്തീകരണ തീയതി |
|-------|----------|----------|-------------------|---------------|------------------|
| തിരുവനന്തപുരം | റോഡ് വികസനം | Infrastructure | 150 | 75 | 2024-12-31 |
| കൊല്ലം | വിദ്യാലയം | Education | 85 | 90 | 2024-10-15 |
| പത്തനംതിട്ട | ആരോഗ്യ കേന്ദ്രം | Healthcare | 120 | 60 | 2025-03-30 |
| ആലപ്പുഴ | കാർഷിക കേന്ദ്രം | Agriculture | 95 | 80 | 2024-11-20 |
`,

    nested: `
## വികസന പദ്ധതികൾ

### വടക്കൻ കേരളം

| ജില്ല | പ്രധാന പദ്ധതികൾ |
|-------|-------------------|
| കാസർഗോഡ് | തീരദേശ സംരക്ഷണം |
| കണ്ണൂർ | വ്യവസായ പാർക്ക് |

#### പുരോഗതി റിപ്പോർട്ട്

| മാസം | ലക്ഷ്യം | നേടിയത് | ശതമാനം |
|------|---------|----------|----------|
| ജനുവരി | 100 | 85 | 85% |
| ഫെബ്രുവരി | 120 | 110 | 92% |

### മധ്യ കേരളം

| ജില്ല | ബജറ്റ് വിഹിതം |
|-------|----------------|
| എറണാകുളം | ₹200 കോടി |
| ഇടുക്കി | ₹150 കോടി |
`
};

class TableSerializer {
    static plainTextFlattening(tableMarkdown: string): string {
        // Simple approach - just remove table formatting
        return tableMarkdown
            .replace(/\|/g, ' ')
            .replace(/[-\s]+/g, ' ')
            .replace(/\n+/g, ' ')
            .trim();
    }

    static structuredSerialization(tableMarkdown: string): string {
        const lines = tableMarkdown.trim().split('\n');
        const result: string[] = [];

        let headers: string[] = [];
        let isFirstDataRow = true;

        for (const line of lines) {
            if (!line.includes('|')) continue;

            const cells = line.split('|')
                .map(cell => cell.trim())
                .filter(cell => cell.length > 0);

            // Skip separator lines
            if (cells.every(cell => cell.match(/^[-\s]*$/))) continue;

            if (headers.length === 0) {
                // First row is headers
                headers = cells;
                result.push(`Table Headers: ${headers.join(', ')}`);
            } else {
                // Data rows
                if (isFirstDataRow) {
                    result.push('Table Data:');
                    isFirstDataRow = false;
                }

                const rowData = cells.map((cell, index) =>
                    `${headers[index] || `Column${index + 1}`}: ${cell}`
                ).join(', ');

                result.push(`Row: ${rowData}`);
            }
        }

        return result.join('\n');
    }

    static doclingInspiredSerialization(tableMarkdown: string): string {
        const lines = tableMarkdown.trim().split('\n');
        const result: string[] = [];

        let headers: string[] = [];
        let tableTitle = '';

        // Look for table title (preceding heading)
        const precedingLines = tableMarkdown.split('\n');
        for (let i = precedingLines.length - 1; i >= 0; i--) {
            const line = precedingLines[i].trim();
            if (line.startsWith('#')) {
                tableTitle = line.replace(/^#+\s*/, '');
                break;
            }
        }

        if (tableTitle) {
            result.push(`Table: ${tableTitle}`);
        }

        for (const line of lines) {
            if (!line.includes('|')) continue;

            const cells = line.split('|')
                .map(cell => cell.trim())
                .filter(cell => cell.length > 0);

            // Skip separator lines
            if (cells.every(cell => cell.match(/^[-\s]*$/))) continue;

            if (headers.length === 0) {
                headers = cells;
                result.push(`Columns: ${headers.join(' | ')}`);
            } else {
                // Create semantic row description
                const semanticRow = cells.map((cell, index) => {
                    const header = headers[index] || `Column${index + 1}`;
                    return `${header} is ${cell}`;
                }).join(', ');

                result.push(semanticRow);
            }
        }

        return result.join('\n');
    }
}

async function testTableSerialization(): Promise<void> {
    console.log("🧪 Testing Table Serialization Strategies");
    console.log("=".repeat(60));

    const tokenizer = new OpenAITokenizerWrapper();
    const results: TableSerializationResult[] = [];

    for (const [tableName, tableContent] of Object.entries(SAMPLE_TABLES)) {
        console.log(`\n📊 Testing ${tableName} table...`);
        console.log("-".repeat(40));

        // Test different serialization strategies
        const strategies = [
            { name: 'Plain Text Flattening', func: TableSerializer.plainTextFlattening },
            { name: 'Structured Serialization', func: TableSerializer.structuredSerialization },
            { name: 'Docling-Inspired', func: TableSerializer.doclingInspiredSerialization }
        ];

        for (const strategy of strategies) {
            console.log(`\n🔧 Testing ${strategy.name}...`);

            const serialized = strategy.func(tableContent);

            // Test chunking with this serialization
            const hybridChunker = new HybridChunker(tokenizer, 1000, true); // Smaller chunks for testing
            const chunks = hybridChunker.chunk(serialized);

            // Analyze results
            const result: TableSerializationResult = {
                strategy: strategy.name,
                preservesHeaders: checkHeaderPreservation(serialized, tableContent),
                preservesStructure: checkStructurePreservation(serialized, tableContent),
                readabilityScore: calculateReadabilityScore(serialized),
                chunkCount: chunks.length,
                averageChunkSize: chunks.reduce((sum, chunk) => sum + chunk.text.length, 0) / chunks.length
            };

            results.push(result);

            console.log(`   Headers Preserved: ${result.preservesHeaders ? '✅' : '❌'}`);
            console.log(`   Structure Preserved: ${result.preservesStructure ? '✅' : '❌'}`);
            console.log(`   Readability Score: ${result.readabilityScore.toFixed(2)}/10`);
            console.log(`   Chunks Created: ${result.chunkCount}`);
            console.log(`   Average Chunk Size: ${Math.round(result.averageChunkSize)} characters`);

            console.log(`\n   Sample Output:`);
            console.log(`   "${serialized.substring(0, 150)}..."`);
        }
    }

    // Generate comparison report
    console.log("\n📋 SERIALIZATION STRATEGY COMPARISON");
    console.log("=".repeat(50));

    const strategyStats = results.reduce((acc, result) => {
        if (!acc[result.strategy]) {
            acc[result.strategy] = {
                headerPreservation: 0,
                structurePreservation: 0,
                averageReadability: 0,
                averageChunkCount: 0,
                count: 0
            };
        }

        const stats = acc[result.strategy];
        stats.headerPreservation += result.preservesHeaders ? 1 : 0;
        stats.structurePreservation += result.preservesStructure ? 1 : 0;
        stats.averageReadability += result.readabilityScore;
        stats.averageChunkCount += result.chunkCount;
        stats.count++;

        return acc;
    }, {} as any);

    for (const [strategy, stats] of Object.entries(strategyStats)) {
        const typedStats = stats as any;
        console.log(`\n🔧 ${strategy}:`);
        console.log(`   Header Preservation: ${typedStats.headerPreservation}/${typedStats.count} tables`);
        console.log(`   Structure Preservation: ${typedStats.structurePreservation}/${typedStats.count} tables`);
        console.log(`   Average Readability: ${(typedStats.averageReadability / typedStats.count).toFixed(2)}/10`);
        console.log(`   Average Chunk Count: ${(typedStats.averageChunkCount / typedStats.count).toFixed(1)}`);
    }

    // Recommendations
    console.log("\n💡 RECOMMENDATIONS");
    console.log("=".repeat(30));

    const bestStrategy = Object.entries(strategyStats)
        .map(([name, stats]) => {
            const typedStats = stats as any;
            return {
                name,
                score: (typedStats.headerPreservation + typedStats.structurePreservation) / typedStats.count +
                    (typedStats.averageReadability / typedStats.count) / 10
            };
        })
        .sort((a, b) => b.score - a.score)[0];

    console.log(`🏆 Best Overall Strategy: ${bestStrategy.name}`);
    console.log(`📊 Composite Score: ${bestStrategy.score.toFixed(2)}`);

    // Save results
    const resultsPath = `./table-serialization-results-${Date.now()}.json`;
    require('fs').writeFileSync(resultsPath, JSON.stringify(results, null, 2));
    console.log(`\n💾 Results saved to: ${resultsPath}`);
}

function checkHeaderPreservation(serialized: string, original: string): boolean {
    // Extract headers from original table
    const lines = original.split('\n');
    const headerLine = lines.find(line => line.includes('|') && !line.match(/^[-\s|]*$/));

    if (!headerLine) return false;

    const headers = headerLine.split('|')
        .map(h => h.trim())
        .filter(h => h.length > 0);

    // Check if most headers are preserved in serialized version
    const preservedCount = headers.filter(header =>
        serialized.toLowerCase().includes(header.toLowerCase())
    ).length;

    return preservedCount >= headers.length * 0.8; // 80% threshold
}

function checkStructurePreservation(serialized: string, original: string): boolean {
    // Count rows in original
    const originalRows = original.split('\n')
        .filter(line => line.includes('|') && !line.match(/^[-\s|]*$/))
        .length;

    // Check if serialized version maintains row concept
    const hasRowConcept = serialized.toLowerCase().includes('row') ||
        serialized.includes('\n') ||
        serialized.split(',').length >= originalRows;

    return hasRowConcept && originalRows > 1;
}

function calculateReadabilityScore(text: string): number {
    // Simple readability score based on:
    // - Sentence structure
    // - Word distribution
    // - Information density

    let score = 5; // Base score

    // Bonus for proper sentence structure
    if (text.includes('.') || text.includes(':')) score += 1;

    // Bonus for maintaining key-value pairs
    if (text.includes(':') && text.split(':').length > 2) score += 2;

    // Penalty for excessive repetition
    const words = text.toLowerCase().split(/\s+/);
    const uniqueWords = new Set(words);
    const repetitionRatio = uniqueWords.size / words.length;
    if (repetitionRatio < 0.5) score -= 2;

    // Bonus for logical flow
    if (text.includes('Table') || text.includes('Column') || text.includes('Row')) score += 1;

    // Penalty for excessive length without structure
    if (text.length > 500 && !text.includes('\n')) score -= 1;

    return Math.max(0, Math.min(10, score));
}

// Run the test
if (require.main === module) {
    testTableSerialization().catch(console.error);
}

export { testTableSerialization };
export type { TableSerializationResult };
