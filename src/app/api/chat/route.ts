import { NextRequest, NextResponse } from "next/server";
import { callChain } from "@/lib/langchain";

// Define our own Message type to match what's being sent from the client
interface Message {
    role: "user" | "assistant";
    content: string;
}

const formatMessage = (message: Message) => {
    return `${message.role === "user" ? "Human" : "Assistant"}: ${message.content}`;
};

export async function POST(req: NextRequest) {
    const body = await req.json();
    const messages: Message[] = body.messages ?? [];
    console.log("Messages ", messages);
    const formattedPreviousMessages = messages.slice(0, -1).map(formatMessage);
    const question = messages[messages.length - 1].content;

    console.log("Chat history ", formattedPreviousMessages.join("\n"));

    if (!question) {
        return NextResponse.json("Error: No question in the request", {
            status: 400,
        });
    }

    try {
        const result = await callChain({
            question,
            chatHistory: formattedPreviousMessages.join("\n"),
        });

        return NextResponse.json(result);
    } catch (error) {
        console.error("Internal server error ", error);
        return NextResponse.json(
            { error: "Something went wrong. Try again!" },
            { status: 500 }
        );
    }
}