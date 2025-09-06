import { ChatOpenAI } from "@langchain/openai";
import { env } from './env';

export const streamingModel = new ChatOpenAI({
    modelName: env.LLM_MODEL,
    streaming: true,
    verbose: false, // Disable verbose for faster processing
    temperature: 0.1, // Lower temperature for more consistent, faster responses
    openAIApiKey: env.OPENAI_API_KEY,
    maxTokens: 500, // Limit response length for faster generation
    timeout: 10000, // 10 second timeout
});

export const nonStreamingModel = new ChatOpenAI({
    modelName: env.LLM_MODEL,
    verbose: false, // Disable verbose for faster processing
    temperature: 0.1, // Lower temperature for more consistent, faster responses
    openAIApiKey: env.OPENAI_API_KEY,
    maxTokens: 500, // Limit response length for faster generation
    timeout: 10000, // 10 second timeout
});