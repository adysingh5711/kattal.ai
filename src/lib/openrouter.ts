import OpenAI from 'openai';
import { env } from './env';

export const openRouter = new OpenAI({
    baseURL: "https://openrouter.ai/api/v1",
    apiKey: env.OPENROUTER_API_KEY,
    defaultHeaders: {
        "HTTP-Referer": "https://your-site-url.com", // Replace with your actual site URL
        "X-Title": "StatePDFChat", // Replace with your actual site name
    },
});

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

// For streaming responses
export async function createGemmaStream(messages: OpenAI.Chat.ChatCompletionMessageParam[]) {
    return await openRouter.chat.completions.create({
        model: "google/gemma-3-27b-it:free",
        messages: messages,
        stream: true,
    });
}