import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { Document } from "langchain/document";
import { env } from "./env";
import fs from 'fs';
import path from 'path';

export async function getChunkedDocsFromPDF() {
    try {
        let allDocs: Document[] = [];

        // Get file paths
        const files = getFilePaths();
        console.log(`Found ${files.length} PDF files`);

        if (files.length === 0) {
            throw new Error(`No PDF files found at path: ${env.PDF_PATH}`);
        }

        // Process each PDF file
        for (const file of files) {
            try {
                console.log(`Processing PDF: ${file}`);

                // Use PDFLoader with specific options for better cross-platform compatibility
                const loader = new PDFLoader(file, {
                    splitPages: true,
                    pdfjs: () => import("pdf-parse/lib/pdf.js/v1.10.100/build/pdf.js")
                });

                const docs = await loader.load();
                console.log(`Loaded ${docs.length} pages from ${path.basename(file)}`);
                allDocs = [...allDocs, ...docs];
            } catch (fileError) {
                console.error(`Error processing PDF ${file}:`, fileError);
                // Continue with other files even if one fails
            }
        }

        if (allDocs.length === 0) {
            throw new Error("No PDF documents were successfully loaded");
        }

        console.log(`Successfully loaded ${allDocs.length} document sections`);

        // Enhanced text splitter for multilingual content
        const textSplitter = new RecursiveCharacterTextSplitter({
            chunkSize: 1000,
            chunkOverlap: 200,
            separators: [
                '\n\n',
                '\n',
                '।', // Malayalam sentence separator
                '.',
                '!',
                '?',
                ';',
                ':',
                ' ',
                ''
            ]
        });

        const chunkedDocs = await textSplitter.splitDocuments(allDocs);
        console.log(`Created ${chunkedDocs.length} chunks from the documents`);

        return chunkedDocs;
    } catch (e: unknown) {
        console.error("PDF docs chunking failed:", e);
        const errorMessage = e instanceof Error ? e.message : 'Unknown error';
        throw new Error(`PDF docs chunking failed: ${errorMessage}`);
    }
}

function getFilePaths(): string[] {
    if (env.PDF_PATH.includes('*')) {
        const dirPath = env.PDF_PATH.replace('/*', '');
        if (fs.existsSync(dirPath)) {
            return fs.readdirSync(dirPath)
                .filter(file => file.toLowerCase().endsWith('.pdf'))
                .map(file => path.join(dirPath, file));
        }
        return [];
    } else {
        return fs.existsSync(env.PDF_PATH) ? [env.PDF_PATH] : [];
    }
}