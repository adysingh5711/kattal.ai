#!/usr/bin/env tsx
/**
 * Large File Processing Script
 * 
 * Optimized for processing large markdown files (8000+ lines)
 * with circuit breaker protection and batch optimization
 */

import { OptimizedVectorStore } from '../lib/optimized-vector-store.js';
import { HybridChunker } from '../lib/docling-inspired-chunker.js';
import { DataValidator } from '../lib/data-validation.js';
import { getPinecone } from '../lib/pinecone-client.js';
import { Document } from 'langchain/document';
import fs from 'fs';
import path from 'path';

interface ProcessingOptions {
    filePath: string;
    maxBatchSize?: number;
    enableCircuitBreaker?: boolean;
    skipValidation?: boolean;
    dryRun?: boolean;
}

async function processLargeFile(options: ProcessingOptions) {
    const {
        filePath,
        maxBatchSize = 10, // Even smaller for large files
        enableCircuitBreaker = true,
        skipValidation = false,
        dryRun = false
    } = options;

    console.log('🚀 Large File Processing Started');
    console.log('=====================================');
    console.log(`📄 File: ${filePath}`);
    console.log(`📦 Batch size: ${maxBatchSize}`);
    console.log(`🔧 Circuit breaker: ${enableCircuitBreaker ? 'enabled' : 'disabled'}`);
    console.log(`🧪 Dry run: ${dryRun ? 'yes' : 'no'}`);
    console.log('');

    try {
        // 1. Check file exists and get stats
        if (!fs.existsSync(filePath)) {
            throw new Error(`File not found: ${filePath}`);
        }

        const stats = fs.statSync(filePath);
        const fileSizeMB = (stats.size / 1024 / 1024).toFixed(2);
        console.log(`📊 File size: ${fileSizeMB}MB (${stats.size} bytes)`);

        // 2. Read and validate file content
        const content = fs.readFileSync(filePath, 'utf-8');
        const lineCount = content.split('\n').length;
        console.log(`📏 Lines: ${lineCount.toLocaleString()}`);
        console.log(`📝 Characters: ${content.length.toLocaleString()}`);
        console.log('');

        // 3. Initialize components
        console.log('🔧 Initializing components...');
        const chunker = new HybridChunker();
        const vectorStore = new OptimizedVectorStore();

        // Reset circuit breaker if enabled
        if (enableCircuitBreaker) {
            vectorStore.resetCircuitBreaker();
            console.log('🔄 Circuit breaker reset');
        }

        // 4. Process the file
        console.log('⚡ Starting chunking process...');
        const startTime = Date.now();

        const chunks = chunker.chunk(content, {
            filename: path.basename(filePath),
            chunkIndex: 0,
            totalChunks: 1
        });

        // Convert DoclingChunk[] to Document[]
        const documents = chunks.map(chunk => new Document({
            pageContent: chunk.text,
            metadata: {
                ...chunk.metadata,
                source: path.basename(filePath),
                filePath: filePath,
                fileSize: stats.size,
                lineCount: lineCount,
                processedAt: new Date().toISOString()
            }
        }));

        const chunkingTime = Date.now() - startTime;
        console.log(`✅ Chunking completed in ${(chunkingTime / 1000).toFixed(2)}s`);
        console.log(`📊 Generated ${documents.length.toLocaleString()} chunks`);

        // 5. Validate if requested
        if (!skipValidation) {
            console.log('🔍 Validating documents...');
            const pineconeClient = await getPinecone();
            const validator = new DataValidator(pineconeClient);
            const validation = await validator.validateDocuments(documents);

            console.log(`📈 Validation results:`);
            console.log(`  • Valid: ${validation.isValid ? '✅' : '❌'}`);
            console.log(`  • Average chunk size: ${Math.round(validation.stats.averageChunkSize)} chars`);
            console.log(`  • Largest chunk: ${validation.stats.largestChunk} chars`);
            console.log(`  • Smallest chunk: ${validation.stats.smallestChunk} chars`);

            if (validation.warnings.length > 0) {
                console.log(`  • Warnings: ${validation.warnings.length}`);
            }
            if (validation.errors.length > 0) {
                console.log(`  • Errors: ${validation.errors.length}`);
                validation.errors.forEach(error => console.log(`    ❌ ${error}`));
            }
        }

        // 6. Process embeddings (if not dry run)
        if (!dryRun) {
            console.log('');
            console.log('🎯 Starting embedding process...');

            // Update batch size in vector store
            const originalBatchSize = 25; // Save original

            try {
                await vectorStore.embedAndStoreDocs(documents);
                console.log('✅ Embedding process completed successfully!');

                // Get circuit breaker status
                if (enableCircuitBreaker) {
                    const status = vectorStore.getCircuitBreakerStatus();
                    console.log(`🔧 Final circuit breaker status: ${status.state}`);
                    if (status.failureCount > 0) {
                        console.log(`⚠️  Had ${status.failureCount} failures during processing`);
                    }
                }

            } catch (error) {
                console.error('❌ Embedding process failed:', error);

                if (enableCircuitBreaker) {
                    const status = vectorStore.getCircuitBreakerStatus();
                    console.log(`🔧 Circuit breaker status: ${status.state}`);
                    if (status.state === 'OPEN') {
                        console.log(`⏰ Time until retry: ${Math.ceil(status.timeUntilRetry / 1000)}s`);
                        console.log('💡 Try running with smaller batch size or wait for circuit breaker to reset');
                    }
                }
                throw error;
            }
        } else {
            console.log('🧪 Dry run - skipping embedding process');
        }

        // 7. Final summary
        const totalTime = Date.now() - startTime;
        console.log('');
        console.log('📊 Processing Summary:');
        console.log('======================');
        console.log(`⏱️  Total time: ${(totalTime / 1000).toFixed(2)}s`);
        console.log(`📄 Input: ${lineCount.toLocaleString()} lines (${fileSizeMB}MB)`);
        console.log(`📦 Output: ${documents.length.toLocaleString()} chunks`);
        console.log(`⚡ Speed: ${Math.round(documents.length / (totalTime / 1000))} chunks/second`);
        console.log('✅ Large file processing completed successfully!');

    } catch (error) {
        console.error('❌ Large file processing failed:', error);
        console.log('');
        console.log('🚨 Troubleshooting tips:');
        console.log('• Try reducing batch size: --batch-size 5');
        console.log('• Run as dry run first: --dry-run');
        console.log('• Reset circuit breaker: npm run reset:circuit-breaker');
        console.log('• Check your API keys and network connection');
        process.exit(1);
    }
}

