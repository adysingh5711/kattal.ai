import { ContextChunk, ExtractionResult, getExtractionValidator } from "./schema";
import { extractTablesForChunk } from "./table-extract";
import { callLLM, ChatMessage } from "./llm";
import { env } from "./env";

type ExtractionRequest = {
    question: string;
    contextChunks: ContextChunk[];
    required_fields?: string[];
    synonyms?: string[];
    mode?: "source_only" | "external_fallback";
};

function safeJSONStringify(v: any) {
    return JSON.stringify(v, null, 2);
}

function normalizeExtractionShape(
    output: any,
    context: { question: string; synonyms: string[]; augmentedChunks: ContextChunk[] }
) {
    const normalized: any = { ...output };

    if (typeof normalized.language !== "string") {
        normalized.language = String(normalized.language ?? "");
    }
    if (typeof normalized.question !== "string") {
        normalized.question = context.question;
    }

    if (!Array.isArray(normalized.extractions)) {
        normalized.extractions = [];
    }

    if (!normalized.provenance || typeof normalized.provenance !== "object" || Array.isArray(normalized.provenance) || normalized.provenance === null) {
        const pages = Array.from(new Set(context.augmentedChunks.map(c => c.page))) as number[];
        normalized.provenance = {
            pages_searched: pages,
            chunks_used: context.augmentedChunks.length,
            synonyms_checked: context.synonyms
        };
    } else {
        // Ensure the existing provenance object has the required fields
        if (!Array.isArray(normalized.provenance.pages_searched)) {
            const pages = Array.from(new Set(context.augmentedChunks.map(c => c.page))) as number[];
            normalized.provenance.pages_searched = pages;
        }
        if (typeof normalized.provenance.chunks_used !== "number") {
            normalized.provenance.chunks_used = context.augmentedChunks.length;
        }
        if (!Array.isArray(normalized.provenance.synonyms_checked)) {
            normalized.provenance.synonyms_checked = context.synonyms;
        }
    }

    if (typeof normalized.answer_markdown !== "string") {
        normalized.answer_markdown = "";
    }

    return normalized;
}

function parseFirstJSONObject(s: string): any {
    const first = s.indexOf("{");
    const last = s.lastIndexOf("}");
    if (first === -1 || last === -1 || last <= first) {
        throw new Error("No JSON object found in model output");
    }

    const jsonStr = s.slice(first, last + 1);

    try {
        return JSON.parse(jsonStr);
    } catch (error) {
        // Try to fix common JSON issues
        let fixedJson = jsonStr;

        // Fix trailing commas in arrays and objects
        fixedJson = fixedJson.replace(/,(\s*[}\]])/g, '$1');

        // Fix unescaped quotes in strings (basic fix)
        fixedJson = fixedJson.replace(/([^\\])"([^",:}\]]*)"([^,:}\]]*)/g, '$1\\"$2\\"$3');

        // Try parsing the fixed JSON
        try {
            return JSON.parse(fixedJson);
        } catch (secondError) {
            // As a last resort, return a minimal valid structure
            return {
                language: "en",
                question: "parsing_failed",
                extractions: [],
                answer_markdown: "I apologize, but I encountered an error processing your request. Please try rephrasing your question.",
                provenance: {
                    pages_searched: [],
                    chunks_used: 0,
                    synonyms_checked: []
                }
            };
        }
    }
}

export async function runExtraction(req: ExtractionRequest): Promise<ExtractionResult> {
    const augmentedChunks = req.contextChunks.map(c => {
        const tableJson = extractTablesForChunk(c);
        return { ...c, table_json: tableJson ?? c.table_json ?? null };
    });

    const system = `You are a professional document assistant. Follow these rules exactly:

1) MODES:
- "mode" in the user payload controls behavior:
  - "source_only" (default): use ONLY the provided contextChunks.
  - "external_fallback": first try contextChunks; if insufficient, you MAY use general knowledge but MUST mark mode_used: "external_fallback".

2) OUTPUT ENFORCEMENT:
- Return exactly one valid JSON object and nothing else (no extra markdown or chatter).
- The JSON MUST follow the schema below exactly.

3) JSON SCHEMA (must match exactly):
{
  "language": "<language/script same as the question>",
  "question": "<the user's question, verbatim>",
  "extractions": [],
  "answer_markdown": "<concise, user-facing answer in Markdown, matching the exact language & script of the question>",
  "provenance": {
    "pages_searched": [<ints>],
    "chunks_used": <int>,
    "synonyms_checked": ["<string>", "..."]
  }
}

4) REQUIRED BEHAVIOR:
- answer_markdown is the user-facing answer. It must:
  * use only provided context (unless mode_used == "external_fallback"),
  * if insufficient information, contain: "**I do not have enough information in the provided context to answer that.**"
  * when including information, reference page numbers inline.
  * be concise but informative.

5) LANGUAGE RULES:
- Match the exact language and script of the question.

6) OPERATIONAL RULES:
- Use synonyms list for finding matches.
- Provide char offsets relative to each chunk's text field.`;

    const userPayload = {
        question: req.question,
        contextChunks: augmentedChunks,
        required_fields: req.required_fields ?? [],
        synonyms: req.synonyms ?? [],
        mode: req.mode ?? "source_only"
    };

    const user = `EXTRACTION_REQUEST:\n${safeJSONStringify(userPayload)}\n\nReturn the JSON strictly following the schema. Make sure to provide a helpful answer in the answer_markdown field based on the provided context chunks.`;

    const messages: ChatMessage[] = [
        { role: "system", content: system },
        { role: "user", content: user }
    ];

    const raw = await callLLM(messages, { temperature: 0, max_tokens: 3000, model: env.LLM_MODEL });

    const attempt = (output: string) => {
        const parsed = parseFirstJSONObject(output);

        const normalized = normalizeExtractionShape(parsed, {
            question: req.question,
            synonyms: userPayload.synonyms,
            augmentedChunks
        });

        const validate = getExtractionValidator();
        const valid = validate(normalized);
        if (!valid) {
            throw new Error(`Extraction JSON validation failed: ${JSON.stringify(validate.errors, null, 2)}`);
        }
        return normalized as ExtractionResult;
    };

    try {
        return attempt(raw);
    } catch (firstError) {
        // Retry with more explicit JSON formatting instructions
        const retryUser = user + `\n\nIMPORTANT: Return exactly one valid JSON object conforming to the schema. Ensure proper JSON syntax with no trailing commas.`;
        const retryRaw = await callLLM(
            [
                { role: "system", content: system },
                { role: "user", content: retryUser }
            ],
            { temperature: 0, max_tokens: 3000, model: env.LLM_MODEL }
        );
        return attempt(retryRaw);
    }
}
