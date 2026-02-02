import { ChatOpenAI } from "@langchain/openai";
import { env } from './env';

export const streamingModel = new ChatOpenAI({
    modelName: env.LLM_MODEL,
    streaming: true,
    verbose: false, // Disable verbose for faster processing
    temperature: 0.05, // Very low temperature for precise, consistent responses
    openAIApiKey: env.OPENAI_API_KEY,
    maxTokens: 2000, // Significantly increased for comprehensive responses
    timeout: 45000, // Extended timeout for longer responses (45 seconds)
    maxRetries: 2,  // Add retry limit to prevent hanging
});

export const nonStreamingModel = new ChatOpenAI({
    modelName: env.LLM_MODEL,
    streaming: false, // Explicitly set to non-streaming
    verbose: false, // Disable verbose for faster processing
    temperature: 0.05, // Very low temperature for precise, consistent responses
    openAIApiKey: env.OPENAI_API_KEY,
    maxTokens: 2000, // Significantly increased for comprehensive responses
    timeout: 45000, // Extended timeout for longer responses (45 seconds)
});