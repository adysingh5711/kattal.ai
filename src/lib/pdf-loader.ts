import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { Document } from "langchain/document";
import { env } from "./env";
import fs from 'fs';
import path from 'path';
import { processDocumentMultimodal } from "./multimodal-processor";
import { chunkMultimodalDocuments } from "./smart-chunker";
import { IncrementalDataManager, IncrementalUpdateOptions } from "./incremental-data-manager";

/**
 * Helper function to process documents from a given path pattern
 */
async function processDocumentsFromPath(
    pathPattern: string,
    allDocs: Document[],
    processingSummary: { [key: string]: { pages: number, chunks: number } },
    fileType: string
) {
    if (!pathPattern) return;

    // Check if pathPattern is a directory wildcard or specific file
    if (pathPattern.includes('*')) {
        // Handle directory with multiple documents
        const dirPath = pathPattern.replace('/*', '');

        if (fs.existsSync(dirPath)) {
            const files = fs.readdirSync(dirPath)
                .filter(file => {
                    const lower = file.toLowerCase();
                    if (fileType === 'PDF/DOC/DOCX') {
                        return lower.endsWith('.pdf') || lower.endsWith('.doc') || lower.endsWith('.docx');
                    } else if (fileType === 'Markdown') {
                        return lower.endsWith('.md') || lower.endsWith('.markdown');
                    }
                    return false;
                })
                .map(file => path.join(dirPath, file));

            console.log(`📋 Found ${files.length} files (${fileType}) in ${dirPath}`);

            // Process each file
            for (const file of files) {
                try {
                    const fileName = path.basename(file);
                    console.log(`\n📄 Processing ${fileType} file: ${fileName}`);
                    const docs = await processDocumentMultimodal(file);

                    // Track processing summary
                    processingSummary[fileName] = {
                        pages: docs.length,
                        chunks: 0 // Will be updated after chunking
                    };

                    allDocs.push(...docs);
                    console.log(`✅ Processed ${docs.length} pages from ${fileName}`);
                } catch (fileError) {
                    console.error(`❌ Error processing file ${file}:`, fileError);
                    // Continue with other files even if one fails
                }
            }
        } else {
            console.warn(`⚠️ Directory not found: ${dirPath}`);
        }
    } else {
        // Handle single file
        if (!fs.existsSync(pathPattern)) {
            console.warn(`⚠️ File not found: ${pathPattern}`);
            return;
        }

        const file = pathPattern;
        const fileName = path.basename(file);
        console.log(`\n📄 Processing single ${fileType} file: ${fileName}`);
        const docs = await processDocumentMultimodal(file);

        processingSummary[fileName] = {
            pages: docs.length,
            chunks: 0 // Will be updated after chunking
        };

        allDocs.push(...docs);
        console.log(`✅ Processed ${docs.length} pages from ${fileName}`);
    }
}

export async function getChunkedDocsFromPDF() {
    try {
        let allDocs: Document[] = [];
        const processingSummary: { [key: string]: { pages: number, chunks: number } } = {};

        // Process both PDF and markdown documents
        const pdfPathPattern = env.DOC_PATH || env.PDF_PATH || env.DOCX_PATH;
        const markdownPathPattern = env.MARKDOWN_PATH;

        console.log(`📁 Processing PDF documents from: ${pdfPathPattern}`);
        console.log(`📁 Processing Markdown documents from: ${markdownPathPattern}`);

        // Process PDF documents
        await processDocumentsFromPath(pdfPathPattern, allDocs, processingSummary, 'PDF/DOC/DOCX');

        // Process Markdown documents
        await processDocumentsFromPath(markdownPathPattern, allDocs, processingSummary, 'Markdown');

        if (allDocs.length === 0) {
            throw new Error("No documents (PDF or Markdown) were successfully loaded");
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