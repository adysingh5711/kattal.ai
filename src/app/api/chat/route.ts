import { NextRequest, NextResponse } from "next/server";
import { callChain } from "@/lib/langchain";

interface Message {
    role: "user" | "assistant";
    content: string;
}

const formatMessage = (message: Message) =>
    `${message.role === "user" ? "Human" : "Assistant"}: ${message.content}`;

export async function POST(req: NextRequest) {
    const startTime = Date.now();

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

        const responseTime = Date.now() - startTime;

        // Log performance metrics for production monitoring
        console.log(`📈 API Performance: ${responseTime}ms, ${result.analysis?.documentsUsed || 0} docs retrieved`);

        // Add performance headers for monitoring
        const response = NextResponse.json(result);
        response.headers.set('X-Response-Time', `${responseTime}ms`);
        response.headers.set('X-Documents-Retrieved', `${result.analysis?.documentsUsed || 0}`);
        response.headers.set('X-Cache-Status', result.cached ? 'HIT' : 'MISS');

        return response;
    } catch (error) {
        const responseTime = Date.now() - startTime;
        console.error(`❌ API Error after ${responseTime}ms:`, error);
        return NextResponse.json(
            { error: "Something went wrong. Try again!" },
            { status: 500 }
        );
    }
}