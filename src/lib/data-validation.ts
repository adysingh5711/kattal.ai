import { Document } from "langchain/document";
import { Pinecone } from "@pinecone-database/pinecone";
import { env } from "./env";

export interface ValidationResult {
    isValid: boolean;
    errors: string[];
    warnings: string[];
    suggestions: string[];
    stats: {
        totalDocuments: number;
        totalChunks: number;
        averageChunkSize: number;
        largestChunk: number;
        smallestChunk: number;
        duplicateContent: number;
    };
}

export interface DataIntegrityReport {
    vectorStoreHealth: {
        totalVectors: number;
        namespaces: string[];
        indexUtilization: number;
        orphanedVectors: number;
    };
    documentConsistency: {
        fingerprintCount: number;
        missingFingerprints: number;
        orphanedFingerprints: number;
        lastUpdate: number;
    };
    recommendations: string[];
    issues: string[];
}

export class DataValidator {
    private client: Pinecone;

    constructor(client: Pinecone) {
        this.client = client;
    }

    /**
     * Validate documents before processing
     */
    async validateDocuments(documents: Document[]): Promise<ValidationResult> {
        console.log(`🔍 Validating ${documents.length} documents...`);

        const result: ValidationResult = {
            isValid: true,
            errors: [],
            warnings: [],
            suggestions: [],
            stats: {
                totalDocuments: documents.length,
                totalChunks: documents.length,
                averageChunkSize: 0,
                largestChunk: 0,
                smallestChunk: Infinity,
                duplicateContent: 0
            }
        };

        if (documents.length === 0) {
            result.errors.push("No documents provided for validation");
            result.isValid = false;
            return result;
        }

        const contentSizes: number[] = [];
        const contentHashes = new Set<string>();
        const sources = new Set<string>();
        const duplicateContents: string[] = [];

        for (const doc of documents) {
            const content = doc.pageContent;
            const size = content.length;

            // Track content statistics
            contentSizes.push(size);
            result.stats.largestChunk = Math.max(result.stats.largestChunk, size);
            result.stats.smallestChunk = Math.min(result.stats.smallestChunk, size);

            // Check for empty content
            if (!content || content.trim().length === 0) {
                result.errors.push(`Document has empty content: ${doc.metadata?.source || 'unknown'}`);
                result.isValid = false;
            }

            // Check for extremely large content
            if (size > 10000) {
                result.warnings.push(`Large document detected (${size} chars): ${doc.metadata?.source || 'unknown'}`);
                result.suggestions.push("Consider chunking large documents for better embedding performance");
            }

            // Check for extremely small content
            if (size < 10) {
                result.warnings.push(`Very small document detected (${size} chars): ${doc.metadata?.source || 'unknown'}`);
            }

            // Check for duplicate content
            const contentHash = this.hashContent(content);
            if (contentHashes.has(contentHash)) {
                duplicateContents.push(doc.metadata?.source || 'unknown');
                result.stats.duplicateContent++;
            } else {
                contentHashes.add(contentHash);
            }

            // Validate metadata
            this.validateMetadata(doc, result);

            // Check source uniqueness
            const source = doc.metadata?.source;
            if (source) {
                if (sources.has(source)) {
                    result.warnings.push(`Duplicate source detected: ${source}`);
                } else {
                    sources.add(source);
                }
            } else {
                result.warnings.push("Document missing source metadata");
            }
        }

        // Calculate statistics
        result.stats.averageChunkSize = contentSizes.reduce((a, b) => a + b, 0) / contentSizes.length;

        if (result.stats.smallestChunk === Infinity) {
            result.stats.smallestChunk = 0;
        }

        // Generate suggestions based on statistics
        if (result.stats.averageChunkSize > 5000) {
            result.suggestions.push("Average chunk size is large. Consider using smaller chunks for better retrieval");
        }

        if (result.stats.duplicateContent > 0) {
            result.warnings.push(`Found ${result.stats.duplicateContent} documents with duplicate content`);
            result.suggestions.push("Remove duplicate content to improve embedding efficiency");
        }

        if (duplicateContents.length > 0) {
            result.warnings.push(`Duplicate content sources: ${duplicateContents.join(', ')}`);
        }

        // Token estimation
        const estimatedTokens = result.stats.totalChunks * (result.stats.averageChunkSize / 3);
        if (estimatedTokens > 1000000) {
            result.warnings.push(`High token count estimated: ~${Math.round(estimatedTokens).toLocaleString()} tokens`);
            result.suggestions.push("Consider the embedding costs for large token volumes");
        }

        console.log(`✅ Validation complete: ${result.isValid ? 'PASSED' : 'FAILED'}`);
        console.log(`   Errors: ${result.errors.length}, Warnings: ${result.warnings.length}`);

        return result;
    }

