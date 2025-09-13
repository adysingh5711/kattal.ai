#!/usr/bin/env tsx
/**
 * Test Namespace Functionality
 * 
 * Quick test to verify namespace strategy is working correctly
 */

import { OptimizedVectorStore } from '../lib/optimized-vector-store.js';
import { Document } from 'langchain/document';

async function testNamespaceStrategy() {
    console.log('🧪 Testing Namespace Functionality');
    console.log('=====================================');

    try {
        const vectorStore = new OptimizedVectorStore();

        // Create test documents with different types and sources
        const testDocs: Document[] = [
            new Document({
                pageContent: 'This is a text content from handbook.',
                metadata: {
                    source: 'Hand-book-2K24_Final.md',
                    contentType: 'text',
                    chunkType: 'text'
                }
            }),
            new Document({
                pageContent: 'This is a table with data.',
                metadata: {
                    source: 'Kattakada Assembly Report.md',
                    contentType: 'table',
                    chunkType: 'table'
                }
            }),
            new Document({
                pageContent: 'This is a heading section.',
                metadata: {
                    source: '2025-26 plan new.md',
                    contentType: 'heading',
                    chunkType: 'heading'
                }
            })
        ];

        console.log('📊 Test Documents:');
        testDocs.forEach((doc, i) => {
            console.log(`   Doc ${i + 1}: ${doc.metadata?.source} (${doc.metadata?.contentType})`);
        });
        console.log('');

        // Test namespace determination
        console.log('🏷️  Testing Namespace Strategy...');

        // Access the private method through reflection for testing
        const determineNamespace = (vectorStore as any).determineNamespace.bind(vectorStore);

        testDocs.forEach((doc, i) => {
            const namespace = determineNamespace(doc);
            console.log(`   Doc ${i + 1} → Namespace: "${namespace}"`);
        });
        console.log('');

        // Test with a small embedding operation
        console.log('🚀 Testing Small Embedding Process...');

        // Just test the first document to verify the process works
        const singleDoc = testDocs.slice(0, 1);

        try {
            await vectorStore.embedAndStoreDocs(singleDoc);
            console.log('✅ Namespace embedding test successful!');
        } catch (error) {
            console.error('❌ Namespace embedding test failed:', error);
            throw error;
        }

        console.log('');
        console.log('🎉 Namespace functionality test completed!');
        console.log('✅ Ready for full upload with namespace support');

    } catch (error) {
        console.error('❌ Namespace test failed:', error);
        console.log('');
        console.log('🔧 Troubleshooting:');
        console.log('• Check your API keys are configured correctly');
        console.log('• Ensure Pinecone index exists and is accessible');
        console.log('• Verify network connectivity');
        process.exit(1);
    }
}

// Run the test
testNamespaceStrategy().catch(console.error);
