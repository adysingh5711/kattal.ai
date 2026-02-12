// Old chunking imports removed - now using Docling-inspired HybridChunker
import { Document } from "@langchain/core/documents";
import { env } from "./env";
import fs from 'fs';
import path from 'path';

// NOTE: This loader is streamlined to handle Markdown files only.
// PDF/DOC/DOCX handling has been removed to simplify the pipeline.
// Use external preprocessors to convert PDFs to Markdown before ingestion.

/**
 * Recursively find files of a specific type in a directory and its subdirectories
 */
function findFilesRecursively(dirPath: string, fileType: string): string[] {
    const files: string[] = [];

    function searchDirectory(currentPath: string) {
        if (!fs.existsSync(currentPath)) return;

        const items = fs.readdirSync(currentPath);

        for (const item of items) {
            const fullPath = path.join(currentPath, item);
            const stat = fs.statSync(fullPath);

            if (stat.isDirectory()) {
                // Recursively search subdirectories
                searchDirectory(fullPath);
            } else if (stat.isFile()) {
                // Check if file matches the type we're looking for
                const lower = item.toLowerCase();
                let matches = false;

                if (fileType === 'Markdown') {
                    matches = lower.endsWith('.md') || lower.endsWith('.markdown');
                }

                if (matches) {
                    files.push(fullPath);
                }
            }
        }
    }

    searchDirectory(dirPath);
    return files;
}

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
        // Handle directory with multiple documents (including subdirectories)
        const dirPath = pathPattern.replace('/*', '');

        if (fs.existsSync(dirPath)) {
            // Recursively find all files in directory and subdirectories
            const files = findFilesRecursively(dirPath, fileType);

            console.log(`📋 Found ${files.length} files (${fileType}) in ${dirPath} (including subdirectories)`);

            // Process each file
            for (const file of files) {
                try {
                    const fileName = path.basename(file);
                    const relativePath = path.relative(dirPath, file);
                    console.log(`\n📄 Processing ${fileType} file: ${relativePath}`);
                    const content = fs.readFileSync(file, 'utf8');
                    const doc = new Document({
                        pageContent: content,
                        metadata: {
                            source: file,
                            fileType: 'markdown',
                            chunkType: 'text'
                        }
                    });
                    // Track processing summary with relative path for better organization
                    const summaryKey = relativePath.includes(path.sep) ? relativePath : fileName;
                    processingSummary[summaryKey] = {
                        pages: 1,
                        chunks: 1
                    };

                    allDocs.push(doc);
                    console.log(`✅ Loaded markdown from ${relativePath}`);
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
        const content = fs.readFileSync(file, 'utf8');
        const doc = new Document({
            pageContent: content,
            metadata: {
                source: file,
                fileType: 'markdown',
                chunkType: 'text'
            }
        });

        processingSummary[fileName] = {
            pages: 1,
            chunks: 1
        };

        allDocs.push(doc);
        console.log(`✅ Loaded markdown from ${fileName}`);
    }
}

export async function getChunkedDocsFromPDF() {
    try {
        let allDocs: Document[] = [];
        const processingSummary: { [key: string]: { pages: number, chunks: number } } = {};

        // Process markdown documents only (PDF/DOC paths are ignored)
        const markdownPathPattern = env.MARKDOWN_PATH;

        console.log(`📁 Processing Markdown documents from: ${markdownPathPattern}`);

        // Process Markdown documents
        await processDocumentsFromPath(markdownPathPattern, allDocs, processingSummary, 'Markdown');

        if (allDocs.length === 0) {
            throw new Error("No documents (PDF or Markdown) were successfully loaded");
        }

        console.log(`\n📊 Successfully loaded ${allDocs.length} document sections`);

        // Returned documents are raw markdown content; Malayalam processor will chunk/serialize
        console.log(`✂️  Using ${allDocs.length} markdown documents for downstream processing`);

        // Update chunks count in summary  
        Object.keys(processingSummary).forEach(fileName => {
            processingSummary[fileName].chunks = allDocs.filter(doc =>
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

        return allDocs;
    } catch (e: unknown) {
        console.error("Document chunking failed:", e);
        const errorMessage = e instanceof Error ? e.message : 'Unknown error';
        throw new Error(`Document chunking failed: ${errorMessage}`);
    }
}

/**
 * Enhanced version that loads documents incrementally without disturbing existing data
 * Uses document tracker to check Pinecone for existing documents and skip duplicates
 */
export async function getChunkedDocsIncrementally(
    options: { forceReprocess?: boolean } = {}
): Promise<{
    documents: Document[];
    updateResult: {
        totalDocuments: number;
        newDocuments: number;
        updatedDocuments: number;
        skippedDocuments: number;
        processedChunks: number;
        errorDocuments: number;
        processingTime: number;
        fingerprints: Array<{ source: string; chunkCount: number }>;
    };
    processingSummary: { [key: string]: { pages: number, chunks: number } };
}> {
    const startTime = Date.now();

    try {
        console.log('🔄 Starting smart incremental document loading...');

        // Import document tracker
        const { filterDocumentsForProcessing, clearDocumentCache } = await import('./document-tracker');

        // First, find all markdown files
        const markdownPathPattern = env.MARKDOWN_PATH;
        const dirPath = markdownPathPattern.replace('/*', '');

        if (!fs.existsSync(dirPath)) {
            throw new Error(`Markdown directory not found: ${dirPath}`);
        }

        // Get all file paths recursively
        const allFilePaths = findFilesRecursively(dirPath, 'Markdown');
        console.log(`📁 Found ${allFilePaths.length} markdown files in ${dirPath}`);

        // Filter to only process new/modified files using document tracker
        const namespace = env.PINECONE_NAMESPACE || '';
        const filterResult = await filterDocumentsForProcessing(
            allFilePaths,
            namespace,
            {
                forceReprocess: options.forceReprocess || false,
                includeModified: true // Process modified files 
            }
        );

        const processingSummary: { [key: string]: { pages: number, chunks: number } } = {};
        const allDocs: Document[] = [];
        let errorCount = 0;

        // Only process files that need processing
        if (filterResult.toProcess.length > 0) {
            console.log(`\n📄 Processing ${filterResult.toProcess.length} documents...`);

            for (const filePath of filterResult.toProcess) {
                try {
                    const fileName = path.basename(filePath);
                    const relativePath = path.relative(dirPath, filePath);
                    console.log(`📄 Processing: ${relativePath}`);

                    const content = fs.readFileSync(filePath, 'utf8');
                    const doc = new Document({
                        pageContent: content,
                        metadata: {
                            source: filePath,
                            fileType: 'markdown',
                            chunkType: 'text'
                        }
                    });

                    processingSummary[fileName] = {
                        pages: 1,
                        chunks: 1
                    };

                    allDocs.push(doc);
                    console.log(`✅ Loaded: ${fileName}`);

                } catch (fileError) {
                    console.error(`❌ Error processing ${filePath}:`, fileError);
                    errorCount++;
                }
            }

            // Clear cache after processing so next run sees updated state
            clearDocumentCache();
        } else {
            console.log('\n✨ All documents are up to date - nothing to process!');
        }

        const processingTime = Date.now() - startTime;

        const updateResult = {
            totalDocuments: allFilePaths.length,
            newDocuments: filterResult.stats.new,
            updatedDocuments: filterResult.stats.modified,
            skippedDocuments: filterResult.stats.unchanged,
            processedChunks: allDocs.length,
            errorDocuments: errorCount,
            processingTime,
            fingerprints: allDocs.map(d => ({
                source: d.metadata.source || '',
                chunkCount: 1
            }))
        };

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
        // Streamlined: status reporting not implemented; return empty
        return {
            totalDocuments: 0,
            totalChunks: 0,
            lastUpdate: 0,
            documents: []
        };
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