import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { Document } from "langchain/document";
import { ChatOpenAI } from "@langchain/openai";
import { env } from "./env";
import fs from 'fs';
import path from 'path';
import * as mammoth from 'mammoth';

// Vision model for image/chart analysis
const visionModel = new ChatOpenAI({
    modelName: env.LLM_MODEL,
    temperature: 0.1,
    openAIApiKey: env.OPENAI_API_KEY,
});

interface VisualAnalysis {
    visualDescription: string;
    hasVisuals: boolean;
    hasTables: boolean;
    hasCharts: boolean;
    contentTypes: string[];
}

export async function processDocumentMultimodal(filePath: string): Promise<Document[]> {
    const ext = path.extname(filePath).toLowerCase();

    if (ext === '.pdf') {
        return await processPDFMultimodal(filePath);
    } else if (ext === '.docx' || ext === '.doc') {
        return await processWordMultimodal(filePath);
    }

    throw new Error(`Unsupported file type: ${ext}`);
}

async function processPDFMultimodal(filePath: string): Promise<Document[]> {
    const docs: Document[] = [];

    // 1. Extract text using standard PDF loader
    const textLoader = new PDFLoader(filePath);
    const textDocs = await textLoader.load();

    console.log(`Processing ${textDocs.length} pages from PDF...`);

    // 3. Process each page with text-only analysis (visual analysis disabled due to EPIPE issues)
    for (let i = 0; i < textDocs.length; i++) {
        const pageNum = i + 1;
        const textContent = textDocs[i].pageContent;

        // Simple text-based analysis to detect tables and structure
        const visualAnalysis = analyzeTextStructure(textContent);

        // Create enhanced document with all content types
        const enhancedContent = createEnhancedContent(textContent, visualAnalysis);

        docs.push(new Document({
            pageContent: enhancedContent,
            metadata: {
                ...textDocs[i].metadata,
                pageNumber: pageNum,
                hasVisuals: visualAnalysis.hasVisuals,
                hasTables: visualAnalysis.hasTables,
                hasCharts: visualAnalysis.hasCharts,
                contentTypes: visualAnalysis.contentTypes
            }
        }));

        console.log(`Processed page ${pageNum}/${textDocs.length}`);
    }

    return docs;
}

async function processWordMultimodal(filePath: string): Promise<Document[]> {
    const buffer = fs.readFileSync(filePath);

    // Extract text content
    const textResult = await mammoth.extractRawText({ buffer });
    const textContent = textResult.value || '';

    // Extract images and convert to base64 for analysis
    const imageResult = await mammoth.convertToHtml(
        { buffer },
        {
            convertImage: mammoth.images.imgElement(function (image) {
                return image.read("base64").then(function (imageBuffer) {
                    return {
                        src: "data:" + image.contentType + ";base64," + imageBuffer
                    };
                });
            })
        }
    );

    // Analyze document structure
    const visualAnalysis = await analyzeWordDocument(imageResult.value, textContent);

    const enhancedContent = createEnhancedContent(textContent, visualAnalysis);

    return [new Document({
        pageContent: enhancedContent,
        metadata: {
            source: filePath,
            hasVisuals: visualAnalysis.hasVisuals,
            hasTables: visualAnalysis.hasTables,
            hasCharts: visualAnalysis.hasCharts,
            contentTypes: visualAnalysis.contentTypes
        }
    })];
}



async function analyzeWordDocument(htmlContent: string, textContent: string): Promise<VisualAnalysis> {
    // Simple analysis for Word docs - can be enhanced with vision models
    const hasImages = htmlContent.includes('<img');
    const hasTables = textContent.includes('\t') || htmlContent.includes('<table');

    return {
        visualDescription: hasImages ? 'Document contains embedded images' : '',
        hasVisuals: hasImages,
        hasTables: hasTables,
        hasCharts: false, // Would need more sophisticated detection
        contentTypes: ['text', ...(hasImages ? ['images'] : []), ...(hasTables ? ['tables'] : [])]
    };
}

function createEnhancedContent(textContent: string, visualAnalysis: VisualAnalysis): string {
    const sections = [textContent];

    if (visualAnalysis.visualDescription) {
        sections.push(`VISUAL ANALYSIS:\n${visualAnalysis.visualDescription}`);
    }

    return sections.join('\n\n---\n\n');
}

function extractContentTypes(analysis: string): string[] {
    const types = ['text'];
    const lower = analysis.toLowerCase();

    if (lower.includes('table')) types.push('tables');
    if (lower.includes('chart') || lower.includes('graph')) types.push('charts');
    if (lower.includes('image') || lower.includes('diagram')) types.push('images');

    return types;
}