// CLI interface
async function main() {
    const args = process.argv.slice(2);

    if (args.length === 0 || args.includes('--help')) {
        console.log('🚀 Large File Processing Tool');
        console.log('');
        console.log('Usage: npm run process:large-file -- <file-path> [options]');
        console.log('');
        console.log('Options:');
        console.log('  --batch-size <number>   Batch size for processing (default: 10)');
        console.log('  --no-circuit-breaker    Disable circuit breaker protection');
        console.log('  --skip-validation       Skip document validation');
        console.log('  --dry-run              Only chunk, don\'t embed');
        console.log('  --help                 Show this help message');
        console.log('');
        console.log('Examples:');
        console.log('  npm run process:large-file -- "docs/large-file.md"');
        console.log('  npm run process:large-file -- "docs/large-file.md" --batch-size 5 --dry-run');
        return;
    }

    const filePath = args[0];
    const options: ProcessingOptions = {
        filePath,
        maxBatchSize: 10,
        enableCircuitBreaker: true,
        skipValidation: false,
        dryRun: false
    };

    // Parse options
    for (let i = 1; i < args.length; i++) {
        switch (args[i]) {
            case '--batch-size':
                options.maxBatchSize = parseInt(args[++i]) || 10;
                break;
            case '--no-circuit-breaker':
                options.enableCircuitBreaker = false;
                break;
            case '--skip-validation':
                options.skipValidation = true;
                break;
            case '--dry-run':
                options.dryRun = true;
                break;
        }
    }

    await processLargeFile(options);
}

// Run the script
main().catch(console.error);
