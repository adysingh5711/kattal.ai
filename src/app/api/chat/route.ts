import { NextRequest, NextResponse } from "next/server";
import { callChain } from "@/lib/langchain";
import { showErrorInChat } from "@/lib/error-messages";

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
            const errorDetails = showErrorInChat(
                "No question in the request",
                'api_validation',
                { requestBody: body }
            );
            return NextResponse.json({
                error: errorDetails.userMessage,
                technicalError: errorDetails.technicalMessage
            }, { status: 400 });
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
        const errorDetails = showErrorInChat(
            error instanceof Error ? error : new Error(String(error)),
            'api_chat_route',
            {
                responseTime,
                endpoint: '/api/chat',
                timestamp: new Date().toISOString()
            }
        );
        console.error(`❌ API Error after ${responseTime}ms:`, errorDetails.technicalMessage);
        return NextResponse.json(
            {
                error: errorDetails.userMessage,
                technicalError: errorDetails.technicalMessage
            },
            { status: 500 }
        );
    }
}