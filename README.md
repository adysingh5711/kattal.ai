# PDF Chat Application

This is a Next.js application that allows users to chat with their PDF documents using AI. The application uses LangChain, Pinecone for vector storage, and OpenAI for embeddings and chat completions.

## Features

- Chat interface with AI assistant
- PDF document processing and embedding
- Vector search using Pinecone
- Responsive UI with dark/light mode support

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- Ollama installed locally (for embeddings)
- Pinecone API key
- PDF document to process

### Ollama Setup

1. Install Ollama from [https://ollama.com/download](https://ollama.com/download)

2. After installation, pull the required embedding model:

```bash
ollama pull nomic-embed-text
```

3. Ensure Ollama is running in the background before starting the application. The default URL is http://localhost:11434.

### Environment Setup

1. Copy the `.env` file and fill in the required values:

```bash
# Required from external tools
PINECONE_API_KEY=your_pinecone_api_key

# Usually for free pinecone account env is "us-west4-gcp-free"
PINECONE_ENVIRONMENT=your_pinecone_environment

# The index can be created directly or will be created when you run prepare-data npm command
PINECONE_INDEX_NAME=your_index_name

# Path to your PDF file(s)
PDF_PATH=path/to/your/documents/*.pdf

# Pinecone index creation requires time so hence we wait for 3 minutes
INDEX_INIT_TIMEOUT=240000
```

Note: The OPENAI_API_KEY is still required for chat completions but not for embeddings, which now use Ollama locally.

### Installation

1. Install dependencies:

```bash
npm install
```

2. Prepare the PDF data:

```bash
npm run prepare:data
```

This will process your PDF document, create chunks, generate embeddings, and store them in Pinecone.

3. Run the development server:

```bash
npm run dev
```

4. Open [http://localhost:3000/chat](http://localhost:3000/chat) with your browser to start chatting with your PDF document.

## How It Works

1. The PDF document is loaded and split into chunks using LangChain's document loaders and text splitters.
2. Each chunk is embedded using Ollama's local embedding model (nomic-embed-text) and stored in Pinecone.
3. When a user asks a question, the application:
   - Retrieves relevant document chunks from Pinecone based on the question
   - Passes the retrieved context along with the question to the LLM
   - Returns the AI's response to the user

## Tech Stack

- Next.js 14+ with App Router
- LangChain for document processing and RAG (Retrieval Augmented Generation)
- Pinecone for vector storage
- Ollama for local embeddings
- Tailwind CSS for styling
- shadcn/ui components

## Customization

- To use a different PDF document, update the `PDF_PATH` in your `.env` file and run `npm run prepare:data` again.
- To modify the chat interface, edit the components in `src/components/`.
- To change the AI model or parameters, update the configuration in `src/lib/llm.ts`.