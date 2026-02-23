/**
 * Vertex AI Gemini integration — direct REST API via google-auth-library.
 *
 * Why REST instead of @google/genai SDK?
 * The SDK auto-detects GOOGLE_CLOUD_PROJECT in the env and silently switches
 * to Vertex AI mode even when an API key is passed, causing 401 UNAUTHENTICATED.
 * Using the REST API directly with an OAuth2 token from google-auth-library
 * avoids this entirely.
 *
 * Auth strategy (server-side only — users never authenticate):
 *   Primary  : GOOGLE_APPLICATION_CREDENTIALS_JSON  (service account JSON string)
 *              → used with GOOGLE_CLOUD_PROJECT + GOOGLE_CLOUD_LOCATION
 *              → Vertex AI RAG corpus grounding is active
 *   Fallback : GEMINI_API_KEY / GOOGLE_CLOUD_API_KEY
 *              → AI Studio public endpoint, no RAG corpus
 *              → Pinecone context in the prompt is the only grounding
 *
 * Output of streamVertexGeminiWithGrounding() feeds directly into
 * combineAndUniformise() → enforceMalayalam() in route.ts.
 * Nothing in route.ts changes.
 */
import 'server-only';
import { logger } from './logger';

// ─── Config ──────────────────────────────────────────────────────────────────

const PROJECT = process.env.GOOGLE_CLOUD_PROJECT?.trim() ?? '';
const LOCATION = process.env.GOOGLE_CLOUD_LOCATION?.trim() ?? '';
const MODEL = (process.env.GEMINI_GROUNDING_MODEL ?? process.env.VERTEX_MODEL_ID ?? 'gemini-2.0-flash').trim();
const RAG_CORPUS = process.env.VERTEX_RAG_CORPUS?.trim() ?? '';

// Vertex AI REST base URL
const VERTEX_BASE = `https://${LOCATION}-aiplatform.googleapis.com/v1beta1/projects/${PROJECT}/locations/${LOCATION}/publishers/google/models/${MODEL}`;

// AI Studio public endpoint (fallback)
const AISTUDIO_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

// ─── OAuth2 token (Vertex AI path) ───────────────────────────────────────────

/** Cache the token so we don't re-fetch on every request. Refresh ~1 min before expiry. */
let cachedToken: { value: string; expiresAt: number } | null = null;

async function getVertexAccessToken(): Promise<string> {
    const now = Date.now();

    // Return cached token if still valid (at least 60 s remaining)
    if (cachedToken && cachedToken.expiresAt - now > 60_000) {
        return cachedToken.value;
    }

    const serviceAccountJson =
        process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON?.trim() ?? '';

    if (!serviceAccountJson) {
        throw new Error(
            'GOOGLE_APPLICATION_CREDENTIALS_JSON is not set. ' +
            'Add the full service account JSON string (single line) to your env.'
        );
    }

    const { GoogleAuth } = await import('google-auth-library');
    const auth = new GoogleAuth({
        credentials: JSON.parse(serviceAccountJson),
        scopes: ['https://www.googleapis.com/auth/cloud-platform'],
    });

    const client = await auth.getClient();
    const tokenResponse = await client.getAccessToken();

    if (!tokenResponse.token) {
        throw new Error('google-auth-library returned an empty access token.');
    }

    // getAccessToken() doesn't always expose expiry; default to 55 min
    cachedToken = {
        value: tokenResponse.token,
        expiresAt: now + 55 * 60 * 1000,
    };

    return cachedToken.value;
}

// ─── Vertex AI REST call ──────────────────────────────────────────────────────

/**
 * Build the Vertex AI request body.
 * RAG corpus is attached via tools[].retrieval if VERTEX_RAG_CORPUS is set.
 */
interface ChatTurn { role: 'user' | 'assistant'; content: string; }

