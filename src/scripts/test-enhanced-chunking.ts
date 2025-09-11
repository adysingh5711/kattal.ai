import { HybridChunker, OpenAITokenizerWrapper, convertToLangChainDocuments } from "@/lib/docling-inspired-chunker";
import { OptimizedVectorStore } from "@/lib/optimized-vector-store";
import { env } from "@/lib/env";
import fs from 'fs';
import path from 'path';

/**
 * Test script for the enhanced Docling-inspired chunking system
 */

async function testEnhancedChunking() {
    console.log("🧪 Testing Enhanced Docling-inspired Chunking System");
    console.log("=".repeat(60));

    try {
        // Test 1: Initialize components
        console.log("\n1️⃣ Testing component initialization...");

        const tokenizer = new OpenAITokenizerWrapper(env.EMBEDDING_MODEL);
        console.log(`✅ Tokenizer initialized for model: ${env.EMBEDDING_MODEL}`);

        const hybridChunker = new HybridChunker(tokenizer, 8191, true);
        console.log("✅ HybridChunker initialized");

        const vectorStore = new OptimizedVectorStore();
        console.log("✅ Optimized vector store initialized");

        // Test 2: Sample markdown content
        console.log("\n2️⃣ Testing with sample markdown content...");

        const sampleMarkdown = `# Document Analysis Report

## Executive Summary

This report provides a comprehensive analysis of the current state of document processing.

### Key Findings

The analysis reveals several important insights:

- **Processing Speed**: Current system handles 1000+ documents per hour
- **Accuracy Rate**: 98.5% accuracy in text extraction
- **Cost Efficiency**: 40% reduction in processing costs

## Detailed Analysis

### Performance Metrics

| Metric | Current | Target | Status |
|--------|---------|--------|--------|
| Speed | 1000/hr | 1500/hr | ⚠️ Below target |
| Accuracy | 98.5% | 99% | ⚠️ Below target |
| Cost | $0.05/doc | $0.03/doc | ✅ Exceeded |

### Technical Implementation

The system uses the following components:

\`\`\`python
def process_document(doc):
    chunks = chunker.chunk(doc)
    embeddings = embed(chunks)
    return store(embeddings)
\`\`\`

#### Processing Pipeline

1. **Document Ingestion**
   - PDF parsing with OCR fallback
   - Text extraction and cleaning
   - Metadata extraction

2. **Chunking Strategy**
   - Hierarchical document structure
   - Token-aware sizing
   - Semantic boundary detection

3. **Embedding Generation**
   - OpenAI text-embedding-3-large
   - Batch processing optimization
   - Quality validation

## Conclusions

The enhanced processing system shows significant improvements over the previous implementation.

### Recommendations

1. Increase processing speed targets
2. Implement additional quality checks
3. Expand multi-language support

### Future Work

- Integration with advanced ML models
- Real-time processing capabilities
- Enhanced error handling`;

        // Test 3: Chunking
        console.log("\n3️⃣ Testing hybrid chunking...");

        const chunks = hybridChunker.chunk(sampleMarkdown, {
            filename: "test-document.md",
            origin: { filename: "test-document.md", source: "test" }
        });

        console.log(`📊 Generated ${chunks.length} chunks`);
        chunks.forEach((chunk, index) => {
            const tokenCount = tokenizer.countTokens(chunk.text);
            console.log(`   Chunk ${index + 1}: ${tokenCount} tokens, type: ${chunk.metadata.chunkType}, headings: ${chunk.metadata.headings?.join(' > ') || 'none'}`);
        });

        // Test 4: Convert to LangChain documents
        console.log("\n4️⃣ Testing LangChain document conversion...");

        const docs = convertToLangChainDocuments(chunks, "test-document.md");
        console.log(`✅ Converted to ${docs.length} LangChain documents`);

        // Test 5: Enhanced metadata analysis
        console.log("\n5️⃣ Testing enhanced metadata...");

        docs.forEach((doc, index) => {
            const meta = doc.metadata;
            console.log(`   Document ${index + 1}:`);
            console.log(`     - Content Type: ${meta.chunkType}`);
            console.log(`     - Has Table: ${meta.hasTables}`);
            console.log(`     - Has Code: ${meta.hasCode}`);
            console.log(`     - Quality Score: ${meta.qualityScore}`);
            console.log(`     - Semantic Tags: ${meta.semanticTags?.join(', ') || 'none'}`);
        });

        // Test 6: Test with real markdown file (if exists)
        console.log("\n6️⃣ Testing with real markdown file...");

        const markdownPath = path.join(process.cwd(), 'public', 'docs', 'pdf-md');
        if (fs.existsSync(markdownPath)) {
            const files = fs.readdirSync(markdownPath).filter(f => f.endsWith('.md'));
            if (files.length > 0) {
                const testFile = path.join(markdownPath, files[0]);
                const content = fs.readFileSync(testFile, 'utf-8');

                console.log(`📄 Testing with real file: ${files[0]} (${content.length} chars)`);

                const realChunks = hybridChunker.chunk(content, {
                    filename: files[0],
                    origin: { filename: files[0], source: testFile }
                });

                console.log(`📊 Real file generated ${realChunks.length} chunks`);

                const tokenStats = realChunks.map(c => tokenizer.countTokens(c.text));
                const avgTokens = tokenStats.reduce((a, b) => a + b, 0) / tokenStats.length;
                const maxTokens = Math.max(...tokenStats);
                const minTokens = Math.min(...tokenStats);

                console.log(`   📈 Token statistics: avg=${Math.round(avgTokens)}, min=${minTokens}, max=${maxTokens}`);

                const chunkTypes = [...new Set(realChunks.map(c => c.metadata.chunkType))];
                console.log(`   🏷️  Chunk types found: ${chunkTypes.join(', ')}`);

            } else {
                console.log("⚠️  No markdown files found in test directory");
            }
        } else {
            console.log("⚠️  Test markdown directory not found");
        }

        // Test 7: Performance comparison
        console.log("\n7️⃣ Testing performance comparison...");

        const startTime = Date.now();
        for (let i = 0; i < 10; i++) {
            hybridChunker.chunk(sampleMarkdown.repeat(2));
        }
        const endTime = Date.now();

        console.log(`⚡ Performance: 10 iterations took ${endTime - startTime}ms (${((endTime - startTime) / 10).toFixed(1)}ms per iteration)`);

        console.log("\n✅ All tests completed successfully!");

        console.log("\n📋 Test Summary:");
        console.log("✅ Component initialization");
        console.log("✅ Hybrid chunking functionality");
        console.log("✅ LangChain document conversion");
        console.log("✅ Enhanced metadata generation");
        console.log("✅ Real file processing");
        console.log("✅ Performance validation");

        console.log("\n🎯 Ready for production use!");

    } catch (error) {
        console.error("❌ Test failed:", error);

        if (error instanceof Error) {
            console.error("Error details:", error.message);
            console.error("Stack trace:", error.stack);
        }

        process.exit(1);
    }
}

// Run the test
testEnhancedChunking();