    private validateMetadata(doc: Document, result: ValidationResult): void {
        const metadata = doc.metadata;

        if (!metadata) {
            result.warnings.push("Document missing metadata");
            return;
        }

        // Check required metadata fields
        const requiredFields = ['source'];
        for (const field of requiredFields) {
            if (!metadata[field]) {
                result.warnings.push(`Document missing required metadata field: ${field}`);
            }
        }

        // Validate metadata size
        const metadataStr = JSON.stringify(metadata);
        if (metadataStr.length > 8000) {
            result.warnings.push(`Large metadata detected (${metadataStr.length} chars): ${metadata.source || 'unknown'}`);
            result.suggestions.push("Reduce metadata size to improve performance");
        }

        // Check for sensitive data in metadata
        const sensitivePatterns = [
            /password/i,
            /secret/i,
            /token/i,
            /key/i,
            /credential/i
        ];

        for (const pattern of sensitivePatterns) {
            if (pattern.test(metadataStr)) {
                result.errors.push(`Potential sensitive data in metadata: ${metadata.source || 'unknown'}`);
                result.isValid = false;
            }
        }
    }

    private hashContent(content: string): string {
        let hash = 0;
        for (let i = 0; i < content.length; i++) {
            const char = content.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return Math.abs(hash).toString(36);
    }

    /**
     * Check data integrity across the vector store
     */
    async checkDataIntegrity(): Promise<DataIntegrityReport> {
        console.log('🔍 Checking data integrity...');

        const report: DataIntegrityReport = {
            vectorStoreHealth: {
                totalVectors: 0,
                namespaces: [],
                indexUtilization: 0,
                orphanedVectors: 0
            },
            documentConsistency: {
                fingerprintCount: 0,
                missingFingerprints: 0,
                orphanedFingerprints: 0,
                lastUpdate: 0
            },
            recommendations: [],
            issues: []
        };

        try {
            // Check vector store health
            const index = this.client.Index(env.PINECONE_INDEX_NAME);
            const stats = await index.describeIndexStats();

            report.vectorStoreHealth.totalVectors = stats.totalRecordCount || 0;
            report.vectorStoreHealth.indexUtilization = stats.indexFullness || 0;
            report.vectorStoreHealth.namespaces = Object.keys(stats.namespaces || {});

            // Check fingerprints
            await this.checkFingerprints(report);

            // Check for orphaned vectors
            await this.checkOrphanedVectors(report);

            // Generate recommendations
            this.generateIntegrityRecommendations(report);

            console.log('✅ Data integrity check complete');
            return report;

        } catch (error) {
            console.error('❌ Data integrity check failed:', error);
            report.issues.push(`Integrity check failed: ${error}`);
            return report;
        }
    }

    private async checkFingerprints(report: DataIntegrityReport): Promise<void> {
        try {
            const index = this.client.Index(env.PINECONE_INDEX_NAME);
            const fingerprintIndex = index.namespace('document_fingerprints');

            const queryResponse = await fingerprintIndex.query({
                vector: new Array(3072).fill(0),
                topK: 10000,
                includeMetadata: true
            });

            report.documentConsistency.fingerprintCount = queryResponse.matches?.length || 0;

            if (queryResponse.matches) {
                const timestamps = queryResponse.matches
                    .map(match => match.metadata?.processingTimestamp as number)
                    .filter(ts => ts);

                if (timestamps.length > 0) {
                    report.documentConsistency.lastUpdate = Math.max(...timestamps);
                }
            }

        } catch (error) {
            report.issues.push(`Fingerprint check failed: ${error}`);
        }
    }

    private async checkOrphanedVectors(report: DataIntegrityReport): Promise<void> {
        try {
            const index = this.client.Index(env.PINECONE_INDEX_NAME);

            // Query main vectors
            const mainQuery = await index.query({
                vector: new Array(3072).fill(0),
                topK: 1000,
                includeMetadata: true
            });

            // Query fingerprints
            const fingerprintIndex = index.namespace('document_fingerprints');
            const fingerprintQuery = await fingerprintIndex.query({
                vector: new Array(3072).fill(0),
                topK: 1000,
                includeMetadata: true
            });

            const mainSources = new Set(
                mainQuery.matches?.map(match => match.metadata?.source).filter(Boolean) || []
            );

            const fingerprintSources = new Set(
                fingerprintQuery.matches?.map(match => match.metadata?.source).filter(Boolean) || []
            );

            // Check for vectors without fingerprints
            const vectorsWithoutFingerprints = Array.from(mainSources).filter(
                source => !fingerprintSources.has(source)
            );

            // Check for fingerprints without vectors
            const fingerprintsWithoutVectors = Array.from(fingerprintSources).filter(
                source => !mainSources.has(source)
            );

            report.documentConsistency.missingFingerprints = vectorsWithoutFingerprints.length;
            report.documentConsistency.orphanedFingerprints = fingerprintsWithoutVectors.length;

            if (vectorsWithoutFingerprints.length > 0) {
                report.issues.push(`${vectorsWithoutFingerprints.length} vectors without fingerprints`);
            }

            if (fingerprintsWithoutVectors.length > 0) {
                report.issues.push(`${fingerprintsWithoutVectors.length} orphaned fingerprints`);
            }

        } catch (error) {
            report.issues.push(`Orphaned vector check failed: ${error}`);
        }
    }

    private generateIntegrityRecommendations(report: DataIntegrityReport): void {
        // Index utilization recommendations
        if (report.vectorStoreHealth.indexUtilization > 0.8) {
            report.recommendations.push("Index is over 80% full - consider upgrading or archiving old data");
        }

        // Namespace recommendations
        if (report.vectorStoreHealth.namespaces.length > 10) {
            report.recommendations.push("Many namespaces detected - consider consolidating for better performance");
        }

        // Consistency recommendations
        if (report.documentConsistency.missingFingerprints > 0) {
            report.recommendations.push("Run incremental update to restore missing fingerprints");
        }

        if (report.documentConsistency.orphanedFingerprints > 0) {
            report.recommendations.push("Clean up orphaned fingerprints to improve consistency");
        }

        // Performance recommendations
        if (report.vectorStoreHealth.totalVectors > 100000) {
            report.recommendations.push("Large vector count - implement query caching for better performance");
        }

        // Backup recommendations
        const daysSinceUpdate = (Date.now() - report.documentConsistency.lastUpdate) / (1000 * 60 * 60 * 24);
        if (daysSinceUpdate > 7) {
            report.recommendations.push("No recent updates - consider setting up automated incremental updates");
        }
    }

    /**
     * Validate vector store connection and permissions
     */
    async validateConnection(): Promise<{
        connected: boolean;
        permissions: string[];
        issues: string[];
    }> {
        const result = {
            connected: false,
            permissions: [] as string[],
            issues: [] as string[]
        };

        try {
            // Test basic connection
            const indexList = await this.client.listIndexes();
            result.connected = true;
            result.permissions.push('list_indexes');

            // Test index access
            const indexExists = indexList.indexes?.some(idx => idx.name === env.PINECONE_INDEX_NAME);
            if (!indexExists) {
                result.issues.push(`Index '${env.PINECONE_INDEX_NAME}' not found`);
                return result;
            }

            result.permissions.push('access_index');

            // Test query permissions
            const index = this.client.Index(env.PINECONE_INDEX_NAME);
            await index.describeIndexStats();
            result.permissions.push('describe_stats');

            // Test query permissions
            await index.query({
                vector: new Array(3072).fill(0),
                topK: 1,
                includeMetadata: false
            });
            result.permissions.push('query');

            // Test upsert permissions (with dummy data)
            const testVector = {
                id: 'test_validation_vector',
                values: new Array(3072).fill(0),
                metadata: { test: true, timestamp: Date.now() }
            };

            await index.upsert([testVector]);
            result.permissions.push('upsert');

            // Clean up test vector
            await index.deleteOne('test_validation_vector');
            result.permissions.push('delete');

            console.log('✅ Connection validation successful');

        } catch (error) {
            result.issues.push(`Connection validation failed: ${error}`);
            console.error('❌ Connection validation failed:', error);
        }

        return result;
    }

    /**
     * Generate a comprehensive data health report
     */
    async generateHealthReport(): Promise<string> {
        const [integrity, connection] = await Promise.all([
            this.checkDataIntegrity(),
            this.validateConnection()
        ]);

        let report = "# Data Health Report\n\n";
        report += `Generated: ${new Date().toISOString()}\n\n`;

        // Connection Status
        report += "## Connection Status\n";
        report += `- Connected: ${connection.connected ? '✅' : '❌'}\n`;
        report += `- Permissions: ${connection.permissions.join(', ')}\n`;
        if (connection.issues.length > 0) {
            report += "- Issues:\n";
            connection.issues.forEach(issue => {
                report += `  - ❌ ${issue}\n`;
            });
        }
        report += "\n";

        // Vector Store Health
        report += "## Vector Store Health\n";
        report += `- Total Vectors: ${integrity.vectorStoreHealth.totalVectors.toLocaleString()}\n`;
        report += `- Index Utilization: ${(integrity.vectorStoreHealth.indexUtilization * 100).toFixed(1)}%\n`;
        report += `- Namespaces: ${integrity.vectorStoreHealth.namespaces.length} (${integrity.vectorStoreHealth.namespaces.join(', ')})\n`;
        report += `- Orphaned Vectors: ${integrity.vectorStoreHealth.orphanedVectors}\n`;
        report += "\n";

        // Document Consistency
        report += "## Document Consistency\n";
        report += `- Fingerprints: ${integrity.documentConsistency.fingerprintCount}\n`;
        report += `- Missing Fingerprints: ${integrity.documentConsistency.missingFingerprints}\n`;
        report += `- Orphaned Fingerprints: ${integrity.documentConsistency.orphanedFingerprints}\n`;
        report += `- Last Update: ${integrity.documentConsistency.lastUpdate ? new Date(integrity.documentConsistency.lastUpdate).toLocaleString() : 'Never'}\n`;
        report += "\n";

        // Issues
        if (integrity.issues.length > 0) {
            report += "## Issues Found\n";
            integrity.issues.forEach((issue, i) => {
                report += `${i + 1}. ❌ ${issue}\n`;
            });
            report += "\n";
        }

        // Recommendations
        if (integrity.recommendations.length > 0) {
            report += "## Recommendations\n";
            integrity.recommendations.forEach((rec, i) => {
                report += `${i + 1}. 💡 ${rec}\n`;
            });
            report += "\n";
        }

        // Action Items
        report += "## Recommended Actions\n";
        if (integrity.issues.length === 0) {
            report += "- ✅ No issues detected - data integrity is good\n";
        } else {
            report += "- 🔧 Run `npm run docs:update` to fix consistency issues\n";
            report += "- 🧹 Consider running cleanup operations for orphaned data\n";
        }
        report += "- 📊 Monitor index utilization regularly\n";
        report += "- 💾 Set up automated backups for important data\n";

        return report;
    }
}

/**
 * Utility function to validate documents before processing
 */
export async function validateBeforeProcessing(documents: Document[]): Promise<void> {
    const { getPinecone } = await import("./pinecone-client");
    const client = await getPinecone();
    const validator = new DataValidator(client);

    const result = await validator.validateDocuments(documents);

    if (!result.isValid) {
        const errorMessage = result.errors.join(', ');
        throw new Error(`Document validation failed: ${errorMessage}`);
    }

    if (result.warnings.length > 0) {
        console.warn('⚠️  Validation warnings:');
        result.warnings.forEach(warning => console.warn(`   - ${warning}`));
    }

    if (result.suggestions.length > 0) {
        console.log('💡 Suggestions:');
        result.suggestions.forEach(suggestion => console.log(`   - ${suggestion}`));
    }
}
