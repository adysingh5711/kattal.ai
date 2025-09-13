#!/usr/bin/env tsx

import { config } from 'dotenv';
import { Document } from 'langchain/document';
import { OptimizedVectorStore } from '../lib/optimized-vector-store';
import { HybridSearchEngine } from '../lib/hybrid-search-engine';
import { getPinecone } from '../lib/pinecone-client';
import { env } from '../lib/env';

// Load environment variables
config();

interface IndexBuildOptions {
    namespace?: string;
    maxDocuments?: number;
    rebuildIfExists?: boolean;
    verbose?: boolean;
}

async function buildHybridSearchIndex(options: IndexBuildOptions = {}) {
    const {
        namespace,
        maxDocuments = 10000,
        rebuildIfExists = false,
        verbose = true
    } = options;

    console.log('🚀 Starting hybrid search index build...');
    console.log(`📊 Options:`, {
        namespace: namespace || 'default',
        maxDocuments,
        rebuildIfExists,
        verbose
    });

    try {
        // Step 1: Initialize components
        const vectorStore = new OptimizedVectorStore();
        const hybridSearch = new HybridSearchEngine(vectorStore);

        // Step 2: Check if index already exists
        const healthCheck = await hybridSearch.healthCheck();
        if (healthCheck.stats.isBuilt && !rebuildIfExists) {
            console.log(`✅ Hybrid search index already exists with ${healthCheck.stats.totalDocuments} documents`);
            console.log(`📈 Index stats:`, healthCheck.stats);
            return;
        }

        if (rebuildIfExists && healthCheck.stats.isBuilt) {
            console.log('🔄 Rebuilding existing index...');
        }

        // Step 3: Fetch documents from vector store
        console.log('📥 Fetching documents from vector store...');
        const startTime = Date.now();

        // Get documents using different methods to ensure comprehensive coverage
        const allDocuments = await fetchAllDocuments(vectorStore, namespace, maxDocuments, verbose);

        if (allDocuments.length === 0) {
            console.error('❌ No documents found in vector store. Please check:');
            console.error('   - Vector store is properly configured');
            console.error('   - Documents have been ingested');
            console.error('   - Namespace is correct (if specified)');
            process.exit(1);
        }

        console.log(`📚 Found ${allDocuments.length} documents in ${Date.now() - startTime}ms`);

        // Step 4: Build the hybrid search index
        console.log('🔨 Building BM25 and Fuse.js indices...');
        const indexStartTime = Date.now();

        await hybridSearch.buildSearchIndex(allDocuments);

        const indexBuildTime = Date.now() - indexStartTime;
        console.log(`✅ Hybrid search index built in ${indexBuildTime}ms`);

        // Step 5: Verify the index
        console.log('🔍 Verifying index integrity...');
        const finalHealthCheck = await hybridSearch.healthCheck();

        if (finalHealthCheck.status !== 'healthy') {
            console.error('❌ Index verification failed:', finalHealthCheck.issues);
            process.exit(1);
        }

        // Step 6: Performance test
        console.log('⚡ Running performance tests...');
        await runPerformanceTests(hybridSearch, verbose);

        // Step 7: Summary
        console.log('\n🎉 Hybrid search index build completed successfully!');
        console.log('📊 Final statistics:');
        console.log(`   - Total documents: ${finalHealthCheck.stats.totalDocuments}`);
        console.log(`   - Unique terms: ${finalHealthCheck.stats.uniqueTerms}`);
        console.log(`   - Average doc length: ${finalHealthCheck.stats.averageDocLength.toFixed(1)} tokens`);
        console.log(`   - Build time: ${(Date.now() - startTime) / 1000}s`);
        console.log(`   - Status: ${finalHealthCheck.status}`);

    } catch (error) {
        console.error('❌ Failed to build hybrid search index:', error);
        process.exit(1);
    }
}

