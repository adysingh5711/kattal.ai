import { Pinecone } from "@pinecone-database/pinecone";
import { env } from "./env";
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

/**
 * Document Tracker for Pinecone
 * Prevents duplicate document processing by tracking file hashes and checking against Pinecone metadata
 */

export interface DocumentFingerprint {
    filePath: string;
    contentHash: string;
    fileSize: number;
    lastModified: number;
    chunkCount: number;
}

export interface TrackerResult {
    isNew: boolean;
    isModified: boolean;
    existingChunkCount: number;
    fingerprint: DocumentFingerprint;
}

// In-memory cache for faster lookups
let existingDocumentsCache: Map<string, DocumentFingerprint> | null = null;
let cacheTimestamp: number = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes cache

/**
 * Generate a content hash for a file
 */
export function generateFileHash(filePath: string): string {
    const content = fs.readFileSync(filePath, 'utf8');
    return crypto
        .createHash('sha256')
        .update(content)
        .digest('hex')
        .substring(0, 16); // Short hash for efficiency
}

/**
 * Generate a fingerprint for a document file
 */
export function generateDocumentFingerprint(filePath: string): DocumentFingerprint {
    const stats = fs.statSync(filePath);
    const contentHash = generateFileHash(filePath);

    return {
        filePath: path.resolve(filePath),
        contentHash,
        fileSize: stats.size,
        lastModified: stats.mtimeMs,
        chunkCount: 0 // Will be updated after processing
    };
}

/**
 * Fetch existing document metadata from Pinecone
 * Uses a sample query to get unique document sources
 */
export async function getExistingDocumentsFromPinecone(
    namespace: string = ''
): Promise<Map<string, DocumentFingerprint>> {
    // Return cache if valid
    if (existingDocumentsCache && (Date.now() - cacheTimestamp) < CACHE_TTL_MS) {
        console.log('📦 Using cached document list');
        return existingDocumentsCache;
    }

    console.log('🔍 Fetching existing documents from Pinecone...');

    const pc = new Pinecone({ apiKey: env.PINECONE_API_KEY });
    const index = pc.Index(env.PINECONE_INDEX_NAME);

    const documentsMap = new Map<string, DocumentFingerprint>();

    try {
        // Get index stats to check namespace
        const stats = await index.describeIndexStats();
        const namespaceStats = stats.namespaces?.[namespace];

        if (!namespaceStats || namespaceStats.recordCount === 0) {
            console.log(`📭 Namespace "${namespace || 'default'}" is empty`);
            existingDocumentsCache = documentsMap;
            cacheTimestamp = Date.now();
            return documentsMap;
        }

        console.log(`📊 Found ${namespaceStats.recordCount} vectors in namespace "${namespace || 'default'}"`);

        // Query with a dummy vector to fetch records with metadata
        // We'll use list() to iterate through vectors and extract unique sources
        const targetNamespace = index.namespace(namespace);

        // Use list to get vector IDs and then fetch their metadata
        const listResult = await targetNamespace.listPaginated({ limit: 100 });
        const vectorIds: string[] = [];

        if (listResult.vectors) {
            vectorIds.push(...listResult.vectors.map(v => v.id).filter((id): id is string => id !== undefined));
        }

        // Paginate through all vectors to collect sources
        let paginationToken = listResult.pagination?.next;
        while (paginationToken && vectorIds.length < 10000) { // Limit to prevent too many API calls
            const nextPage = await targetNamespace.listPaginated({
                limit: 100,
                paginationToken
            });
            if (nextPage.vectors) {
                vectorIds.push(...nextPage.vectors.map(v => v.id).filter((id): id is string => id !== undefined));
            }
            paginationToken = nextPage.pagination?.next;
        }

        console.log(`📋 Retrieved ${vectorIds.length} vector IDs`);

        // Fetch metadata for a sample of vectors (first 100 or so)
        // This gives us the unique sources without fetching all vectors
        if (vectorIds.length > 0) {
            const sampleIds = vectorIds.slice(0, Math.min(500, vectorIds.length));
            const fetchResult = await targetNamespace.fetch(sampleIds);

            const seenSources = new Set<string>();

            if (fetchResult.records) {
                for (const [, record] of Object.entries(fetchResult.records)) {
                    const metadata = record.metadata;
                    if (metadata?.source && typeof metadata.source === 'string') {
                        const source = metadata.source;
                        if (!seenSources.has(source)) {
                            seenSources.add(source);
                            documentsMap.set(source, {
                                filePath: source,
                                contentHash: (metadata.contentHash as string) || '',
                                fileSize: 0, // Not stored in Pinecone
                                lastModified: 0, // Not stored in Pinecone
                                chunkCount: 1 // Will count properly below
                            });
                        } else {
                            // Increment chunk count
                            const existing = documentsMap.get(source);
                            if (existing) {
                                existing.chunkCount++;
                            }
                        }
                    }
                }
            }
        }

        console.log(`✅ Found ${documentsMap.size} unique documents already in Pinecone`);

        // Cache the result
        existingDocumentsCache = documentsMap;
        cacheTimestamp = Date.now();

        return documentsMap;

    } catch (error) {
        console.error('❌ Error fetching existing documents:', error);
        return documentsMap;
    }
}