function analyzeTextStructure(textContent: string): VisualAnalysis {
    const lower = textContent.toLowerCase();

    // More sophisticated table detection
    const hasTabularData = detectTablePatterns(textContent);

    // Detect charts/graphs by keywords
    const hasCharts = lower.includes('chart') ||
        lower.includes('graph') ||
        lower.includes('figure') ||
        lower.includes('diagram');

    // Detect images by keywords
    const hasImages = lower.includes('image') ||
        lower.includes('photo') ||
        lower.includes('picture');

    const contentTypes = ['text'];
    if (hasTabularData) contentTypes.push('tables');
    if (hasCharts) contentTypes.push('charts');
    if (hasImages) contentTypes.push('images');

    return {
        visualDescription: hasTabularData ? 'Contains tabular data' : '',
        hasVisuals: hasImages,
        hasTables: hasTabularData,
        hasCharts: hasCharts,
        contentTypes: contentTypes
    };
}

function detectTablePatterns(textContent: string): boolean {
    const lower = textContent.toLowerCase();
    const lines = textContent.split('\n').filter(line => line.trim().length > 0);

    // 1. Explicit table keywords (strong indicator)
    if (lower.includes('table') || lower.includes('tabular') || lower.includes('schedule')) {
        return true;
    }

    // 2. Pipe-separated tables (Markdown style)
    if (/\|.*\|.*\|/.test(textContent)) {
        return true;
    }

    // 3. Tab-separated values (CSV/TSV style)
    let tabSeparatedLines = 0;
    for (const line of lines.slice(0, 5)) { // Check first 5 lines
        if (line.split('\t').length >= 2) { // At least 2 columns
            tabSeparatedLines++;
        }
    }
    if (tabSeparatedLines >= 2) {
        return true;
    }

    // 4. Space-aligned columns (common in PDFs)
    // Look for consistent spacing patterns
    const spacePatterns = lines.map(line => {
        const spaces = line.match(/\s{2,}/g);
        return spaces ? spaces.length : 0;
    });

    // Check if multiple lines have similar space patterns (indicating columns)
    let consistentSpacingLines = 0;
    const avgSpaces = spacePatterns.reduce((a, b) => a + b, 0) / spacePatterns.length;
    for (const patternCount of spacePatterns) {
        if (Math.abs(patternCount - avgSpaces) <= 1 && patternCount >= 2) {
            consistentSpacingLines++;
        }
    }
    if (consistentSpacingLines >= 3 && lines.length >= 5) {
        return true;
    }

    // 5. Numbered or bulleted lists that might be tabular data
    const numberedPattern = /^\s*\d+\.\s+.*?\s{2,}/gm;
    const numberedMatches = textContent.match(numberedPattern);
    if (numberedMatches && numberedMatches.length >= 3) {
        // Check if the lines after numbers have consistent structure
        const structuredLines = numberedMatches.filter(line => {
            const parts = line.trim().split(/\s{2,}/);
            return parts.length >= 2; // At least number + content
        });
        if (structuredLines.length >= 3) {
            return true;
        }
    }

    // 6. Look for data patterns that suggest tabular structure
    // More flexible pattern for structured data
    const dataPattern = /^[A-Za-z][A-Za-z\s]{1,}:?\s*[\w\s.,$-]+$/gm;
    let structuredLines = 0;
    for (const line of lines.slice(0, 20)) { // Check first 20 lines
        if (dataPattern.test(line.trim())) {
            structuredLines++;
        }
    }
    if (structuredLines >= 4) { // At least 4 structured lines
        return true;
    }

    // 7. Check for repeating patterns that suggest columns
    if (lines.length >= 3) {
        // Look for lines with similar structure
        const lineStructures = lines.slice(0, 10).map(line => {
            const words = line.trim().split(/\s+/);
            return words.length;
        });

        // Check if most lines have similar word counts (suggesting tabular data)
        const avgWords = lineStructures.reduce((a, b) => a + b, 0) / lineStructures.length;
        let similarStructureLines = 0;
        for (const wordCount of lineStructures) {
            if (Math.abs(wordCount - avgWords) <= 1) {
                similarStructureLines++;
            }
        }
        if (similarStructureLines >= 7 && avgWords >= 3) {
            return true;
        }
    }

    // 8. Check for financial or numeric data patterns common in tables
    const financialPattern = /[\d,]+\.?\d*\s*%\s*[\d,]+\.?\d*\s*%/g;
    if (financialPattern.test(textContent)) {
        return true;
    }

    return false;
}

// Helper to normalize ChatOpenAI content field to plain string
function normalizeModelContentToText(content: unknown): string {
    if (typeof content === 'string') return content;
    if (Array.isArray(content)) {
        // LangChain may return an array of content parts
        return content
            .map((part: any) => (typeof part === 'string' ? part : part?.text || ''))
            .join('\n');
    }
    if (content && typeof content === 'object') {
        const maybe = (content as any).text || (content as any).content || '';
        return typeof maybe === 'string' ? maybe : JSON.stringify(content);
    }
    return '';
}
