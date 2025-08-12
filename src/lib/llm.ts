import { ChatOpenAI } from "@langchain/openai";
import { env } from './env';

export const streamingModel = new ChatOpenAI({
    modelName: "gpt-4o-mini",
    streaming: true,
    verbose: true,
    temperature: 0.2,
    openAIApiKey: env.OPENAI_API_KEY,
});

export const nonStreamingModel = new ChatOpenAI({
    modelName: "gpt-4o-mini",
    verbose: true,
    temperature: 0.2,
    openAIApiKey: env.OPENAI_API_KEY,
});