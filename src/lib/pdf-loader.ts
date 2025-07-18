import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { Document } from "langchain/document";
import { env } from "./env";
import fs from 'fs';
import path from 'path';

export async function getChunkedDocsFromPDF() {
    try {
        let allDocs: Document[] = [];

        // Check if PDF_PATH is a directory or a specific file
        if (env.PDF_PATH.includes('*')) {
            // Handle directory with multiple PDFs
            const dirPath = env.PDF_PATH.replace('/*', '');

            if (fs.existsSync(dirPath)) {
                const files = fs.readdirSync(dirPath)
                    .filter(file => file.toLowerCase().endsWith('.pdf'))
                    .map(file => path.join(dirPath, file));

                console.log(`Found ${files.length} PDF files in ${dirPath}`);

                // Process each PDF file
                for (const file of files) {
                    try {
                        console.log(`Processing PDF: ${file}`);
                        const loader = new PDFLoader(file);
                        const docs = await loader.load();
                        allDocs = [...allDocs, ...docs];
                    } catch (fileError) {
                        console.error(`Error processing PDF ${file}:`, fileError);
                        // Continue with other files even if one fails
                    }
                }
            } else {
                throw new Error(`Directory not found: ${dirPath}`);
            }
        } else {
            // Handle single PDF file
            if (!fs.existsSync(env.PDF_PATH)) {
                throw new Error(`PDF file not found: ${env.PDF_PATH}`);
            }

            console.log(`Processing single PDF: ${env.PDF_PATH}`);
            const loader = new PDFLoader(env.PDF_PATH);
            allDocs = await loader.load();
        }

        if (allDocs.length === 0) {
            throw new Error("No PDF documents were successfully loaded");
        }

        console.log(`Successfully loaded ${allDocs.length} document sections`);

        // From the docs https://www.pinecone.io/learn/chunking-strategies/
        const textSplitter = new RecursiveCharacterTextSplitter({
            chunkSize: 1000,
            chunkOverlap: 200,
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