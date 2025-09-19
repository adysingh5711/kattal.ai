#!/usr/bin/env tsx

/**
 * Reprocess Malayalam documents with improved location-aware settings
 * This script will reindex all documents with better healthcare facility detection
 */

import fs from 'fs';
import path from 'path';
import { MalayalamPineconeProcessor } from '../lib/malayalam-pinecone-processor';

async function reprocessDocuments() {
    console.log('🚀 Starting Malayalam document reprocessing with improved location detection...');

    const processor = new MalayalamPineconeProcessor();
    await processor.initialize();

    // Clear existing cache for fresh processing
    processor.resetCache();

    const docsDir = path.join(process.cwd(), 'public', 'docs', 'pdf-md');
    const documents: Array<{ content: string; filename: string; source: string }> = [];

    // Function to recursively read all .md files
    function readMdFiles(dir: string, baseDir: string = docsDir): void {
        const files = fs.readdirSync(dir);

        for (const file of files) {
            const filePath = path.join(dir, file);
            const stat = fs.statSync(filePath);

            if (stat.isDirectory()) {
                readMdFiles(filePath, baseDir);
            } else if (file.endsWith('.md')) {
                try {
                    const content = fs.readFileSync(filePath, 'utf-8');
                    const relativePath = path.relative(baseDir, filePath);

                    documents.push({
                        content,
                        filename: file,
                        source: `docs/pdf-md/${relativePath.replace(/\\/g, '/')}`
                    });

                    console.log(`📄 Loaded: ${relativePath}`);
                } catch (error) {
                    console.error(`❌ Error reading ${filePath}:`, error);
                }
            }
        }
    }

    // Read all documents
    readMdFiles(docsDir);

    console.log(`📚 Found ${documents.length} documents to process`);

    if (documents.length === 0) {
        console.log('❌ No documents found. Please check the docs directory.');
        return;
    }

    // Process documents with improved settings
    const result = await processor.processMarkdownDocuments(documents, {
        namespace: 'malayalam-docs-v2', // Use new namespace for improved version
        chunkSize: 800, // Smaller chunks for better location precision
        chunkOverlap: 200, // Higher overlap for location context
        enforceLanguage: false, // Process all relevant documents
        preserveTableStructure: true,
        enableDeduplication: true
    });

    console.log('\n🎉 Reprocessing Complete!');
    console.log('📊 Results:');
    console.log(`   Total chunks: ${result.totalChunks}`);
    console.log(`   Processed chunks: ${result.processedChunks}`);
    console.log(`   Skipped chunks: ${result.skippedChunks}`);
    console.log(`   Tables preserved: ${result.tablesPreserved}`);
    console.log(`   Processing time: ${result.processingTime}ms`);
    console.log(`   Namespace: ${result.namespace}`);

    // Test the improved search with hospital query
    console.log('\n🔍 Testing improved search with hospital query...');

    const testQueries = [
        'കാട്ടക്കട ജനറൽ ആശുപത്രി എവിടെയാണ്?',
        'Kattakada General Hospital location',
        'കാട്ടക്കട ആശുപത്രി',
        'കിള്ളി പങ്കജ കസ്തൂരി ആയുർവേദ ആശുപത്രി'
    ];

    for (const query of testQueries) {
        console.log(`\n🔍 Testing query: "${query}"`);

        const searchResult = await processor.searchAcrossNamespaces(
            query,
            ['malayalam-docs-v2'],
            { k: 5, scoreThreshold: 0.4 }
        );

        console.log(`   Found ${searchResult.documents.length} results`);

        if (searchResult.documents.length > 0) {
            const topResult = searchResult.documents[0];
            const preview = topResult.pageContent.substring(0, 200).replace(/\n/g, ' ');
            console.log(`   Top result preview: "${preview}..."`);
            console.log(`   Source: ${topResult.metadata.source}`);
        }
    }

    console.log('\n✅ Reprocessing and testing complete!');
    console.log('💡 The system should now better handle location-based queries about healthcare facilities.');
    console.log('🔧 Update your environment to use namespace "malayalam-docs-v2" for improved results.');
}

// Run the reprocessing
reprocessDocuments().catch(error => {
    console.error('❌ Reprocessing failed:', error);
    process.exit(1);
});