import { Document } from "langchain/document";
import { Pinecone } from "@pinecone-database/pinecone";
import { env } from "./env";
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { DataValidator, validateBeforeProcessing } from "./data-validation";

export interface DocumentFingerprint {
    id: string;
    source: string;
    contentHash: string;
    size: number;
    lastModified: number;
    chunkCount: number;
    processingTimestamp: number;
    metadata: Record<string, string | number | boolean | string[]>;
}

export interface IncrementalUpdateOptions {
    forceReprocess?: boolean;
    skipHashCheck?: boolean;
    namespace?: string;
    batchSize?: number;
    enableBackup?: boolean;
}

export interface UpdateResult {
    totalDocuments: number;
    newDocuments: number;
    updatedDocuments: number;
    skippedDocuments: number;
    errorDocuments: number;
    processedChunks: number;
    processingTime: number;
    fingerprints: DocumentFingerprint[];
}

export class IncrementalDataManager {
    private client: Pinecone;
    private fingerprintCache: Map<string, DocumentFingerprint> = new Map();
    private readonly FINGERPRINT_NAMESPACE = "document_fingerprints";
    private readonly BACKUP_NAMESPACE = "backup_data";
    private validator: DataValidator;

    constructor(client: Pinecone) {
        this.client = client;
        this.validator = new DataValidator(client);
    }

    /**
     * Main method to add documents incrementally without disturbing existing data
     */
    async addDocumentsIncremental(
        documents: Document[],
        options: IncrementalUpdateOptions = {}
    ): Promise<UpdateResult> {
        const startTime = Date.now();
        console.log(`🔄 Starting incremental document addition for ${documents.length} documents...`);

        const result: UpdateResult = {
            totalDocuments: documents.length,
            newDocuments: 0,
            updatedDocuments: 0,
            skippedDocuments: 0,
            errorDocuments: 0,
            processedChunks: 0,
            processingTime: 0,
            fingerprints: []
        };

        try {
            // Step 0: Validate documents before processing
            console.log('🔍 Validating documents before processing...');
            await validateBeforeProcessing(documents);

            // Step 1: Validate connection and permissions
            const connectionStatus = await this.validator.validateConnection();
            if (!connectionStatus.connected) {
                throw new Error(`Connection validation failed: ${connectionStatus.issues.join(', ')}`);
            }

            // Step 2: Load existing fingerprints
            await this.loadExistingFingerprints(options.namespace);

            // Step 3: Analyze documents for changes
            const analysis = await this.analyzeDocuments(documents, options);
            console.log(`📊 Document analysis complete:`, {
                new: analysis.newDocuments.length,
                updated: analysis.updatedDocuments.length,
                unchanged: analysis.unchangedDocuments.length
            });

            // Step 3: Backup existing data if enabled
            if (options.enableBackup && (analysis.updatedDocuments.length > 0)) {
                await this.backupExistingData(analysis.updatedDocuments, options.namespace);
            }

            // Step 4: Process new documents
            if (analysis.newDocuments.length > 0) {
                console.log(`➕ Processing ${analysis.newDocuments.length} new documents...`);
                const newResult = await this.processNewDocuments(analysis.newDocuments, options);
                result.newDocuments = newResult.processedCount;
                result.processedChunks += newResult.chunkCount;
                result.fingerprints.push(...newResult.fingerprints);
            }

            // Step 5: Process updated documents
            if (analysis.updatedDocuments.length > 0) {
                console.log(`🔄 Processing ${analysis.updatedDocuments.length} updated documents...`);
                const updateResult = await this.processUpdatedDocuments(analysis.updatedDocuments, options);
                result.updatedDocuments = updateResult.processedCount;
                result.processedChunks += updateResult.chunkCount;
                result.fingerprints.push(...updateResult.fingerprints);
            }

            // Step 6: Record skipped documents
            result.skippedDocuments = analysis.unchangedDocuments.length;

            // Step 7: Save updated fingerprints
            await this.saveFingerprints(result.fingerprints, options.namespace);

            result.processingTime = Date.now() - startTime;

            console.log(`✅ Incremental update complete:`, {
                totalTime: `${(result.processingTime / 1000).toFixed(2)}s`,
                new: result.newDocuments,
                updated: result.updatedDocuments,
                skipped: result.skippedDocuments,
                chunks: result.processedChunks
            });

            return result;

        } catch (error) {
            console.error('❌ Incremental update failed:', error);
            result.errorDocuments = documents.length;
            result.processingTime = Date.now() - startTime;
            throw new Error(`Incremental update failed: ${error}`);
        }
    }

