#!/usr/bin/env tsx
/**
 * Reset Circuit Breaker Script
 * 
 * Use this script to reset the circuit breaker when you encounter
 * "Circuit breaker is OPEN" errors during batch processing.
 */

import { OptimizedVectorStore } from '../lib/optimized-vector-store.js';

async function resetCircuitBreaker() {
    console.log('🔄 Resetting circuit breaker...');

    try {
        const vectorStore = new OptimizedVectorStore();

        // Get current status
        const status = vectorStore.getCircuitBreakerStatus();
        console.log(`📊 Current circuit breaker status:`, status);

        // Reset the circuit breaker
        vectorStore.resetCircuitBreaker();

        // Verify reset
        const newStatus = vectorStore.getCircuitBreakerStatus();
        console.log(`✅ Circuit breaker reset successfully:`, newStatus);

        console.log('\n💡 Tips for preventing future circuit breaker issues:');
        console.log('  • Reduce batch size (use smaller chunks)');
        console.log('  • Check your API keys and rate limits');
        console.log('  • Ensure stable internet connection');
        console.log('  • Wait a few minutes between large batch operations');

    } catch (error) {
        console.error('❌ Failed to reset circuit breaker:', error);
        process.exit(1);
    }
}

// Run the script
resetCircuitBreaker().catch(console.error);
