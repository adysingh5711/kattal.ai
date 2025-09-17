import { ChatOpenAI } from "@langchain/openai";
import { env } from './env';

export const streamingModel = new ChatOpenAI({
    modelName: env.LLM_MODEL,
    streaming: true,
    verbose: false, // Disable verbose for faster processing
    temperature: 0.05, // Very low temperature for precise, consistent responses
    openAIApiKey: env.OPENAI_API_KEY,
    maxTokens: 600, // Increased for more detailed responses
    timeout: 15000, // Increased timeout for deeper analysis
    maxRetries: 2,  // Add retry limit to prevent hanging
});

export const nonStreamingModel = new ChatOpenAI({
    modelName: env.LLM_MODEL,
    streaming: false, // Explicitly set to non-streaming
    verbose: false, // Disable verbose for faster processing
    temperature: 0.05, // Very low temperature for precise, consistent responses
    openAIApiKey: env.OPENAI_API_KEY,
    maxTokens: 600, // Increased for more detailed responses
    timeout: 15000, // Increased timeout for deeper analysis
});