    /**
     * Generate a unique fingerprint for a document
     */
    private generateDocumentFingerprint(doc: Document): DocumentFingerprint {
        const source = doc.metadata?.source || 'unknown';
        const content = doc.pageContent;

        // Create content hash
        const contentHash = crypto
            .createHash('sha256')
            .update(content)
            .digest('hex');

        // Get file stats if source is a file path
        let fileStats = { size: content.length, lastModified: Date.now() };
        try {
            if (fs.existsSync(source)) {
                const stats = fs.statSync(source);
                fileStats = {
                    size: stats.size,
                    lastModified: stats.mtime.getTime()
                };
            }
        } catch (_error) {
            // Ignore file stat errors
        }

        return {
            id: this.generateDocumentId(source, contentHash),
            source,
            contentHash,
            size: fileStats.size,
            lastModified: fileStats.lastModified,
            chunkCount: 1, // Will be updated during chunking
            processingTimestamp: Date.now(),
            metadata: {
                ...doc.metadata,
                originalLength: content.length
            }
        };
    }

    /**
     * Generate a consistent document ID
     */
    private generateDocumentId(source: string, contentHash: string): string {
        const hashShort = contentHash.substring(0, 8);
        return `${path.basename(source).replace(/[^a-zA-Z0-9]/g, '_')}_${hashShort}`;
    }

    /**
     * Sanitize metadata for Pinecone storage
     */
    private sanitizeMetadata(metadata: Record<string, unknown>): Record<string, string | number | boolean | string[]> {
        const sanitized: Record<string, string | number | boolean | string[]> = {};

        for (const [key, value] of Object.entries(metadata)) {
            // Only allow simple data types that Pinecone supports
            if (value === null || value === undefined) {
                continue;
            } else if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
                sanitized[key] = value;
            } else if (Array.isArray(value)) {
                // Only allow arrays of strings
                const stringArray = value.filter(item => typeof item === 'string');
                if (stringArray.length > 0) {
                    sanitized[key] = stringArray;
                }
            } else {
                // Convert complex objects to string representation
                try {
                    sanitized[key] = JSON.stringify(value);
                } catch (error) {
                    console.warn(`Failed to serialize metadata field '${key}':`, error);
                    sanitized[key] = String(value);
                }
            }
        }

