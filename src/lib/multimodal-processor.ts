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

    // Detect tables by looking for common table patterns
    const hasTabularData = /\|.*\|/.test(textContent) || // Pipe-separated
        /\t.*\t/.test(textContent) || // Tab-separated
        /^\s*\d+\.\s+.*\s+\d+/.test(textContent) || // Numbered lists with values
        lower.includes('table') ||
        /\s{3,}/.test(textContent); // Multiple spaces (column alignment)

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
