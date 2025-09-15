#!/usr/bin/env tsx

/**
 * Malayalam Document Processing Script
 * Streamlined processing for Malayalam MD files with table serialization
 */

import { MalayalamPineconeProcessor, processMalayalamDocuments, searchMalayalamDocuments } from '../lib/malayalam-pinecone-processor';
import fs from 'fs/promises';
import path from 'path';

async function main() {
    console.log('🚀 Starting Malayalam Document Processing...');

    try {
        // Example: Process documents from public/docs/pdf-md directory
        const docsDir = path.join(process.cwd(), 'public/docs/pdf-md');
        const files = await fs.readdir(docsDir);
        const mdFiles = files.filter(file => file.endsWith('.md'));

        console.log(`📚 Found ${mdFiles.length} markdown files to process`);

        const documents = [];

        // Read all markdown files
        for (const file of mdFiles) {
            const filePath = path.join(docsDir, file);
            const content = await fs.readFile(filePath, 'utf-8');

            documents.push({
                content,
                filename: file,
                source: `docs/pdf-md/${file}`
            });
        }

        // Process documents with optimal settings for Malayalam
        const result = await processMalayalamDocuments(documents, {
            namespace: 'malayalam-government-docs',
            chunkSize: 600, // Optimal for Malayalam
            chunkOverlap: 80,
            enforceLanguage: true,
            preserveTableStructure: true,
            enableDeduplication: true
        });

        console.log('\n📊 Processing Results:');
        console.log(`- Total chunks: ${result.totalChunks}`);
        console.log(`- Processed: ${result.processedChunks}`);
        console.log(`- Skipped duplicates: ${result.skippedChunks}`);
        console.log(`- Tables preserved: ${result.tablesPreserved}`);
        console.log(`- Processing time: ${result.processingTime}ms`);
        console.log(`- Namespace: ${result.namespace}`);

        // Example search across the processed documents
        console.log('\n🔍 Testing search functionality...');

        const searchQueries = [
            'കാട്ടക്കട പഞ്ചായത്ത്',
            'വികസന പദ്ധതികൾ',
            'ബജറ്റ് വിനിയോഗം'
        ];

        for (const query of searchQueries) {
            console.log(`\nSearching for: "${query}"`);
            const searchResults = await searchMalayalamDocuments(
                query,
                ['malayalam-government-docs'],
                { k: 3, scoreThreshold: 0.7 }
            );

            console.log(`Found ${searchResults.length} results:`);
            searchResults.forEach((doc, index) => {
                const metadata = doc.metadata;
                console.log(`  ${index + 1}. ${metadata.filename} (chunk ${metadata.chunkIndex + 1})`);
                console.log(`     Score: ${metadata._score?.toFixed(3) || 'N/A'}`);
                console.log(`     Has table: ${metadata.hasTable ? 'Yes' : 'No'}`);
                console.log(`     Content preview: ${doc.pageContent.slice(0, 100)}...`);
            });
        }

        console.log('\n✅ Malayalam document processing completed successfully!');

    } catch (error) {
        console.error('❌ Error processing Malayalam documents:', error);
        process.exit(1);
    }
}

// Example function to demonstrate systematic namespace search
async function demonstrateNamespaceSearch() {
    console.log('\n🔍 Demonstrating Multi-Namespace Search...');

    const processor = new MalayalamPineconeProcessor();
    await processor.initialize();

    // Search across multiple namespaces
    const namespaces = [
        'malayalam-government-docs',
        'malayalam-development-reports',
        'malayalam-policy-documents'
    ];

    const query = 'വികസന പദ്ധതികൾ';

    const result = await processor.searchAcrossNamespaces(
        query,
        namespaces,
        { k: 6, scoreThreshold: 0.6 }
    );

    console.log(`Search results for "${query}":`);
    console.log(`- Total results: ${result.searchMetadata.totalResults}`);
    console.log(`- Search time: ${result.searchMetadata.searchTime}ms`);
    console.log('- Namespace distribution:');

    Object.entries(result.searchMetadata.namespaceCounts).forEach(([ns, count]) => {
        console.log(`  ${ns}: ${count} results`);
    });

    console.log('\nTop results:');
    result.documents.forEach((doc, index) => {
        const metadata = doc.metadata;
        console.log(`${index + 1}. ${metadata.filename} (${metadata.namespace})`);
        console.log(`   Score: ${metadata._score?.toFixed(3) || 'N/A'}`);
    });
}

// Run the main function
if (require.main === module) {
    main()
        .then(() => demonstrateNamespaceSearch())
        .catch(console.error);
}

export { main, demonstrateNamespaceSearch };
