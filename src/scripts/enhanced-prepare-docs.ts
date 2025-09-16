import { getChunkedDocsFromPDF, getChunkedDocsIncrementally } from "@/lib/pdf-loader";
import { processMalayalamDocuments } from "@/lib/malayalam-pinecone-processor";
import { env } from "@/lib/env";

/**
 * Enhanced document preparation script using Docling-inspired chunking and OpenAI embeddings
 * This script mimics the Python LanceDB approach but uses Pinecone as the vector store
 */

const mode = process.argv[2] || 'incremental';

(async () => {
    try {
        console.log("🚀 Starting Enhanced Document Preparation with Docling-inspired Chunking");
        console.log("=".repeat(70));

        console.log("✅ Malayalam processor will handle chunking and storage");

        if (mode === 'full' || mode === 'legacy') {
            console.log("\n🔄 Running in FULL REBUILD mode with Enhanced Processing...");
            console.log("⚠️  This will process ALL documents with Docling-inspired chunking");

            console.log("\n📄 Loading and chunking documents with hybrid chunker...");
            const docs = await getChunkedDocsFromPDF();
            console.log(`📊 Loaded ${docs.length} markdown documents`);

            // Enhanced document analysis
            console.log("\n🔍 Analyzing document composition...");
            const documentTypes = new Map<string, number>();
            const chunkTypes = new Map<string, number>();
            let totalTokens = 0;

            docs.forEach(doc => {
                const fileType = doc.metadata.fileType || 'unknown';
                const chunkType = doc.metadata.chunkType || 'text';

                documentTypes.set(fileType, (documentTypes.get(fileType) || 0) + 1);
                chunkTypes.set(chunkType, (chunkTypes.get(chunkType) || 0) + 1);

                if (doc.metadata.tokenCount) {
                    totalTokens += doc.metadata.tokenCount as number;
                }
            });

            console.log("\n📈 Document Analysis Results:");
            console.log(`📋 File Types: ${Array.from(documentTypes.entries()).map(([type, count]) => `${type}: ${count}`).join(', ')}`);
            console.log(`🧩 Chunk Types: ${Array.from(chunkTypes.entries()).map(([type, count]) => `${type}: ${count}`).join(', ')}`);
            console.log(`🔤 Total Tokens: ${totalTokens.toLocaleString()}`);

            console.log("\n🚀 Processing and storing documents via Malayalam processor...");
            const result = await processMalayalamDocuments(
                docs.map(d => ({ content: d.pageContent, filename: d.metadata.source || 'unknown.md', source: d.metadata.source || 'unknown' })),
                { namespace: env.PINECONE_NAMESPACE || 'malayalam-docs', enforceLanguage: false }
            );
            console.log("✅ Stored:", result);

            console.log("\n✅ Enhanced document preparation completed successfully!");

        } else {
            console.log("\n🔄 Running in INCREMENTAL mode with Enhanced Processing...");
            console.log("✅ Only new or changed documents will be processed with enhanced chunking");

            const result = await getChunkedDocsIncrementally({});

            if (result.documents.length > 0) {
                console.log(`\n🔄 Processing ${result.documents.length} new/updated chunks with enhanced embedding...`);
                const store = await processMalayalamDocuments(
                    result.documents.map(d => ({ content: d.pageContent, filename: d.metadata.source || 'unknown.md', source: d.metadata.source || 'unknown' })),
                    { namespace: env.PINECONE_NAMESPACE || 'malayalam-docs', enforceLanguage: false }
                );

                console.log('\n📊 ENHANCED INCREMENTAL UPDATE SUMMARY:');
                console.log('='.repeat(60));
                console.log(`📈 Total Documents: ${result.updateResult.totalDocuments}`);
                console.log(`➕ New Documents: ${result.updateResult.newDocuments}`);
                console.log(`🔄 Updated Documents: ${result.updateResult.updatedDocuments}`);
                console.log(`⏭️  Skipped Documents: ${result.updateResult.skippedDocuments}`);
                console.log(`📦 Processed Chunks: ${result.updateResult.processedChunks}`);
                console.log(`⏱️  Processing Time: ${(result.updateResult.processingTime / 1000).toFixed(2)}s`);
                console.log('='.repeat(60));
            } else {
                console.log("✨ No new or updated documents found - all data is up to date!");
            }
        }

        console.log("\n🎉 Enhanced Processing completed successfully!");

        // Show enhanced usage tips
        console.log("\n💡 Enhanced Features Added:");
        console.log("✨ Docling-inspired hierarchical chunking");
        console.log("🔤 Accurate token counting with tiktoken");
        console.log("🧠 Smart peer chunk merging");
        console.log("📊 Enhanced metadata with semantic tags");
        console.log("🎯 Quality scoring for chunks");
        console.log("🏷️  Dynamic namespacing by content type");

        console.log("\n🔧 Usage Commands:");
        console.log("- npm run enhanced:prepare - Incremental updates (recommended)");
        console.log("- npm run enhanced:prepare full - Complete rebuild");

    } catch (error) {
        console.error("❌ Enhanced document preparation failed:", error);

        // Enhanced error reporting
        if (error instanceof Error) {
            console.error("Error details:", error.message);
            if (error.stack) {
                console.error("Stack trace:", error.stack);
            }
        }

        process.exit(1);
    }
})();
