import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { Document } from "langchain/document";
import { ChatOpenAI } from "@langchain/openai";
import { env } from "./env";
import fs from 'fs';
import path from 'path';
import * as mammoth from 'mammoth';
import pdf2pic from "pdf2pic";

// Vision model for image/chart analysis
const visionModel = new ChatOpenAI({
    modelName: "gpt-4o-mini",
    temperature: 0.1,
    openAIApiKey: env.OPENAI_API_KEY,
});

interface ProcessedContent {
    textContent: string;
    tables: string[];
    images: string[];
    charts: string[];
    metadata: Record<string, any>;
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

    // 2. Convert PDF pages to images for visual analysis
    const convert = pdf2pic.fromPath(filePath, {
        density: 150,
        saveFilename: "page",
        savePath: "./temp",
        format: "png",
        width: 1024,
        height: 1448
    });

    // 3. Process each page with multimodal analysis
    for (let i = 0; i < textDocs.length; i++) {
        const pageNum = i + 1;
        const textContent = textDocs[i].pageContent;

        try {
            // Convert page to image
            const pageImage = await convert(pageNum);
            const imagePath = pageImage.path;

            // Analyze image with GPT-4o-mini vision
            const visualAnalysis = await analyzePageVisually(imagePath, textContent);

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

            // Clean up temp image
            if (fs.existsSync(imagePath)) {
                fs.unlinkSync(imagePath);
            }

        } catch (error) {
            console.warn(`Visual analysis failed for page ${pageNum}:`, error);
            // Fallback to text-only
            docs.push(textDocs[i]);
        }
    }

    return docs;
}

async function processWordMultimodal(filePath: string): Promise<Document[]> {
    const buffer = fs.readFileSync(filePath);

    // Extract text content
    const textResult = await mammoth.extractRawText({ buffer });
    const textContent = textResult.value || '';

    // Extract images and convert to base64 for analysis
    const imageResult = await mammoth.extract({
        buffer,
        convertImage: mammoth.images.imgElement(function (image) {
            return image.read("base64").then(function (imageBuffer) {
                return {
                    src: "data:" + image.contentType + ";base64," + imageBuffer
                };
            });
        })
    });

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

async function analyzePageVisually(imagePath: string, textContent: string): Promise<any> {
    try {
        const imageBuffer = fs.readFileSync(imagePath);
        const base64Image = imageBuffer.toString('base64');

        const prompt = `Analyze this document page image and identify:

1. TABLES: List any tables with their structure and key data
2. CHARTS/GRAPHS: Describe any charts, graphs, or visual data representations
3. IMAGES: Describe any images, diagrams, or visual elements
4. LAYOUT: Note any special formatting or structure

Text content from OCR: "${textContent.slice(0, 500)}..."

Provide a structured analysis focusing on information NOT captured in the text.`;

        const response = await visionModel.invoke([
            {
                type: "text",
                text: prompt
            },
            {
                type: "image_url",
                image_url: {
                    url: `data:image/png;base64,${base64Image}`
                }
            }
        ]);

        const analysis = response.content as string;

        return {
            visualDescription: analysis,
            hasVisuals: analysis.toLowerCase().includes('image') || analysis.toLowerCase().includes('diagram'),
            hasTables: analysis.toLowerCase().includes('table'),
            hasCharts: analysis.toLowerCase().includes('chart') || analysis.toLowerCase().includes('graph'),
            contentTypes: extractContentTypes(analysis)
        };

    } catch (error) {
        console.error('Vision analysis failed:', error);
        return {
            visualDescription: '',
            hasVisuals: false,
            hasTables: false,
            hasCharts: false,
            contentTypes: ['text']
        };
    }
}

async function analyzeWordDocument(htmlContent: string, textContent: string): Promise<any> {
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

function createEnhancedContent(textContent: string, visualAnalysis: any): string {
    const sections = [
        `TEXT CONTENT:\n${textContent}`,
    ];

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