async function fetchAllDocuments(
    vectorStore: OptimizedVectorStore,
    namespace?: string,
    maxDocuments: number = 10000,
    verbose: boolean = true
): Promise<Document[]> {
    const documents = [];

    try {
        // Method 1: Try to get documents via metadata query (gets all documents)
        if (verbose) console.log('   📄 Fetching via metadata query...');

        const metadataDocs = await vectorStore.getDocumentsByMetadata(
            {}, // Empty filter to get all documents
            { k: maxDocuments, namespace }
        );

        if (metadataDocs.length > 0) {
            documents.push(...metadataDocs);
            if (verbose) console.log(`   ✅ Found ${metadataDocs.length} documents via metadata query`);
        }

        // Method 2: If no documents found, try different approaches
        if (documents.length === 0) {
            if (verbose) console.log('   📄 Trying alternative document retrieval...');

            // Try common queries to find documents
            const testQueries = [
                'document',
                'information',
                'data',
                'content',
                'text',
                'analysis',
                'report',
                'summary'
            ];

            for (const query of testQueries) {
                try {
                    const queryDocs = await vectorStore.optimizedRetrieval(query, {
                        k: Math.ceil(maxDocuments / testQueries.length),
                        namespace,
                        scoreThreshold: 0.1 // Very low threshold to catch everything
                    });

                    if (queryDocs.length > 0) {
                        documents.push(...queryDocs);
                        if (verbose) console.log(`   ✅ Found ${queryDocs.length} documents for query "${query}"`);
                    }
                } catch (error) {
                    const errorMessage = error instanceof Error ? error.message : String(error);
                    if (verbose) console.warn(`   ⚠️  Query "${query}" failed:`, errorMessage);
                }
            }
        }

        // Remove duplicates based on content
        const uniqueDocuments = [];
        const seenContent = new Set();

        for (const doc of documents) {
            const contentKey = doc.pageContent.slice(0, 100);
            if (!seenContent.has(contentKey)) {
                seenContent.add(contentKey);
                uniqueDocuments.push(doc);
            }
        }

        if (verbose && uniqueDocuments.length !== documents.length) {
            console.log(`   🔄 Removed ${documents.length - uniqueDocuments.length} duplicates`);
        }

        return uniqueDocuments.slice(0, maxDocuments);

    } catch (error) {
        console.error('❌ Failed to fetch documents:', error);
        return [];
    }
}

async function runPerformanceTests(hybridSearch: HybridSearchEngine, verbose: boolean = true) {
    const testQueries = [
        'development activities',
        'water quality report',
        'project implementation',
        'community engagement',
        'environmental impact'
    ];

    const results = [];

    for (const query of testQueries) {
        try {
            const startTime = Date.now();

            // Create a mock query analysis for testing
            const mockAnalysis = {
                queryType: 'FACTUAL' as const,
                complexity: 3,
                keyEntities: query.split(' '),
                suggestedK: 5,
                requiresCrossReference: false,
                dataTypesNeeded: ['text'],
                reasoningSteps: ['retrieve', 'analyze'],
                languageDetection: {
                    detectedLanguage: 'english' as const,
                    confidence: 0.8,
                    responseLanguage: 'en',
                    responseInstructions: 'Respond in English'
                }
            };

            const searchResult = await hybridSearch.intelligentSearch(query, mockAnalysis, {
                k: 5,
                scoreThreshold: 0.1,
                enableFuse: true
            });

            const searchTime = Date.now() - startTime;
            results.push({
                query,
                documentsFound: searchResult.documents.length,
                searchTime,
                searchStrategy: searchResult.searchMetadata.searchStrategy
            });

            if (verbose) {
                console.log(`   🔍 "${query}": ${searchResult.documents.length} docs in ${searchTime}ms (${searchResult.searchMetadata.searchStrategy})`);
            }

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.warn(`   ⚠️  Test query "${query}" failed:`, errorMessage);
        }
    }

    const avgTime = results.reduce((sum, r) => sum + r.searchTime, 0) / results.length;
    const avgDocs = results.reduce((sum, r) => sum + r.documentsFound, 0) / results.length;

    console.log(`   📊 Performance summary:`);
    console.log(`      - Average search time: ${avgTime.toFixed(1)}ms`);
    console.log(`      - Average documents found: ${avgDocs.toFixed(1)}`);
    console.log(`      - Total test queries: ${results.length}`);
}

// CLI interface
async function main() {
    const args = process.argv.slice(2);
    const options: IndexBuildOptions = {};

    // Parse command line arguments
    for (let i = 0; i < args.length; i++) {
        const arg = args[i];

        switch (arg) {
            case '--namespace':
                options.namespace = args[++i];
                break;
            case '--max-documents':
                options.maxDocuments = parseInt(args[++i]);
                break;
            case '--rebuild':
                options.rebuildIfExists = true;
                break;
            case '--quiet':
                options.verbose = false;
                break;
            case '--help':
                console.log(`
Hybrid Search Index Builder

Usage: tsx build-hybrid-search-index.ts [options]

Options:
  --namespace <name>       Specify Pinecone namespace (default: default)
  --max-documents <num>    Maximum documents to index (default: 10000)
  --rebuild               Rebuild index even if it exists
  --quiet                 Reduce verbose output
  --help                  Show this help message

Examples:
  tsx build-hybrid-search-index.ts
  tsx build-hybrid-search-index.ts --namespace production --max-documents 5000
  tsx build-hybrid-search-index.ts --rebuild --verbose
        `);
                process.exit(0);
        }
    }

    await buildHybridSearchIndex(options);
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch(error => {
        console.error('❌ Script failed:', error);
        process.exit(1);
    });
}

export { buildHybridSearchIndex };
