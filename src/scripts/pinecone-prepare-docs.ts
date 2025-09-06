import { getChunkedDocsFromPDF, getChunkedDocsIncrementally } from "@/lib/pdf-loader";
import { embedAndStoreDocs } from "@/lib/vector-store";
import { getPinecone } from "@/lib/pinecone-client";

// Enhanced script that supports both full rebuild and incremental updates
// Usage:
// - npm run docs:prepare - Incremental update (default)
// - npm run docs:prepare:full - Full rebuild (legacy mode)

const mode = process.argv[2] || 'incremental';

// This operation might fail because indexes likely need
// more time to init, so give some 5 mins after index
// creation and try again.
(async () => {
    try {
        const pineconeClient = await getPinecone();
        console.log("🔗 Connected to Pinecone");

        if (mode === 'full' || mode === 'legacy') {
            console.log("\n🔄 Running in FULL REBUILD mode...");
            console.log("⚠️  This will process ALL documents regardless of changes");

            console.log("\n📄 Preparing chunks from PDF files...");
            const docs = await getChunkedDocsFromPDF();

            console.log(`\n🚀 Loading ${docs.length} chunks into Pinecone...`);

            // Validate document sizes before processing
            const oversizedDocs = docs.filter(doc => doc.pageContent.length > 6000);
            if (oversizedDocs.length > 0) {
                console.warn(`⚠️  Found ${oversizedDocs.length} documents that may be too large for embedding`);
            }

            await embedAndStoreDocs(pineconeClient, docs);
            console.log("\n✅ Data embedded and stored in Pinecone index");
        } else {
            console.log("\n🔄 Running in INCREMENTAL mode...");
            console.log("✅ Only new or changed documents will be processed");

            const result = await getChunkedDocsIncrementally({
                enableBackup: true,
                batchSize: 50
            });

            console.log('\n📊 INCREMENTAL UPDATE SUMMARY:');
            console.log('='.repeat(50));
            console.log(`📈 Total Documents: ${result.updateResult.totalDocuments}`);
            console.log(`➕ New Documents: ${result.updateResult.newDocuments}`);
            console.log(`🔄 Updated Documents: ${result.updateResult.updatedDocuments}`);
            console.log(`⏭️  Skipped Documents: ${result.updateResult.skippedDocuments}`);
            console.log(`📦 Processed Chunks: ${result.updateResult.processedChunks}`);
            console.log(`⏱️  Processing Time: ${(result.updateResult.processingTime / 1000).toFixed(2)}s`);
            console.log('='.repeat(50));

            if (result.updateResult.newDocuments === 0 && result.updateResult.updatedDocuments === 0) {
                console.log("✨ No new or updated documents found - all data is up to date!");
            }
        }

        console.log("🎉 Processing completed successfully!");

        // Show usage tips
        console.log("\n💡 Usage Tips:");
        console.log("- Use `npm run docs:prepare` for incremental updates (recommended)");
        console.log("- Use `npm run docs:prepare full` for complete rebuild");
        console.log("- Use `npm run docs:status` to check current document status");

    } catch (error) {
        console.error("❌ Document preparation failed:", error);
        process.exit(1);
    }
})();