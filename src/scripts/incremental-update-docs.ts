import { getChunkedDocsIncrementally, getDocumentStatus } from "@/lib/pdf-loader";
import { processMalayalamDocuments } from "@/lib/malayalam-pinecone-processor";
import { env } from "@/lib/env";

/**
 * Script to add new documents incrementally without disturbing existing data
 * Usage:
 * - npm run docs:update - Normal incremental update
 * - npm run docs:update:force - Force reprocess all documents
 * - npm run docs:status - Check current document status
 */

const command = process.argv[2] || 'update';

(async () => {
    try {
        console.log('🚀 Starting incremental document update...');
        console.log("🔗 Ready to process Malayalam documents");

        switch (command) {
            case 'status':
                await showDocumentStatus();
                break;

            case 'force':
                await updateDocuments({ forceReprocess: true });
                break;

            case 'update':
            default:
                await updateDocuments();
                break;
        }

        console.log("🎉 Operation completed successfully!");

    } catch (error) {
        console.error("❌ Operation failed:", error);
        process.exit(1);
    }
})();

async function showDocumentStatus(): Promise<void> {
    console.log('\n📊 Current Document Status:');
    console.log('='.repeat(50));

    const status = await getDocumentStatus();

    console.log(`Total Documents: ${status.totalDocuments}`);
    console.log(`Total Chunks: ${status.totalChunks}`);
    console.log(`Last Update: ${status.lastUpdate ? new Date(status.lastUpdate).toLocaleString() : 'Never'}`);

    if (status.documents.length > 0) {
        console.log('\nDocument Details:');
        console.log('-'.repeat(50));

        status.documents.forEach(doc => {
            const fileName = doc.source.split('/').pop() || doc.source;
            const lastMod = new Date(doc.lastModified).toLocaleDateString();
            const processed = new Date(doc.processingTimestamp).toLocaleDateString();

            console.log(`📄 ${fileName}`);
            console.log(`   Chunks: ${doc.chunkCount}`);
            console.log(`   Size: ${(doc.size / 1024).toFixed(1)} KB`);
            console.log(`   Modified: ${lastMod}`);
            console.log(`   Processed: ${processed}`);
            console.log('');
        });
    }
}

async function updateDocuments(options = {}): Promise<void> {
    console.log('\n🔄 Loading documents incrementally...');

    const startTime = Date.now();

    const result = await getChunkedDocsIncrementally({});

    const totalTime = Date.now() - startTime;

    console.log('\n📊 UPDATE SUMMARY:');
    console.log('='.repeat(50));
    console.log(`📈 Total Documents: ${result.updateResult.totalDocuments}`);
    console.log(`➕ New Documents: ${result.updateResult.newDocuments}`);
    console.log(`🔄 Updated Documents: ${result.updateResult.updatedDocuments}`);
    console.log(`⏭️  Skipped Documents: ${result.updateResult.skippedDocuments}`);
    console.log(`📦 Processed Chunks: ${result.updateResult.processedChunks}`);
    console.log(`⏱️  Total Time: ${(totalTime / 1000).toFixed(2)}s`);

    if (result.updateResult.errorDocuments > 0) {
        console.log(`❌ Error Documents: ${result.updateResult.errorDocuments}`);
    }

    console.log('='.repeat(50));

    // Show processing summary
    if (Object.keys(result.processingSummary).length > 0) {
        console.log('\n📋 PROCESSING DETAILS:');
        console.log('-'.repeat(50));

        Object.entries(result.processingSummary).forEach(([fileName, stats]) => {
            console.log(`📄 ${fileName}:`);
            console.log(`   ├── Pages processed: ${stats.pages}`);
            console.log(`   └── Chunks created: ${stats.chunks}`);
        });
    }

    // Performance insights
    if (result.documents.length > 0) {
        const chunksPerSecond = result.updateResult.processedChunks / (totalTime / 1000);
        console.log(`\n⚡ Performance: ${chunksPerSecond.toFixed(1)} chunks/second`);

        if (result.updateResult.skippedDocuments > 0) {
            const skipRatio = result.updateResult.skippedDocuments / result.updateResult.totalDocuments;
            console.log(`💡 Efficiency: ${(skipRatio * 100).toFixed(1)}% documents skipped (no changes)`);
        }
    }

    // Store documents via Malayalam processor
    if (result.documents.length > 0) {
        await processMalayalamDocuments(
            result.documents.map(d => ({ content: d.pageContent, filename: d.metadata.source || 'unknown.md', source: d.metadata.source || 'unknown' })),
            { namespace: env.PINECONE_NAMESPACE || 'malayalam-docs' }
        );
    }

    // Recommendations
    console.log('\n💡 RECOMMENDATIONS:');
    if (result.updateResult.skippedDocuments === 0 && result.updateResult.totalDocuments > 0) {
        console.log('- All documents were processed. Consider if this is expected.');
    }

    if (result.updateResult.errorDocuments > 0) {
        console.log('- Some documents failed to process. Check the logs above for details.');
    }

    if (totalTime > 30000) { // > 30 seconds
        console.log('- Processing took a while. Consider using smaller batch sizes or optimizing documents.');
    }

    console.log('- Run `npm run docs:status` to check current status anytime.');
    console.log('- Use `npm run docs:update:force` to force reprocess all documents.');
}
