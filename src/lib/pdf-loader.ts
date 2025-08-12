import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { DocxLoader } from "@langchain/community/document_loaders/fs/docx";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { Document } from "langchain/document";
import { env } from "./env";
import fs from 'fs';
import path from 'path';

export async function getChunkedDocs() {
    try {
        let allDocs: Document[] = [];

        // Get file paths
        const pdfFiles = getFilesFromPattern(env.PDF_PATH, '.pdf');
        const docxFiles = env.DOCX_PATH ? getFilesFromPattern(env.DOCX_PATH, '.docx') : [];
        console.log(`Found ${pdfFiles.length} PDF files`);
        console.log(`Found ${docxFiles.length} DOCX files`);

        if (pdfFiles.length + docxFiles.length === 0) {
            throw new Error(`No input files found. Check PDF_PATH/DOCX_PATH`);
        }

        // Process each PDF file
        for (const file of pdfFiles) {
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

        // Process each DOCX file
        for (const file of docxFiles) {
            try {
                console.log(`Processing DOCX: ${file}`);
                const loader = new DocxLoader(file);
                const docs = await loader.load();
                console.log(`Loaded ${docs.length} sections from ${path.basename(file)}`);
                allDocs = [...allDocs, ...docs];
            } catch (fileError) {
                console.error(`Error processing DOCX ${file}:`, fileError);
                // Continue with other files even if one fails
            }
        }

        if (allDocs.length === 0) {
            throw new Error("No documents were successfully loaded");
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
        console.error("Docs chunking failed:", e);
        const errorMessage = e instanceof Error ? e.message : 'Unknown error';
        throw new Error(`Docs chunking failed: ${errorMessage}`);
    }
}

// Robust pattern handling: supports directory paths, single files, or paths ending with */*.ext or *.ext
function getFilesFromPattern(pattern: string, ext: string): string[] {
    try {
        if (!pattern) return [];
        if (pattern.includes('*')) {
            const dir = path.dirname(pattern);
            if (fs.existsSync(dir) && fs.statSync(dir).isDirectory()) {
                return fs.readdirSync(dir)
                    .filter(f => f.toLowerCase().endsWith(ext))
                    .map(f => path.join(dir, f));
            }
            return [];
        }

        if (fs.existsSync(pattern) && fs.statSync(pattern).isDirectory()) {
            return fs.readdirSync(pattern)
                .filter(f => f.toLowerCase().endsWith(ext))
                .map(f => path.join(pattern, f));
        }

        return fs.existsSync(pattern) && pattern.toLowerCase().endsWith(ext) ? [pattern] : [];
    } catch {
        return [];
    }
}