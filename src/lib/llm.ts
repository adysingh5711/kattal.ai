import { ChatOpenAI } from "@langchain/openai";
import { env } from './env';
import OpenAI from 'openai';

// OpenRouter client setup
const openRouter = new OpenAI({
    baseURL: "https://openrouter.ai/api/v1",
    apiKey: env.OPENROUTER_API_KEY,
    defaultHeaders: {
        "HTTP-Referer": "https://your-site-url.com", // Replace with your actual site URL
        "X-Title": "StatePDFChat", // Replace with your actual site name
    },
});

// Create LangChain compatible models using OpenRouter
export const streamingModel = new ChatOpenAI({
    modelName: "google/gemma-3-27b-it:free",
    streaming: true,
    verbose: true,
    temperature: 0,
    configuration: {
        baseURL: "https://openrouter.ai/api/v1",
        apiKey: env.OPENROUTER_API_KEY,
        defaultHeaders: {
            "HTTP-Referer": "https://your-site-url.com",
            "X-Title": "StatePDFChat",
        },
    },
});

export const nonStreamingModel = new ChatOpenAI({
    modelName: "google/gemma-3-27b-it:free",
    verbose: true,
    temperature: 0,
    configuration: {
        baseURL: "https://openrouter.ai/api/v1",
        apiKey: env.OPENROUTER_API_KEY,
        defaultHeaders: {
            "HTTP-Referer": "https://your-site-url.com",
            "X-Title": "StatePDFChat",
        },
    },
});

// Direct OpenRouter API access for more control
export async function generateGemmaCompletion(prompt: string) {
    try {
        const completion = await openRouter.chat.completions.create({
            model: "google/gemma-3-27b-it:free",
            messages: [
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "text",
                            "text": prompt
                        }
                    ]
                }
            ],
        });

        return completion.choices[0].message;
    } catch (error) {
        console.error("Error generating completion:", error);
        throw error;
    }
}