/**
 * Check if a document needs processing
 * Returns detailed status about whether to skip or process the document
 */
export async function checkDocumentStatus(
    filePath: string,
    namespace: string = ''
): Promise<TrackerResult> {
    const fingerprint = generateDocumentFingerprint(filePath);
    const existingDocs = await getExistingDocumentsFromPinecone(namespace);

    const resolvedPath = path.resolve(filePath);
    const existingDoc = existingDocs.get(resolvedPath);

    if (!existingDoc) {
        // Document not found in Pinecone
        return {
            isNew: true,
            isModified: false,
            existingChunkCount: 0,
            fingerprint
        };
    }

    // Check if content has changed (compare hashes)
    if (existingDoc.contentHash && existingDoc.contentHash !== fingerprint.contentHash) {
        return {
            isNew: false,
            isModified: true,
            existingChunkCount: existingDoc.chunkCount,
            fingerprint
        };
    }

    // Document exists and hasn't changed
    return {
        isNew: false,
        isModified: false,
        existingChunkCount: existingDoc.chunkCount,
        fingerprint
    };
}

/**
 * Filter documents that need processing (new or modified)
 * This is the main function to use before processing documents
 */
export async function filterDocumentsForProcessing(
    filePaths: string[],
    namespace: string = '',
    options: {
        forceReprocess?: boolean;
        includeModified?: boolean;
    } = {}
): Promise<{
    toProcess: string[];
    toSkip: string[];
    stats: {
        total: number;
        new: number;
        modified: number;
        unchanged: number;
    };
}> {
    const { forceReprocess = false, includeModified = true } = options;

    console.log(`\n🔍 Checking ${filePaths.length} documents for processing status...`);

    if (forceReprocess) {
        console.log('⚠️  Force reprocess enabled - all documents will be processed');
        return {
            toProcess: filePaths,
            toSkip: [],
            stats: {
                total: filePaths.length,
                new: filePaths.length,
                modified: 0,
                unchanged: 0
            }
        };
    }

    const toProcess: string[] = [];
    const toSkip: string[] = [];
    let newCount = 0;
    let modifiedCount = 0;
    let unchangedCount = 0;

    // Prefetch existing documents (single API call)
    await getExistingDocumentsFromPinecone(namespace);

    for (const filePath of filePaths) {
        const status = await checkDocumentStatus(filePath, namespace);

        if (status.isNew) {
            toProcess.push(filePath);
            newCount++;
            console.log(`➕ NEW: ${path.basename(filePath)}`);
        } else if (status.isModified) {
            if (includeModified) {
                toProcess.push(filePath);
                modifiedCount++;
                console.log(`🔄 MODIFIED: ${path.basename(filePath)} (${status.existingChunkCount} existing chunks)`);
            } else {
                toSkip.push(filePath);
                unchangedCount++;
            }
        } else {
            toSkip.push(filePath);
            unchangedCount++;
            console.log(`⏭️  SKIP: ${path.basename(filePath)} (${status.existingChunkCount} chunks already in Pinecone)`);
        }
    }

    console.log(`\n📊 Document Status Summary:`);
    console.log(`   ➕ New: ${newCount}`);
    console.log(`   🔄 Modified: ${modifiedCount}`);
    console.log(`   ⏭️  Unchanged: ${unchangedCount}`);
    console.log(`   📁 To Process: ${toProcess.length}`);
    console.log(`   ⏭️  To Skip: ${toSkip.length}`);

    return {
        toProcess,
        toSkip,
        stats: {
            total: filePaths.length,
            new: newCount,
            modified: modifiedCount,
            unchanged: unchangedCount
        }
    };
}

/**
 * Clear the document cache (useful after processing new documents)
 */
export function clearDocumentCache(): void {
    existingDocumentsCache = null;
    cacheTimestamp = 0;
    console.log('🗑️  Document cache cleared');
}

/**
 * Get a summary of documents in Pinecone
 */
export async function getDocumentsSummary(namespace: string = ''): Promise<{
    totalDocuments: number;
    totalChunks: number;
    documents: Array<{ source: string; chunkCount: number }>;
}> {
    const existingDocs = await getExistingDocumentsFromPinecone(namespace);

    const documents = Array.from(existingDocs.entries()).map(([source, fp]) => ({
        source: path.basename(source),
        chunkCount: fp.chunkCount
    }));

    const totalChunks = documents.reduce((sum, d) => sum + d.chunkCount, 0);

    return {
        totalDocuments: documents.length,
        totalChunks,
        documents
    };
}
