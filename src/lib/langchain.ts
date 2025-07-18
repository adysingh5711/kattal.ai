import { createRetrievalChain } from "langchain/chains/retrieval";
import { createStuffDocumentsChain } from "langchain/chains/combine_documents";
import { createHistoryAwareRetriever } from "langchain/chains/history_aware_retriever";
import { ChatPromptTemplate, MessagesPlaceholder } from "@langchain/core/prompts";
import { HumanMessage, AIMessage } from "@langchain/core/messages";
import { getVectorStore } from "./vector-store";
import { getPinecone } from "./pinecone-client";
import { streamingModel, nonStreamingModel } from "./llm";

type callChainArgs = {
    question: string;
    chatHistory: string;
};

export async function callChain({ question, chatHistory }: callChainArgs) {
    try {
        const sanitizedQuestion = question.trim().replaceAll("\n", " ");
        const pineconeClient = await getPinecone();
        const vectorStore = await getVectorStore(pineconeClient);
        const retriever = vectorStore.asRetriever();

        // Create history-aware retriever
        const historyAwarePrompt = ChatPromptTemplate.fromMessages([
            new MessagesPlaceholder("chat_history"),
            ["user", "{input}"],
            ["user", "Given the above conversation, generate a search query to look up in order to get information relevant to the conversation"]
        ]);

        const historyAwareRetriever = await createHistoryAwareRetriever({
            llm: nonStreamingModel,
            retriever,
            rephrasePrompt: historyAwarePrompt,
        });

        // Create QA chain
        const qaPrompt = ChatPromptTemplate.fromMessages([
            ["system", "Answer the user's questions based on the below context:\n\n{context}"],
            new MessagesPlaceholder("chat_history"),
            ["user", "{input}"],
        ]);

        const questionAnswerChain = await createStuffDocumentsChain({
            llm: streamingModel,
            prompt: qaPrompt,
        });

        const ragChain = await createRetrievalChain({
            retriever: historyAwareRetriever,
            combineDocsChain: questionAnswerChain,
        });

        // Parse chat history
        const chatMessages = chatHistory ? chatHistory.split('\n').map((msg, index) => {
            return index % 2 === 0 ? new HumanMessage(msg) : new AIMessage(msg);
        }).filter(msg => {
            const content = typeof msg.content === 'string' ? msg.content : '';
            return content.trim().length > 0;
        }) : [];

        // Execute the chain
        const result = await ragChain.invoke({
            input: sanitizedQuestion,
            chat_history: chatMessages,
        });

        const sourceDocuments = result.context || [];
        const firstTwoDocuments = sourceDocuments.slice(0, 2);
        const pageContents = firstTwoDocuments.map(
            (doc: { pageContent: string }) => doc.pageContent
        );

        return {
            text: result.answer,
            sources: pageContents,
        };
    } catch (e) {
        console.error(e);
        throw new Error("Call chain method failed to execute successfully!!");
    }
}