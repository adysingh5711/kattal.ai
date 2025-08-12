// src/lib/schema.ts
import Ajv, { ValidateFunction } from "ajv";

export interface ContextChunk {
    page: number;
    text: string;
    char_offset: number;
    lang?: string | null;
    table_json?: any | null;
}

export interface TableJSON {
    detected: boolean;
    header: string[];
    rows: Record<string, string>[];
    raw?: string[][];
}

// Stage A output types
export interface Candidate {
    value: string;
    page: number | null;
    char_start: number | null;
    char_end: number | null;
    confidence: "high" | "medium" | "low";
    source_snippet: string | null;
}

export interface ExtractionField {
    field: string;
    value: string | null;
    candidates: Candidate[];
    final_confidence: "high" | "medium" | "low";
    reason_if_null: string | null;
    missing_data_hints?: string;
}

export interface ExtractionResult {
    language: string;
    question: string;
    mode_requested?: string;
    mode_used?: string;
    extractions: ExtractionField[];
    answer_markdown: string;
    technical_block?: string;
    provenance: {
        pages_searched: number[];
        chunks_used: number;
        synonyms_checked?: string[];
    };
    suggested_queries?: string[];
    notes?: string;
}

const ajv = new Ajv({ allErrors: true });

export const extractionSchema = {
    type: "object",
    properties: {
        language: { type: "string" },
        question: { type: "string" },
        extractions: {
            type: "array",
            items: {
                type: "object",
                properties: {
                    field: { type: "string" },
                    value: { anyOf: [{ type: "string" }, { type: "null" }] },
                    candidates: {
                        type: "array",
                        items: {
                            type: "object",
                            properties: {
                                value: { type: "string" },
                                page: { anyOf: [{ type: "number" }, { type: "null" }] },
                                char_start: { anyOf: [{ type: "number" }, { type: "null" }] },
                                char_end: { anyOf: [{ type: "number" }, { type: "null" }] },
                                confidence: { enum: ["high", "medium", "low"] },
                                source_snippet: { anyOf: [{ type: "string" }, { type: "null" }] }
                            },
                            required: ["value", "page", "char_start", "char_end", "confidence", "source_snippet"]
                        }
                    },
                    final_confidence: { enum: ["high", "medium", "low"] },
                    reason_if_null: { anyOf: [{ type: "string" }, { type: "null" }] }
                },
                required: ["field", "value", "candidates", "final_confidence", "reason_if_null"]
            }
        },
        answer_markdown: { type: "string" },
        provenance: {
            type: "object",
            properties: {
                pages_searched: { type: "array", items: { type: "number" } },
                chunks_used: { type: "number" },
                synonyms_checked: { type: "array", items: { type: "string" } }
            },
            required: ["pages_searched", "chunks_used"],
            additionalProperties: false
        }
    },
    required: ["language", "question", "extractions", "answer_markdown", "provenance"]
};

export const getExtractionValidator = (): ValidateFunction => {
    return ajv.compile(extractionSchema);
};
