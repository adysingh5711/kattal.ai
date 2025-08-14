import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { Document } from "langchain/document";
import { env } from "./env";
import fs from 'fs';
import path from 'path';
import { processDocumentMultimodal } from "./multimodal-processor";
import { chunkMultimodalDocuments } from "./smart-chunker";

export async function getChunkedDocsFromPDF() {
    try {
        let allDocs: Document[] = [];

        // Prefer DOC_PATH (combined), fallback to PDF_PATH/DOCX_PATH
        const pathPattern = env.DOC_PATH || env.PDF_PATH || env.DOCX_PATH;

        // Check if pathPattern is a directory wildcard or specific file
        if (pathPattern.includes('*')) {
            // Handle directory with multiple documents
            const dirPath = pathPattern.replace('/*', '');

            if (fs.existsSync(dirPath)) {
                const files = fs.readdirSync(dirPath)
                    .filter(file => {
                        const lower = file.toLowerCase();
                        return lower.endsWith('.pdf') || lower.endsWith('.doc') || lower.endsWith('.docx');
                    })
                    .map(file => path.join(dirPath, file));

                console.log(`Found ${files.length} files (PDF/DOC/DOCX) in ${dirPath}`);

                // Process each file
                for (const file of files) {
                    try {
                        console.log(`Processing file: ${file}`);
                        const docs = await processDocumentMultimodal(file);
                        allDocs = [...allDocs, ...docs];
                    } catch (fileError) {
                        console.error(`Error processing file ${file}:`, fileError);
                        // Continue with other files even if one fails
                    }
                }
            } else {
                throw new Error(`Directory not found: ${dirPath}`);
            }
        } else {
            // Handle single file
            if (!fs.existsSync(pathPattern)) {
                throw new Error(`File not found: ${pathPattern}`);
            }

            const file = pathPattern;
            console.log(`Processing single file: ${file}`);
            allDocs = await processDocumentMultimodal(file);
        }

        if (allDocs.length === 0) {
            throw new Error("No PDF documents were successfully loaded");
        }

        console.log(`Successfully loaded ${allDocs.length} document sections`);

        // Use smart multimodal chunking
        const chunkedDocs = await chunkMultimodalDocuments(allDocs);
        console.log(`Created ${chunkedDocs.length} chunks from the documents`);

        return chunkedDocs;
    } catch (e: unknown) {
        console.error("Document chunking failed:", e);
        const errorMessage = e instanceof Error ? e.message : 'Unknown error';
        throw new Error(`Document chunking failed: ${errorMessage}`);
    }
}