/** Strip raw GCS storage paths (gs://...) that Vertex sometimes leaks into grounding output. */
function stripStoragePaths(text: string): string {
    return text
        .replace(/gs:\/\/[^\s,\)\]]+/g, '')   // remove gs://bucket/path tokens
        .replace(/[ \t]{2,}/g, ' ')             // collapse extra spaces
        .trim();
}

function buildVertexBody(
    question: string,
    systemInstruction: string,
    history: ChatTurn[] = []
): Record<string, unknown> {
    const tools: unknown[] = [];

    if (RAG_CORPUS) {
        tools.push({
            retrieval: {
                vertexRagStore: {
                    ragResources: [{ ragCorpus: RAG_CORPUS }],
                    similarityTopK: 10,
                },
            },
        });
        logger.info(`Vertex RAG corpus attached: ${RAG_CORPUS.split('/').pop()}`, 'google-genai');
    }

    // Build multi-turn contents: prior turns + current question
    const historyContents = history.map(turn => ({
        role: turn.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: turn.content }],
    }));

    return {
        contents: [
            ...historyContents,
            { role: 'user', parts: [{ text: question }] },
        ],
        systemInstruction: {
            role: 'system',
            parts: [{ text: systemInstruction }],
        },
        ...(tools.length > 0 && { tools }),
        generationConfig: {
            temperature: 0.4,
            topP: 0.95,
            maxOutputTokens: 8192,
        },
        safetySettings: [
            { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'OFF' },
            { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'OFF' },
            { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'OFF' },
            { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'OFF' },
        ],
    };
}

/** Call the Vertex AI generateContent REST endpoint and return the full response text. */
async function callVertexRest(
    question: string,
    systemInstruction: string,
    history: ChatTurn[] = []
): Promise<string | null> {
    const token = await getVertexAccessToken();
    const url = `${VERTEX_BASE}:generateContent`;

    const res = await fetch(url, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(buildVertexBody(question, systemInstruction, history)),
    });

    if (!res.ok) {
        const errText = await res.text().catch(() => res.statusText);
        logger.warn(`Vertex AI REST error ${res.status}: ${errText.slice(0, 300)}`, 'google-genai');
        return null;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = await res.json();

    // Extract text from all parts across all candidates
    const rawText: string = (data.candidates ?? [])
        .flatMap((c: { content?: { parts?: { text?: string }[] } }) =>
            (c.content?.parts ?? []).map((p: { text?: string }) => p.text ?? '')
        )
        .join('');

    if (!rawText.trim()) {
        logger.warn('Vertex AI returned an empty response body.', 'google-genai');
        return null;
    }

    // Log grounding sources (debug only — never expose gs:// paths to users)
    const chunks: { retrievedContext?: { uri?: string; title?: string } }[] =
        data.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];
    if (chunks.length > 0) {
        logger.info(
            `Vertex grounding: ${chunks.length} source chunk(s) — e.g. "${chunks[0].retrievedContext?.title ?? chunks[0].retrievedContext?.uri ?? 'n/a'}"`,
            'google-genai'
        );
    }

    // Strip any leaked GCS storage paths before returning
    return stripStoragePaths(rawText);
}

// ─── AI Studio fallback (API key, no RAG corpus) ─────────────────────────────

async function callAiStudioRest(
    question: string,
    systemInstruction: string,
    history: ChatTurn[] = []
): Promise<string | null> {
    const apiKey = (process.env.GEMINI_API_KEY ?? process.env.GOOGLE_CLOUD_API_KEY)?.trim();
    if (!apiKey) return null;

    const url = `${AISTUDIO_BASE}/${MODEL}:generateContent?key=${apiKey}`;

    const historyContents = history.map(turn => ({
        role: turn.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: turn.content }],
    }));

    const body = {
        contents: [
            ...historyContents,
            { role: 'user', parts: [{ text: question }] },
        ],
        systemInstruction: { role: 'system', parts: [{ text: systemInstruction }] },
        generationConfig: { temperature: 0.4, maxOutputTokens: 8192 },
    };

    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });

    if (!res.ok) {
        const errText = await res.text().catch(() => res.statusText);
        logger.warn(`AI Studio REST error ${res.status}: ${errText.slice(0, 300)}`, 'google-genai');
        return null;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = await res.json();
    const rawText: string = (data.candidates ?? [])
        .flatMap((c: { content?: { parts?: { text?: string }[] } }) =>
            (c.content?.parts ?? []).map((p: { text?: string }) => p.text ?? '')
        )
        .join('');

    return stripStoragePaths(rawText) || null;
}

