import { readFileSync } from 'fs';
import { parse } from 'dotenv';

const raw = readFileSync('.env', 'utf8');
const vars = parse(raw);

const json = vars['GOOGLE_APPLICATION_CREDENTIALS_JSON'];
if (!json || json.trim().length === 0) {
    console.error('❌ GOOGLE_APPLICATION_CREDENTIALS_JSON is EMPTY or missing in .env');
    process.exit(1);
}
try {
    const parsed = JSON.parse(json);
    console.log('✅ GOOGLE_APPLICATION_CREDENTIALS_JSON is valid JSON');
    console.log('   type         :', parsed.type);
    console.log('   project_id   :', parsed.project_id);
    console.log('   client_email :', parsed.client_email);
} catch (e) {
    console.error('❌ NOT valid JSON:', e.message);
    console.error('   First 80 chars:', json.slice(0, 80));
    process.exit(1);
}

const project = vars['GOOGLE_CLOUD_PROJECT'] || '';
const location = vars['GOOGLE_CLOUD_LOCATION'] || '';
const corpus = vars['VERTEX_RAG_CORPUS'] || '';
const model = vars['VERTEX_MODEL_ID'] || vars['GEMINI_GROUNDING_MODEL'] || '';

console.log('');
console.log('Vertex AI config:');
console.log('   GOOGLE_CLOUD_PROJECT  :', project || '❌ NOT SET');
console.log('   GOOGLE_CLOUD_LOCATION :', location || '❌ NOT SET');
console.log('   VERTEX_RAG_CORPUS     :', corpus ? corpus.slice(-30) : '⚠️  NOT SET (no RAG grounding)');
console.log('   Model                 :', model || '❌ NOT SET');