        return sanitized;
    }

    /**
     * Analyze documents to determine what needs to be processed
     */
    private async analyzeDocuments(
        documents: Document[],
        options: IncrementalUpdateOptions
    ): Promise<{
        newDocuments: Document[];
        updatedDocuments: Document[];
        unchangedDocuments: Document[];
    }> {
        const newDocuments: Document[] = [];
        const updatedDocuments: Document[] = [];
        const unchangedDocuments: Document[] = [];

        for (const doc of documents) {
            const fingerprint = this.generateDocumentFingerprint(doc);
            const existing = this.fingerprintCache.get(fingerprint.source);

            if (!existing) {
                // New document
                newDocuments.push(doc);
            } else if (options.forceReprocess) {
                // Force reprocessing
                updatedDocuments.push(doc);
            } else if (options.skipHashCheck) {
                // Skip hash check, assume no changes
                unchangedDocuments.push(doc);
            } else if (existing.contentHash !== fingerprint.contentHash) {
                // Content has changed
                updatedDocuments.push(doc);
            } else if (existing.lastModified < fingerprint.lastModified) {
                // File was modified
                updatedDocuments.push(doc);
            } else {
                // No changes detected
                unchangedDocuments.push(doc);
            }
        }

        return { newDocuments, updatedDocuments, unchangedDocuments };
    }

    /**
     * Process new documents that haven't been added before
     */
    private async processNewDocuments(
        documents: Document[],
        options: IncrementalUpdateOptions
    ): Promise<{ processedCount: number; chunkCount: number; fingerprints: DocumentFingerprint[] }> {
        const fingerprints: DocumentFingerprint[] = [];
        let processedCount = 0;
        let chunkCount = 0;

        const { OptimizedVectorStore } = await import('./optimized-vector-store');
        const vectorStore = new OptimizedVectorStore();

        try {
            await vectorStore.embedAndStoreDocs(documents);

            for (const doc of documents) {
                const fingerprint = this.generateDocumentFingerprint(doc);
                fingerprint.chunkCount = 1; // This would be updated based on actual chunking
                fingerprints.push(fingerprint);
                processedCount++;
                chunkCount++;
            }

        } catch (error) {
            console.error('❌ Failed to process new documents:', error);
            throw error;
        }

        return { processedCount, chunkCount, fingerprints };
    }

    /**
     * Process documents that have been updated
     */
    private async processUpdatedDocuments(
        documents: Document[],
        options: IncrementalUpdateOptions
    ): Promise<{ processedCount: number; chunkCount: number; fingerprints: DocumentFingerprint[] }> {
        const fingerprints: DocumentFingerprint[] = [];
        let processedCount = 0;
        let chunkCount = 0;

        for (const doc of documents) {
            try {
                // Step 1: Remove old vectors for this document
                await this.removeOldVectors(doc, options.namespace);

                // Step 2: Add updated document
                const { OptimizedVectorStore } = await import('./optimized-vector-store');
                const vectorStore = new OptimizedVectorStore();
                await vectorStore.embedAndStoreDocs([doc]);

                // Step 3: Update fingerprint
                const fingerprint = this.generateDocumentFingerprint(doc);
                fingerprint.chunkCount = 1; // Would be updated based on actual chunking
                fingerprints.push(fingerprint);

                processedCount++;
                chunkCount++;

                console.log(`✅ Updated document: ${doc.metadata?.source || 'unknown'}`);

            } catch (error) {
                console.error(`❌ Failed to update document ${doc.metadata?.source}:`, error);
            }
        }

        return { processedCount, chunkCount, fingerprints };
    }

    /**
     * Remove old vectors for a document
     */
    private async removeOldVectors(doc: Document, namespace?: string): Promise<void> {
        try {
            const index = this.client.Index(env.PINECONE_INDEX_NAME);
            const targetIndex = namespace ? index.namespace(namespace) : index;

            // Generate the vector ID pattern for this document
            const source = doc.metadata?.source || 'unknown';
            const sourceId = path.basename(source).replace(/[^a-zA-Z0-9]/g, '_');

            // Query vectors with this source
            const queryResponse = await targetIndex.query({
                vector: new Array(3072).fill(0), // Dummy vector
                topK: 1000, // Get up to 1000 vectors
                includeMetadata: true,
                filter: {
                    source: source
                }
            });

            // Delete matching vectors
            if (queryResponse.matches && queryResponse.matches.length > 0) {
                const idsToDelete = queryResponse.matches.map(match => match.id);
                await targetIndex.deleteMany(idsToDelete);
                console.log(`🗑️  Removed ${idsToDelete.length} old vectors for ${source}`);
            }

        } catch (error) {
            console.warn(`⚠️  Could not remove old vectors for ${doc.metadata?.source}:`, error);
        }
    }

    /**
     * Backup existing data before updates
     */
    private async backupExistingData(documents: Document[], namespace?: string): Promise<void> {
        console.log(`💾 Creating backup of ${documents.length} documents...`);

        try {
            const index = this.client.Index(env.PINECONE_INDEX_NAME);
            const sourceIndex = namespace ? index.namespace(namespace) : index;
            const backupIndex = index.namespace(this.BACKUP_NAMESPACE);

            for (const doc of documents) {
                const source = doc.metadata?.source || 'unknown';

                // Query existing vectors for this document
                const queryResponse = await sourceIndex.query({
                    vector: new Array(3072).fill(0),
                    topK: 1000,
                    includeMetadata: true,
                    filter: { source: source }
                });

                // Copy to backup namespace with timestamp
                if (queryResponse.matches && queryResponse.matches.length > 0) {
                    const backupVectors = queryResponse.matches.map(match => ({
                        id: `backup_${Date.now()}_${match.id}`,
                        values: match.values,
                        metadata: {
                            ...match.metadata,
                            backupTimestamp: Date.now(),
                            originalId: match.id
                        }
                    }));

                    await backupIndex.upsert(backupVectors);
                }
            }

            console.log(`✅ Backup created for ${documents.length} documents`);

        } catch (error) {
            console.warn('⚠️  Backup creation failed:', error);
        }
    }

    /**
     * Load existing document fingerprints
     */
    private async loadExistingFingerprints(
        _namespace?: string
    ): Promise<void> {
        try {
            const index = this.client.Index(env.PINECONE_INDEX_NAME);
            const fingerprintIndex = index.namespace(this.FINGERPRINT_NAMESPACE);

            // Query all fingerprints
            const queryResponse = await fingerprintIndex.query({
                vector: new Array(3072).fill(0),
                topK: 10000, // Get all fingerprints
                includeMetadata: true
            });

            this.fingerprintCache.clear();

            if (queryResponse.matches) {
                for (const match of queryResponse.matches) {
                    if (match.metadata) {
                        let originalMetadata: Record<string, string | number | boolean | string[]> = {};
                        const rawMetadata = match.metadata.originalMetadata;
                        if (typeof rawMetadata === 'string') {
                            try {
                                originalMetadata = JSON.parse(rawMetadata);
                            } catch (_error) {
                                console.warn('Failed to parse originalMetadata:', _error);
                                originalMetadata = {};
                            }
                        } else if (rawMetadata && typeof rawMetadata === 'object' && !Array.isArray(rawMetadata)) {
                            originalMetadata = rawMetadata as Record<string, string | number | boolean | string[]>;
                        }

                        const fingerprint: DocumentFingerprint = {
                            id: match.metadata.id as string,
                            source: match.metadata.source as string,
                            contentHash: match.metadata.contentHash as string,
                            size: match.metadata.size as number,
                            lastModified: match.metadata.lastModified as number,
                            chunkCount: match.metadata.chunkCount as number,
                            processingTimestamp: match.metadata.processingTimestamp as number,
                            metadata: originalMetadata
                        };

                        this.fingerprintCache.set(fingerprint.source, fingerprint);
                    }
                }
            }

            console.log(`📋 Loaded ${this.fingerprintCache.size} existing fingerprints`);

        } catch (error) {
            console.warn('⚠️  Could not load fingerprints, treating all documents as new:', error);
        }
    }

    /**
     * Save updated fingerprints
     */
    private async saveFingerprints(
        fingerprints: DocumentFingerprint[],
        _namespace?: string
    ): Promise<void> {
        if (fingerprints.length === 0) return;

        try {
            const index = this.client.Index(env.PINECONE_INDEX_NAME);
            const fingerprintIndex = index.namespace(this.FINGERPRINT_NAMESPACE);

            const vectors = fingerprints.map(fp => {
                // Sanitize fingerprint metadata before storing
                const sanitizedFingerprint = this.sanitizeMetadata({
                    id: fp.id,
                    source: fp.source,
                    contentHash: fp.contentHash,
                    size: fp.size,
                    lastModified: fp.lastModified,
                    chunkCount: fp.chunkCount,
                    processingTimestamp: fp.processingTimestamp,
                    originalMetadata: JSON.stringify(fp.metadata)
                });

                return {
                    id: `fingerprint_${fp.id}`,
                    values: new Array(3072).fill(0), // Dummy vector for metadata storage
                    metadata: sanitizedFingerprint
                };
            });

            await fingerprintIndex.upsert(vectors);

            // Update local cache
            fingerprints.forEach(fp => {
                this.fingerprintCache.set(fp.source, fp);
            });

            console.log(`💾 Saved ${fingerprints.length} fingerprints`);

        } catch (error) {
            console.warn('⚠️  Could not save fingerprints:', error);
        }
    }

    /**
     * Get status of all documents in the system
     */
    async getDocumentStatus(): Promise<{
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
        await this.loadExistingFingerprints();

        const documents = Array.from(this.fingerprintCache.values()).map(fp => ({
            source: fp.source,
            chunkCount: fp.chunkCount,
            lastModified: fp.lastModified,
            processingTimestamp: fp.processingTimestamp,
            size: fp.size
        }));

        const totalChunks = documents.reduce((sum, doc) => sum + doc.chunkCount, 0);
        const lastUpdate = Math.max(...documents.map(doc => doc.processingTimestamp), 0);

        return {
            totalDocuments: documents.length,
            totalChunks,
            lastUpdate,
            documents
        };
    }

    /**
     * Clean up old backups
     */
    async cleanupOldBackups(maxAgeMs: number = 7 * 24 * 60 * 60 * 1000): Promise<void> {
        console.log('🧹 Cleaning up old backups...');

        try {
            const index = this.client.Index(env.PINECONE_INDEX_NAME);
            const backupIndex = index.namespace(this.BACKUP_NAMESPACE);

            const cutoffTime = Date.now() - maxAgeMs;

            // Query all backup vectors
            const queryResponse = await backupIndex.query({
                vector: new Array(3072).fill(0),
                topK: 10000,
                includeMetadata: true
            });

            if (queryResponse.matches) {
                const oldBackups = queryResponse.matches.filter(match => {
                    const backupTimestamp = match.metadata?.backupTimestamp as number;
                    return backupTimestamp && backupTimestamp < cutoffTime;
                });

                if (oldBackups.length > 0) {
                    const idsToDelete = oldBackups.map(backup => backup.id);
                    await backupIndex.deleteMany(idsToDelete);
                    console.log(`🗑️  Deleted ${idsToDelete.length} old backup vectors`);
                }
            }

        } catch (error) {
            console.warn('⚠️  Backup cleanup failed:', error);
        }
    }

    /**
     * Restore from backup
     */
    async restoreFromBackup(source: string, backupTimestamp?: number): Promise<boolean> {
        console.log(`🔄 Restoring ${source} from backup...`);

        try {
            const index = this.client.Index(env.PINECONE_INDEX_NAME);
            const backupIndex = index.namespace(this.BACKUP_NAMESPACE);
            const mainIndex = index;

            // Fixed: Unexpected any. Specify a different type
            const filter: Record<string, string | number> = { 'metadata.source': source };
            if (backupTimestamp) {
                filter['metadata.backupTimestamp'] = backupTimestamp;
            }

            const queryResponse = await backupIndex.query({
                vector: new Array(3072).fill(0),
                topK: 1000,
                includeMetadata: true,
                filter: filter
            });

            if (queryResponse.matches && queryResponse.matches.length > 0) {
                // First remove current version
                await this.removeOldVectors({
                    pageContent: '',
                    metadata: { source }
                } as Document);

                // Restore backup vectors
                const restoreVectors = queryResponse.matches.map(match => ({
                    id: match.metadata?.originalId as string,
                    values: match.values,
                    metadata: {
                        ...match.metadata,
                        restoredFromBackup: true,
                        restoreTimestamp: Date.now()
                    }
                }));

                await mainIndex.upsert(restoreVectors);
                console.log(`✅ Restored ${restoreVectors.length} vectors for ${source}`);
                return true;
            }

            console.log(`❌ No backup found for ${source}`);
            return false;

        } catch (error) {
            console.error('❌ Restore failed:', error);
            return false;
        }
    }

    /**
     * Perform comprehensive health check
     */
    async performHealthCheck(): Promise<{
        healthy: boolean;
        report: string;
        issues: string[];
        recommendations: string[];
    }> {
        console.log('🏥 Performing comprehensive health check...');

        try {
            const report = await this.validator.generateHealthReport();
            const integrity = await this.validator.checkDataIntegrity();

            const healthy = integrity.issues.length === 0;

            return {
                healthy,
                report,
                issues: integrity.issues,
                recommendations: integrity.recommendations
            };

        } catch (error) {
            return {
                healthy: false,
                report: `Health check failed: ${error}`,
                issues: [`Health check error: ${error}`],
                recommendations: ['Fix connection issues and retry health check']
            };
        }
    }

    /**
     * Safe mode processing with extensive validation
     */
    async addDocumentsSafe(
        documents: Document[],
        options: IncrementalUpdateOptions = {}
    ): Promise<UpdateResult> {
        console.log('🛡️  Running in SAFE MODE with extensive validation...');

        // Pre-flight checks
        const healthCheck = await this.performHealthCheck();
        if (!healthCheck.healthy) {
            console.warn('⚠️  Health check failed, but proceeding with caution...');
            console.warn('Issues:', healthCheck.issues);
        }

        // Enhanced validation
        const validation = await this.validator.validateDocuments(documents);
        if (!validation.isValid) {
            throw new Error(`Document validation failed: ${validation.errors.join(', ')}`);
        }

        if (validation.warnings.length > 0) {
            console.warn('⚠️  Validation warnings (proceeding with caution):');
            validation.warnings.forEach(warning => console.warn(`   - ${warning}`));
        }

        // Enable backup by default in safe mode
        const safeOptions: IncrementalUpdateOptions = {
            enableBackup: true,
            batchSize: 25, // Smaller batches for safety
            ...options
        };

        // Proceed with normal incremental update
        return await this.addDocumentsIncremental(documents, safeOptions);
    }

    /**
     * Emergency rollback to previous state
     */
    async emergencyRollback(beforeTimestamp: number): Promise<{
        success: boolean;
        restoredDocuments: number;
        errors: string[];
    }> {
        console.log('🚨 Performing emergency rollback...');

        const result = {
            success: false,
            restoredDocuments: 0,
            errors: [] as string[]
        };

        try {
            const index = this.client.Index(env.PINECONE_INDEX_NAME);
            const backupIndex = index.namespace(this.BACKUP_NAMESPACE);

            // Find all backups before the timestamp
            const queryResponse = await backupIndex.query({
                vector: new Array(3072).fill(0),
                topK: 10000,
                includeMetadata: true,
                filter: {
                    backupTimestamp: { $lt: beforeTimestamp }
                }
            });

            if (!queryResponse.matches || queryResponse.matches.length === 0) {
                result.errors.push('No backup data found for rollback');
                return result;
            }

            // Group by source
            // Fixed: Unexpected any. Specify a different type
            const sourceGroups = new Map<string, Array<{ id: string; values: number[]; metadata?: Record<string, unknown> }>>();
            for (const match of queryResponse.matches) {
                const source = match.metadata?.source as string;
                if (source && match.values) {
                    if (!sourceGroups.has(source)) {
                        sourceGroups.set(source, []);
                    }
                    sourceGroups.get(source)!.push({
                        id: match.id,
                        values: match.values,
                        metadata: match.metadata
                    });
                }
            }

            // Restore each source
            for (const [source, backups] of sourceGroups.entries()) {
                try {
                    // Remove current version
                    await this.removeOldVectors({
                        pageContent: '',
                        metadata: { source }
                    } as Document);

                    // Restore backup
                    const restoreVectors = backups.map(backup => ({
                        id: backup.metadata?.originalId as string,
                        values: backup.values,
                        metadata: {
                            ...backup.metadata,
                            restoredFromBackup: true,
                            rollbackTimestamp: Date.now()
                        }
                    }));

                    await index.upsert(restoreVectors);
                    result.restoredDocuments++;

                } catch (error) {
                    result.errors.push(`Failed to restore ${source}: ${error}`);
                }
            }

            result.success = result.restoredDocuments > 0;
            console.log(`${result.success ? '✅' : '❌'} Rollback complete: ${result.restoredDocuments} documents restored`);

        } catch (error) {
            result.errors.push(`Rollback failed: ${error}`);
        }

        return result;
    }

    /**
     * Dry run to see what would be processed without actually doing it
     */
    async dryRun(documents: Document[], options: IncrementalUpdateOptions = {}): Promise<{
        wouldProcess: {
            new: string[];
            updated: string[];
            skipped: string[];
        };
        estimatedTime: number;
        estimatedCost: number;
        warnings: string[];
    }> {
        console.log('🧪 Performing dry run analysis...');

        const result = {
            wouldProcess: {
                new: [] as string[],
                updated: [] as string[],
                skipped: [] as string[]
            },
            estimatedTime: 0,
            estimatedCost: 0,
            warnings: [] as string[]
        };

        try {
            // Validate documents
            const validation = await this.validator.validateDocuments(documents);
            result.warnings.push(...validation.warnings);

            // Load fingerprints
            await this.loadExistingFingerprints(options.namespace);

            // Analyze what would be processed
            const analysis = await this.analyzeDocuments(documents, options);

            result.wouldProcess.new = analysis.newDocuments.map(doc => doc.metadata?.source || 'unknown');
            result.wouldProcess.updated = analysis.updatedDocuments.map(doc => doc.metadata?.source || 'unknown');
            result.wouldProcess.skipped = analysis.unchangedDocuments.map(doc => doc.metadata?.source || 'unknown');

            // Estimate processing time (rough calculation)
            const documentsToProcess = analysis.newDocuments.length + analysis.updatedDocuments.length;
            result.estimatedTime = documentsToProcess * 2000; // ~2 seconds per document

            // Estimate embedding cost
            const avgTokensPerDoc = 500;
            const totalTokens = documentsToProcess * avgTokensPerDoc;
            // Cost estimation based on current embedding model
            const costPer1MTokens = env.EMBEDDING_MODEL.includes('3-large') ? 0.13 :
                env.EMBEDDING_MODEL.includes('3-small') ? 0.02 :
                    env.EMBEDDING_MODEL.includes('ada-002') ? 0.0001 : 0.13;
            result.estimatedCost = (totalTokens / 1000000) * costPer1MTokens;

            console.log('📊 Dry run results:', {
                new: result.wouldProcess.new.length,
                updated: result.wouldProcess.updated.length,
                skipped: result.wouldProcess.skipped.length,
                estimatedTime: `${(result.estimatedTime / 1000).toFixed(1)}s`,
                estimatedCost: `$${result.estimatedCost.toFixed(4)}`
            });

        } catch (error) {
            result.warnings.push(`Dry run analysis failed: ${error}`);
        }

        return result;
    }
}
