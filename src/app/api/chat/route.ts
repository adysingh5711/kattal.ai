import { NextRequest, NextResponse } from "next/server";
import { callChain } from "@/lib/langchain";

interface Message {
    role: "user" | "assistant";
    content: string;
}

const formatMessage = (message: Message) =>
    `${message.role === "user" ? "Human" : "Assistant"}: ${message.content}`;

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const messages: Message[] = body.messages ?? [];
        if (!messages.length || !messages[messages.length - 1].content) {
            return NextResponse.json("Error: No question in the request", { status: 400 });
        }

        const formattedPreviousMessages = messages.slice(0, -1).map(formatMessage);
        const question = messages[messages.length - 1].content;

        const result = await callChain({
            question,
            chatHistory: formattedPreviousMessages.join("\n"),
        });

        return NextResponse.json(result);
    } catch (error) {
        console.error("Internal server error", error);
        return NextResponse.json(
            { error: "Something went wrong. Try again!" },
            { status: 500 }
        );
    }
}