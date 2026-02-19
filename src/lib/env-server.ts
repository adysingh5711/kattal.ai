/**
 * Server-only env helpers. Uses Node APIs (fs, path, os) — never import this from client code.
 * Vertex on Vercel: set GOOGLE_APPLICATION_CREDENTIALS_JSON; this writes it to a temp file at runtime.
 */
import 'server-only';
import fs from 'fs';
import os from 'os';
import path from 'path';

/**
 * If GOOGLE_APPLICATION_CREDENTIALS_JSON is set (e.g. on Vercel), write it to a temp file
 * and set GOOGLE_APPLICATION_CREDENTIALS so the Google auth library can read it. Run once per process.
 */
export function ensureGoogleApplicationCredentials(): void {
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS) return;
    const json = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON?.trim();
    if (!json) return;
    try {
        const tmpPath = path.join(os.tmpdir(), `gcp-creds-${process.pid}.json`);
        fs.writeFileSync(tmpPath, json, 'utf8');
        process.env.GOOGLE_APPLICATION_CREDENTIALS = tmpPath;
    } catch (err) {
        console.warn(
            'Failed to write GOOGLE_APPLICATION_CREDENTIALS from GOOGLE_APPLICATION_CREDENTIALS_JSON:',
            err instanceof Error ? err.message : String(err)
        );
    }
}
