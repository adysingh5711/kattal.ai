// src/lib/llm-client.ts
import { env } from "./env";
import OpenAI from "openai";

/**
 * Provider-agnostic LLM client helper for OpenRouter (qwen) and OpenAI.
 * Exports:
 *  - callLLM(messages, options) => string (reply text)
 *  - generateGemmaCompletion(prompt) => string (reply text)
 *
 * Requires env.LLM_PROVIDER and env.LLM_MODEL to be set in your env.
 * - LLM_PROVIDER: "openrouter" | "openai" (defaults to "openrouter" if missing)
 * - LLM_MODEL: model id string (e.g. "qwen/qwen2.5-vl-72b-instruct:free" or "gpt-4o-mini")
 *
 * Also uses env.OPENROUTER_API_KEY and env.OPENAI_API_KEY as available.
 */

// Build provider clients conditionally
const PROVIDER = (env.LLM_PROVIDER ?? "openrouter").toLowerCase();
const MODEL = env.LLM_MODEL ?? process.env.LLM_MODEL ?? ""; // fallback to raw env if not in typed env

// instantiate OpenRouter client if key present
let openRouterClient: OpenAI | null = null;
if (env.OPENROUTER_API_KEY) {
    openRouterClient = new OpenAI({
        baseURL: "https://openrouter.ai/api/v1",
        apiKey: env.OPENROUTER_API_KEY,
        defaultHeaders: {
            "HTTP-Referer": "https://your-site-url.com",
            "X-Title": "StatePDFChat"
        }
    });
}

// instantiate OpenAI client if key present
let openaiClient: OpenAI | null = null;
if (env.OPENAI_API_KEY) {
    openaiClient = new OpenAI({ apiKey: env.OPENAI_API_KEY });
}

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

function normalizeModel(): string {
    if (MODEL && MODEL.length > 0) return MODEL;
    // reasonable defaults if nothing provided
    if (PROVIDER === "openai") return "gpt-4o-mini";
    return "qwen/qwen-2.5-72b-instruct:free";
}

/**
 * Extract human-readable text from various SDK response shapes.
 */
function extractTextFromChoice(choice: any): string {
    // OpenAI / OpenRouter sdk shapes vary. Try a few common paths safely.
    try {
        const msg = choice?.message ?? choice?.delta ?? null;
        if (!msg) return "";

        // Sometimes message.content is an array of parts [{type: "text", text: "..."}, ...]
        const content = msg.content ?? msg;
        if (Array.isArray(content)) {
            // join text parts
            return content.map((c: any) => (typeof c === "string" ? c : c?.text ?? "")).join("");
        }

        // If text directly available
        if (typeof content === "string") return content;

        // If content has text field
        if (content?.text) return content.text;

        // fallback to JSON stringify
        return JSON.stringify(choice);
    } catch {
        return "";
    }
}

/**
 * Provider-agnostic callLLM
 */
export async function callLLM(
    messages: ChatMessage[],
    {
        temperature = 0.0,
        max_tokens = 2000,
        model = normalizeModel()
    }: { temperature?: number; max_tokens?: number; model?: string } = {}
): Promise<string> {
    const provider = PROVIDER;

    // Basic validations
    if (provider === "openrouter" && !openRouterClient) {
        throw new Error("OPENROUTER_API_KEY not configured but LLM_PROVIDER is set to openrouter");
    }
    if (provider === "openai" && !openaiClient) {
        throw new Error("OPENAI_API_KEY not configured but LLM_PROVIDER is set to openai");
    }

    // map ChatMessage[] into provider-specific message shapes
    const mappedMessages = messages.map((m) => {
        return { role: m.role, content: [{ type: "text", text: m.content }] } as any;
    });

    try {
        if (provider === "openrouter") {
            // OpenRouter SDK (using openai npm package pointed at openrouter baseURL)
            const client = openRouterClient!;
            const completion = await client.chat.completions.create({
                model,
                messages: mappedMessages,
                temperature,
                max_tokens
            });

            const choice = completion?.choices?.[0];
            const text = extractTextFromChoice(choice) || (choice?.message ?? "");
            return String(text).trim();
        } else if (provider === "openai") {
            // Official OpenAI SDK usage
            const client = openaiClient!;
            // The official SDK returns message.content as array for some endpoints
            const completion = await client.chat.completions.create({
                model,
                messages: messages.map((m) => ({ role: m.role, content: m.content }))
            } as any);

            // fallback extraction
            const choice = completion?.choices?.[0];
            const text = extractTextFromChoice(choice) || (choice?.message ?? "");
            return String(text).trim();
        } else {
            throw new Error(`Unsupported LLM_PROVIDER: ${provider}`);
        }
    } catch (err: any) {
        // Bubble up with context
        console.error("LLM call failed", { provider, model, err: err?.message ?? err });
        throw err;
    }
}

/**
 * Convenience: the helper you previously used — now implemented over callLLM.
 * Returns the raw message content from the model.
 */
export async function generateGemmaCompletion(
    prompt: string,
    opts?: { temperature?: number; max_tokens?: number }
) {
    const system: ChatMessage = {
        role: "system",
        content: "You are a helpful assistant."
    };
    const user: ChatMessage = { role: "user", content: prompt };

    const reply = await callLLM([system, user], {
        temperature: opts?.temperature ?? 0.0,
        max_tokens: opts?.max_tokens ?? 512
    });
    return reply;
}