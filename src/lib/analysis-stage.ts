import { ExtractionResult } from "./schema";
import { callLLM, ChatMessage } from "./llm"; // unified provider wrapper
import { env } from "./env";

type AnalysisRequest = {
    extraction: ExtractionResult;
    analysis_requests?: string[];
    assumptions?: Record<string, any>;
    answer_language?: string;
    allow_calculations?: boolean;
};

/**
 * Try to parse numeric value from a field (e.g., "12.5 ha", "1,234").
 */
function parseNumeric(value: any): number | null {
    if (typeof value !== "string" && typeof value !== "number") return null;
    const str = String(value).replace(/,/g, "");
    const num = Number(str.match(/[\d\.]+/)?.[0] ?? NaN);
    return Number.isFinite(num) ? num : null;
}

/**
 * Find a field in the extraction by name or synonym.
 */
function findField(extr: ExtractionResult, fieldNames: string[]) {
    return extr.extractions.find(e => fieldNames.includes(e.field));
}

export async function runAnalysis(req: AnalysisRequest) {
    const extr = req.extraction;
    const assumptions = req.assumptions ?? {};
    const calcResults: Record<string, any> = {};

    // Auto-detect numeric fields for basic calculations
    if (req.allow_calculations) {
        // Example: if both area and yield exist, compute production
        const areaField = findField(extr, ["available_hectares", "available_area"]);
        const yieldField = findField(extr, ["yield_t_per_ha", "yield"]);

        const areaValue = areaField ? parseNumeric(areaField.value) : null;
        const yieldValue =
            parseNumeric(assumptions["yield_t_per_ha"]) ??
            parseNumeric(assumptions["default_yield_t_per_ha"]) ??
            (yieldField ? parseNumeric(yieldField.value) : null);

        if (areaValue !== null) calcResults["area_ha"] = areaValue;
        if (yieldValue !== null) calcResults["yield_t_per_ha"] = yieldValue;

        if (areaValue !== null && yieldValue !== null) {
            calcResults["production_t"] = Number((areaValue * yieldValue).toFixed(2));
        }
    }

    // Build deterministic prompt
    const system = `You are a concise analysis assistant.
Use ONLY the provided extraction JSON and local calculation results.
Do not use outside knowledge except for basic math on provided values.
Output a plain-language answer followed by a
'--- Technical details ---' section with assumptions, calc steps, provenance, and confidence.`;

    const userParts: string[] = [];
    userParts.push(`Answer language: ${req.answer_language ?? "en"}`);
    userParts.push(`Analysis requests: ${(req.analysis_requests ?? []).join(", ")}`);
    userParts.push(
        `Extraction JSON:\n${JSON.stringify(
            {
                question: extr.question,
                extractions: extr.extractions,
                provenance: extr.provenance
            },
            null,
            2
        )}`
    );
    userParts.push(`Local calculation results:\n${JSON.stringify(calcResults, null, 2)}`);
    userParts.push(`Assumptions:\n${JSON.stringify(assumptions, null, 2)}`);

    const messages: ChatMessage[] = [
        { role: "system", content: system },
        { role: "user", content: userParts.join("\n\n") }
    ];

    const llmOutput = await callLLM(messages, { temperature: 0, max_tokens: 800, model: env.LLM_MODEL });

    const [plain, ...rest] = llmOutput.split("\n--- Technical details ---");
    return {
        answer_markdown: plain.trim(),
        technical_block: `--- Technical details ---${rest.join("\n--- Technical details ---")}\n\n[local_calc_results]: ${JSON.stringify(calcResults)}`
    };
}
