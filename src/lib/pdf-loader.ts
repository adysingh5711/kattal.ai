import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { Document } from "langchain/document";
import { env } from "./env";
import fs from 'fs';
import path from 'path';
import { processDocumentMultimodal } from "./multimodal-processor";
import { chunkMultimodalDocuments } from "./smart-chunker";
import { IncrementalDataManager, IncrementalUpdateOptions } from "./incremental-data-manager";

export async function getChunkedDocsFromPDF() {
    try {
        let allDocs: Document[] = [];
        const processingSummary: { [key: string]: { pages: number, chunks: number } } = {};

        // Prefer DOC_PATH (combined), fallback to PDF_PATH/DOCX_PATH
        const pathPattern = env.DOC_PATH || env.PDF_PATH || env.DOCX_PATH;

        console.log(`📁 Processing documents from: ${pathPattern}`);

        // Check if pathPattern is a directory wildcard or specific file
        if (pathPattern.includes('*')) {
            // Handle directory with multiple documents
            const dirPath = pathPattern.replace('/*', '');

            if (fs.existsSync(dirPath)) {
                const files = fs.readdirSync(dirPath)
                    .filter(file => {
                        const lower = file.toLowerCase();
                        return lower.endsWith('.pdf') || lower.endsWith('.doc') || lower.endsWith('.docx');
                    })
                    .map(file => path.join(dirPath, file));

                console.log(`📋 Found ${files.length} files (PDF/DOC/DOCX) in ${dirPath}`);

                // Process each file
                for (const file of files) {
                    try {
                        const fileName = path.basename(file);
                        console.log(`\n📄 Processing file: ${fileName}`);
                        const docs = await processDocumentMultimodal(file);

                        // Track processing summary
                        processingSummary[fileName] = {
                            pages: docs.length,
                            chunks: 0 // Will be updated after chunking
                        };

                        allDocs = [...allDocs, ...docs];
                        console.log(`✅ Processed ${docs.length} pages from ${fileName}`);
                    } catch (fileError) {
                        console.error(`❌ Error processing file ${file}:`, fileError);
                        // Continue with other files even if one fails
                    }
                }
            } else {
                throw new Error(`Directory not found: ${dirPath}`);
            }
        } else {
            // Handle single file
            if (!fs.existsSync(pathPattern)) {
                throw new Error(`File not found: ${pathPattern}`);
            }

            const file = pathPattern;
            const fileName = path.basename(file);
            console.log(`\n📄 Processing single file: ${fileName}`);
            allDocs = await processDocumentMultimodal(file);

            processingSummary[fileName] = {
                pages: allDocs.length,
                chunks: 0 // Will be updated after chunking
            };

            console.log(`✅ Processed ${allDocs.length} pages from ${fileName}`);
        }

        if (allDocs.length === 0) {
            throw new Error("No PDF documents were successfully loaded");
        }

        console.log(`\n📊 Successfully loaded ${allDocs.length} document sections`);

        // Use smart multimodal chunking
        const chunkedDocs = await chunkMultimodalDocuments(allDocs);
        console.log(`✂️  Created ${chunkedDocs.length} chunks from the documents`);

        // Update chunks count in summary
        Object.keys(processingSummary).forEach(fileName => {
            processingSummary[fileName].chunks = chunkedDocs.filter(doc =>
                doc.metadata.source && doc.metadata.source.includes(fileName)
            ).length;
        });

        // Log detailed processing summary
        console.log('\n📋 PROCESSING SUMMARY:');
        console.log('='.repeat(50));
        let totalPages = 0;
        let totalChunks = 0;

        Object.entries(processingSummary).forEach(([fileName, stats]) => {
            console.log(`📄 ${fileName}:`);
            console.log(`   ├── Pages processed: ${stats.pages}`);
            console.log(`   └── Chunks created: ${stats.chunks}`);
            totalPages += stats.pages;
            totalChunks += stats.chunks;
        });

        console.log('='.repeat(50));
        console.log(`📈 TOTAL: ${totalPages} pages → ${totalChunks} chunks`);
        console.log('='.repeat(50));

        return chunkedDocs;
    } catch (e: unknown) {
        console.error("Document chunking failed:", e);
        const errorMessage = e instanceof Error ? e.message : 'Unknown error';
        throw new Error(`Document chunking failed: ${errorMessage}`);
    }
}

/**
 * Enhanced version that loads documents incrementally without disturbing existing data
 */
export async function getChunkedDocsIncrementally(
    options: IncrementalUpdateOptions = {}
): Promise<{
    documents: Document[];
    updateResult: any;
    processingSummary: { [key: string]: { pages: number, chunks: number } };
}> {
    try {
        console.log('🔄 Starting incremental document loading...');

        // Step 1: Load all documents normally
        const allDocs = await getChunkedDocsFromPDF();

        // Step 2: Import required modules dynamically to avoid circular dependencies
        const { getPinecone } = await import("./pinecone-client");
        const pineconeClient = await getPinecone();

        // Step 3: Initialize incremental data manager
        const dataManager = new IncrementalDataManager(pineconeClient);

        // Step 4: Process documents incrementally
        const updateResult = await dataManager.addDocumentsIncremental(allDocs, {
            enableBackup: true,
            batchSize: 50,
            ...options
        });

        console.log('✅ Incremental loading completed:', {
            total: updateResult.totalDocuments,
            new: updateResult.newDocuments,
            updated: updateResult.updatedDocuments,
            skipped: updateResult.skippedDocuments,
            time: `${(updateResult.processingTime / 1000).toFixed(2)}s`
        });

        // Return summary for compatibility
        const processingSummary: { [key: string]: { pages: number, chunks: number } } = {};

        // Calculate summary from the update result
        updateResult.fingerprints.forEach(fp => {
            const fileName = path.basename(fp.source);
            if (!processingSummary[fileName]) {
                processingSummary[fileName] = { pages: 0, chunks: 0 };
            }
            processingSummary[fileName].chunks += fp.chunkCount;
            processingSummary[fileName].pages += 1; // Approximate
        });

        return {
            documents: allDocs,
            updateResult,
            processingSummary
        };

    } catch (e: unknown) {
        console.error("Incremental document loading failed:", e);
        const errorMessage = e instanceof Error ? e.message : 'Unknown error';
        throw new Error(`Incremental document loading failed: ${errorMessage}`);
    }
}

/**
 * Check document status without processing
 */
export async function getDocumentStatus(): Promise<{
    totalDocuments: number;
    totalChunks: number;
    lastUpdate: number;
    documents: Array<{
        source: string;
        chunkCount: number;
        lastModified: number;
        processingTimestamp: number;
        size: number;
    }>;
}> {
    try {
        const { getPinecone } = await import("./pinecone-client");
        const pineconeClient = await getPinecone();
        const dataManager = new IncrementalDataManager(pineconeClient);

        return await dataManager.getDocumentStatus();
    } catch (error) {
        console.error("Failed to get document status:", error);
        return {
            totalDocuments: 0,
            totalChunks: 0,
            lastUpdate: 0,
            documents: []
        };
    }
}