// ─── Public API (unchanged signature — route.ts imports this) ─────────────────

const DEFAULT_SYSTEM =
    'You are a highly precise digital assistant for Kattakada constituency, Kerala. ' +
    'STRICT RULE: Answer ONLY using information from the provided documents. ' +
    'DO NOT use any external knowledge about Kerala, India, or general facts. ' +
    'If the exact answer is not found in the provided documents, you MUST say: "ക്ഷമിക്കണം, ഈ വിഷയത്തിൽ ഇപ്പോൾ നൽകിയിട്ടുള്ള രേഖകളിൽ ഉത്തരമില്ല. കൂടുതൽ വിവരങ്ങൾക്ക്: https://kattakadalac.com/" ' +
    'Be extremely careful with dates and names. Respond exclusively in Malayalam.';

/**
 * Call Vertex AI Gemini with RAG corpus grounding (primary) or AI Studio (fallback).
 * Returns the full response text, or null on error / not configured.
 *
 * The returned text is fed into combineAndUniformise() → enforceMalayalam() in route.ts.
 * This function's signature is intentionally identical to the previous version.
 */
export async function streamVertexGeminiWithGrounding(
    question: string,
    systemInstruction?: string,
    history: ChatTurn[] = []
): Promise<string | null> {
    const sysInstruction = systemInstruction
        ? `${DEFAULT_SYSTEM} ${systemInstruction}`
        : DEFAULT_SYSTEM;

    // Primary: Vertex AI with service account + RAG corpus
    if (PROJECT && LOCATION) {
        try {
            logger.info(`Calling Vertex AI (${MODEL}) via REST... (history turns: ${history.length})`, 'google-genai');
            const result = await callVertexRest(question, sysInstruction, history);
            if (result) {
                logger.info(`Vertex AI responded (${result.length} chars)`, 'google-genai');
                return result;
            }
            logger.warn('Vertex AI returned null — trying AI Studio fallback', 'google-genai');
        } catch (err) {
            logger.warn(
                `Vertex AI call failed: ${err instanceof Error ? err.message : String(err)} — trying AI Studio fallback`,
                'google-genai'
            );
        }
    }

    // Fallback: AI Studio / public Gemini API (no RAG corpus grounding)
    const apiKey = (process.env.GEMINI_API_KEY ?? process.env.GOOGLE_CLOUD_API_KEY)?.trim();
    if (apiKey) {
        try {
            logger.info(`Falling back to AI Studio / public Gemini API (${MODEL})`, 'google-genai');
            return await callAiStudioRest(question, sysInstruction, history);
        } catch (err) {
            logger.warn(
                `AI Studio call failed: ${err instanceof Error ? err.message : String(err)}`,
                'google-genai'
            );
        }
    }

    logger.warn(
        'No Gemini backend available. Set GOOGLE_CLOUD_PROJECT + GOOGLE_CLOUD_LOCATION + GOOGLE_APPLICATION_CREDENTIALS_JSON for Vertex AI RAG.',
        'google-genai'
    );
    return null;
}

/** @deprecated Kept for backward compatibility — use streamVertexGeminiWithGrounding. */
export const streamGeminiWithGoogleSearch = streamVertexGeminiWithGrounding;

/** @deprecated Kept for backward compatibility. */
export function getGoogleGenAIClient(): null {
    return null;
}
