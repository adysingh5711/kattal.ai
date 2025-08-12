import { NextRequest, NextResponse } from "next/server";
import { runExtraction } from "@/lib/extraction-stage";
import { runAnalysis } from "@/lib/analysis-stage";
import { getExtractionValidator, ContextChunk } from "@/lib/schema";
import { getPinecone } from "@/lib/pinecone-client";
import { getVectorStore } from "@/lib/vector-store";

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();

        // --------------------------
        // STEP 1: Resolve question & context
        // --------------------------
        let question: string | undefined = body.question;
        let contextChunks: ContextChunk[] | undefined = body.contextChunks;

        if (!question && Array.isArray(body.messages)) {
            const lastUser = [...body.messages]
                .reverse()
                .find((m: any) => m?.role === "user" && typeof m?.content === "string");
            question = lastUser?.content?.trim();

            if (question && !contextChunks) {
                const pinecone = await getPinecone();
                const vectorStore = await getVectorStore(pinecone);
                const k = typeof body.k === "number" && body.k > 0 ? body.k : 6;
                const docs = await vectorStore.similaritySearch(question, k);

                contextChunks = docs.map((d: any, i: number) => {
                    const meta = d.metadata || {};
                    const page = meta.page ?? meta.pageNumber ?? meta.loc?.pageNumber ?? i;
                    const lang = meta.lang ?? null;
                    return {
                        page: Number(page),
                        text: String(d.pageContent || ""),
                        char_offset: 0,
                        lang,
                        table_json: null
                    } as ContextChunk;
                });
            }
        }

        if (!question || !Array.isArray(contextChunks)) {
            return NextResponse.json(
                { error: "Missing question or contextChunks" },
                { status: 400 }
            );
        }

        // --------------------------
        // STEP 2: Extraction parameters
        // --------------------------
        const required_fields = body.required_fields ?? [];
        const synonyms = body.synonyms ?? [];
        const mode = body.mode ?? "source_only";
        const response_mode = body.response_mode ?? "plain"; // "plain" | "json"
        const allow_calculations = !!body.allow_calculations;
        const assumptions = body.assumptions ?? {};
        const analysis_requests = body.analysis_requests ?? [];
        const answer_language = body.answer_language ?? undefined;

        // --------------------------
        // STEP 3: Stage A - Extraction
        // --------------------------
        const extraction = await runExtraction({
            question,
            contextChunks,
            required_fields,
            synonyms,
            mode
        });

        const validate = getExtractionValidator();
        if (!validate(extraction)) {
            return NextResponse.json(
                { error: "Extraction failed schema validation", details: validate.errors },
                { status: 500 }
            );
        }

        if (response_mode === "json") {
            return NextResponse.json({ extraction }, { status: 200 });
        }

        // --------------------------
        // STEP 4: Stage B - Analysis (optional)
        // --------------------------
        let analysisOutput = {
            answer_markdown: extraction.answer_markdown,
            technical_block: extraction.technical_block ?? ""
        };

        const shouldRunAnalysis =
            allow_calculations || (Array.isArray(analysis_requests) && analysis_requests.length > 0);

        if (shouldRunAnalysis) {
            analysisOutput = await runAnalysis({
                extraction,
                analysis_requests,
                assumptions,
                answer_language,
                allow_calculations
            });
        }

        // --------------------------
        // STEP 5: Response
        // --------------------------
        return NextResponse.json(
            {
                text: analysisOutput.answer_markdown,
                extraction,
                answer_markdown: analysisOutput.answer_markdown,
                technical_block: analysisOutput.technical_block
            },
            { status: 200 }
        );

    } catch (e) {
        console.error("Pipeline error:", e);
        return NextResponse.json(
            { error: "Internal server error", details: (e as Error).message },
            { status: 500 }
        );
    }
}