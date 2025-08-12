import type { ContextChunk, TableJSON } from "@/lib/schema";

/**
 * Very small heuristic table parser:
 * - If chunk.table_json exists, return it.
 * - Else, look for rows containing '|' or rows where multiple spaces separate columns.
 * - Returns null if nothing table-like is found.
 */

function parseAsciiTable(lines: string[]): string[][] | null {
    // Look for pipe-separated or multi-space separated rows
    const pipeRows = lines.filter(l => l.includes("|") && l.trim().length > 0);
    if (pipeRows.length >= 2) {
        // parse pipe rows
        return pipeRows.map(r =>
            r
                .split("|")
                .map(c => c.trim())
                .filter(() => true)
        );
    }

    // Try multi-space heuristic: find lines with 2+ consecutive spaces
    const spaceRows = lines.filter(l => /\s{2,}/.test(l) && l.trim().length > 0);
    if (spaceRows.length >= 2) {
        return spaceRows.map(r => r.trim().split(/\s{2,}/).map(c => c.trim()));
    }

    return null;
}

export function extractTablesForChunk(chunk: ContextChunk): TableJSON | null {
    // If loader already produced structured table_json, return it
    if (chunk.table_json && Object.keys(chunk.table_json).length > 0) {
        return chunk.table_json as TableJSON;
    }

    const text = chunk.text || "";
    const lines = text.split(/\r?\n/).map((l: string) => l.trim());
    const candidate = parseAsciiTable(lines);
    if (!candidate) return null;

    // Convert to simple JSON structure
    const header = candidate[0];
    const rows = candidate.slice(1);
    const tableRows = rows.map(r => {
        const rowObj: Record<string, string> = {};
        for (let i = 0; i < header.length; i++) {
            rowObj[header[i] || `col_${i}`] = r[i] ?? "";
        }
        return rowObj;
    });

    const tableJson: TableJSON = {
        detected: true,
        header,
        rows: tableRows,
        raw: candidate
    };
    return tableJson;
}
