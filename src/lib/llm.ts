import { ChatOpenAI } from "@langchain/openai";
import { env } from './env';

export const streamingModel = new ChatOpenAI({
    modelName: env.LLM_MODEL,
    streaming: true,
    verbose: true,
    temperature: 0.2,
    openAIApiKey: env.OPENAI_API_KEY,
});

export const nonStreamingModel = new ChatOpenAI({
    modelName: env.LLM_MODEL,
    verbose: true,
    temperature: 0.2,
    openAIApiKey: env.OPENAI_API_KEY,
});