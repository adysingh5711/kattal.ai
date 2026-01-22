"use client"

import { useState, useRef, useEffect, useCallback, useMemo, forwardRef, useImperativeHandle } from "react"
import { Button } from "./ui/button"
// import { Avatar } from "./ui/avatar"
import { ScrollArea } from "./ui/scroll-area"
import { Send } from "lucide-react"
// import { Paperclip, Mic, Image } from "lucide-react"
import { ThemeProvider } from "@/components/theme-provider"
import { MarkdownRenderer } from "./markdown-renderer"
import { showErrorInChat } from "@/lib/error-messages"
import "./chat-interface.css"
import Image from "next/image"

type Message = {
    id: string
    content: string
    sender: "user" | "assistant"
}

type ChatInterfaceProps = {
    selectedChatId: string | null
}

export type ChatInterfaceHandle = {
    focusInput: () => void
}

const ChatInterface = forwardRef<ChatInterfaceHandle, ChatInterfaceProps>(
    function ChatInterface({ selectedChatId }, ref) {
        const [chatHistories, setChatHistories] = useState<Record<string, Message[]>>({})
        const [inputValue, setInputValue] = useState("")
        const messagesEndRef = useRef<HTMLDivElement>(null)
        const textareaRef = useRef<HTMLTextAreaElement>(null)
        const chatContainerRef = useRef<HTMLDivElement>(null)

        useImperativeHandle(ref, () => ({
            focusInput: () => {
                textareaRef.current?.focus()
            }
        }))

        // Ensure a default message for new chats
        useEffect(() => {
            if (selectedChatId && !chatHistories[selectedChatId]) {
                setChatHistories(prev => ({
                    ...prev,
                    [selectedChatId]: [
                        {
                            id: "1",
                            content: "ഹായ്! ഇന്ന് നിന്നെ എങ്ങനെ സഹായിക്കാം?",
                            sender: "assistant",
                        },
                    ],
                }))
            }
        }, [selectedChatId, chatHistories])

        const messages = useMemo(() => (
            selectedChatId && chatHistories[selectedChatId] ? chatHistories[selectedChatId] : []
        ), [selectedChatId, chatHistories])

        const scrollToBottom = useCallback(() => {
            messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
        }, [])

        useEffect(() => {
            scrollToBottom()
        }, [messages, scrollToBottom])

        const handleSendMessage = async () => {
            if (!selectedChatId || inputValue.trim() === "") return

            // Trim trailing spaces and newlines
            const trimmedContent = inputValue.replace(/\s+$/, '')

            const userMessage: Message = {
                id: Date.now().toString(),
                content: trimmedContent,
                sender: "user",
            }

            // Check if this is the first user message in this chat
            const isFirstUserMessage = !chatHistories[selectedChatId]?.some(msg => msg.sender === "user")

            // If it's the first user message, update the chat title
            if (isFirstUserMessage) {
                // Extract first four words for the chat title
                const words = trimmedContent.split(/\s+/)
                const titleWords = words.slice(0, 4)
                const newTitle = titleWords.join(' ')

                // Dispatch a custom event to update the chat title
                const updateTitleEvent = new CustomEvent('updateChatTitle', {
                    detail: { chatId: selectedChatId, title: newTitle }
                })
                window.dispatchEvent(updateTitleEvent)
            }

            setChatHistories(prev => ({
                ...prev,
                [selectedChatId]: [...(prev[selectedChatId] || []), userMessage],
            }))
            setInputValue("")

            // Reset textarea height
            if (textareaRef.current) {
                textareaRef.current.style.height = 'auto';
            }

            try {
                // Get current chat history for context
                const currentMessages = chatHistories[selectedChatId] || []
                const allMessages = [...currentMessages, userMessage]

                let assistantMessage: Message | null = null;
                let streamingSucceeded = false;

                try {
                    // Try streaming API first
                    const response = await fetch('/api/chat/stream', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            messages: allMessages.map(msg => ({
                                role: msg.sender === 'user' ? 'user' : 'assistant',
                                content: msg.content
                            }))
                        }),
                    })

                    if (!response.ok) {
                        throw new Error(`Streaming API failed with status: ${response.status}`)
                    }

                    const reader = response.body?.getReader()
                    const decoder = new TextDecoder()

                    assistantMessage = {
                        id: (Date.now() + 1).toString(),
                        content: "",
                        sender: "assistant",
                    }

                    // Add initial empty message for streaming updates
                    setChatHistories(prev => ({
                        ...prev,
                        [selectedChatId]: [...(prev[selectedChatId] || []), assistantMessage!],
                    }))

                    let sources: Array<{ source: string; relevance: number; usedFor: string; contentType: 'text' | 'table' | 'chart' | 'image'; pageReference?: string }> = [];
                    let hasError = false;

                    if (reader) {
                        try {
                            while (true) {
                                const { done, value } = await reader.read()
                                if (done) break

                                const chunk = decoder.decode(value)
                                const lines = chunk.split('\n')

                                for (const line of lines) {
                                    if (line.startsWith('data: ')) {
                                        try {
                                            const data = JSON.parse(line.slice(6))

                                            if (data.type === 'search_start') {
                                                // Search started - no need to log normal operation
                                            } else if (data.type === 'loading_start') {
                                                // Loading started - no need to log normal operation
                                                // Add wave effect to the message
                                                setChatHistories(prev => {
                                                    const updated = { ...prev }
                                                    const messages = [...(updated[selectedChatId] || [])]
                                                    const lastMessage = messages[messages.length - 1]
                                                    if (lastMessage && lastMessage.sender === 'assistant') {
                                                        // Only add marker if it's not already there
                                                        if (!lastMessage.content.includes('|WAVE_EFFECT|')) {
                                                            lastMessage.content = lastMessage.content + '|WAVE_EFFECT|'
                                                        }
                                                    }
                                                    updated[selectedChatId] = messages
                                                    return updated
                                                })
                                            } else if (data.type === 'loading_complete') {
                                                // Loading completed - no need to log normal operation
                                                // Remove wave effect and prepare for clearing
                                                setChatHistories(prev => {
                                                    const updated = { ...prev }
                                                    const messages = [...(updated[selectedChatId] || [])]
                                                    const lastMessage = messages[messages.length - 1]
                                                    if (lastMessage && lastMessage.sender === 'assistant') {
                                                        lastMessage.content = lastMessage.content.replace(/\|WAVE_EFFECT\|/g, '')
                                                    }
                                                    updated[selectedChatId] = messages
                                                    return updated
                                                })
                                            } else if (data.type === 'clear_message') {
                                                // Clearing previous message - no need to log normal operation
                                                // Clear the previous message content
                                                assistantMessage!.content = ""
                                                setChatHistories(prev => {
                                                    const updated = { ...prev }
                                                    const messages = [...(updated[selectedChatId] || [])]
                                                    const lastMessage = messages[messages.length - 1]
                                                    if (lastMessage && lastMessage.sender === 'assistant') {
                                                        lastMessage.content = ""
                                                    }
                                                    updated[selectedChatId] = messages
                                                    return updated
                                                })
                                            } else if (data.type === 'content') {
                                                // Update message content
                                                assistantMessage!.content += data.content
                                                setChatHistories(prev => {
                                                    const updated = { ...prev }
                                                    const messages = [...(updated[selectedChatId] || [])]
                                                    const lastMessage = messages[messages.length - 1]
                                                    if (lastMessage && lastMessage.sender === 'assistant') {
                                                        lastMessage.content = assistantMessage!.content
                                                    }
                                                    updated[selectedChatId] = messages
                                                    return updated
                                                })
                                            } else if (data.type === 'done') {
                                                // Response complete - no need to log normal operation
                                                sources = data.data?.sources || []
                                                streamingSucceeded = true
                                            } else if (data.type === 'error') {
                                                hasError = true
                                                const errorDetails = showErrorInChat(
                                                    data.error || 'Streaming error occurred',
                                                    'streaming_response',
                                                    { streamType: 'chat_stream' }
                                                );
                                                throw new Error(errorDetails.technicalMessage)
                                            }
                                        } catch (parseError) {
                                            console.warn('Failed to parse streaming data:', parseError)
                                            // Continue processing other lines
                                        }
                                    }
                                }
                            }
                        } catch (readerError) {
                            const errorDetails = showErrorInChat(
                                readerError instanceof Error ? readerError : new Error(String(readerError)),
                                'stream_reading',
                                { streamType: 'chat_stream' }
                            );
                            hasError = true
                            throw new Error(errorDetails.technicalMessage)
                        }
                    }

                    if (hasError) {
                        throw new Error('Streaming encountered errors')
                    }

                } catch (streamingError) {
                    const errorDetails = showErrorInChat(
                        streamingError instanceof Error ? streamingError : new Error(String(streamingError)),
                        'streaming_fallback',
                        { fallbackTo: 'regular_api' }
                    );
                    console.warn('Streaming failed, using fallback API:', errorDetails.technicalMessage)

                    // Remove the failed streaming message if it was added
                    if (assistantMessage && !streamingSucceeded) {
                        setChatHistories(prev => {
                            const updated = { ...prev }
                            const messages = [...(updated[selectedChatId] || [])]
                            // Remove the last message if it's the failed assistant message
                            const lastMessage = messages[messages.length - 1]
                            if (lastMessage && lastMessage.sender === 'assistant' && lastMessage.id === assistantMessage!.id) {
                                messages.pop()
                            }
                            updated[selectedChatId] = messages
                            return updated
                        })
                    }

                    // Fallback to regular API
                    try {
                        const fallbackResponse = await fetch('/api/chat', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                            },
                            body: JSON.stringify({
                                messages: allMessages.map(msg => ({
                                    role: msg.sender === 'user' ? 'user' : 'assistant',
                                    content: msg.content
                                }))
                            }),
                        })

                        if (!fallbackResponse.ok) {
                            const errorDetails = showErrorInChat(
                                `Fallback API failed with status: ${fallbackResponse.status}`,
                                'fallback_api_error',
                                { status: fallbackResponse.status }
                            );
                            throw new Error(errorDetails.technicalMessage)
                        }

                        const data = await fallbackResponse.json()

                        const fallbackAssistantMessage: Message = {
                            id: (Date.now() + 2).toString(),
                            content: data.text || "ക്ഷമിക്കണം, നിങ്ങളുടെ അഭ്യർത്ഥന പ്രോസസ് ചെയ്യാൻ കഴിഞ്ഞില്ല.",
                            sender: "assistant",
                        }

                        setChatHistories(prev => ({
                            ...prev,
                            [selectedChatId]: [...(prev[selectedChatId] || []), fallbackAssistantMessage],
                        }))
                    } catch (fallbackError) {
                        const errorDetails = showErrorInChat(
                            fallbackError instanceof Error ? fallbackError : new Error(String(fallbackError)),
                            'fallback_api_failed',
                            { originalError: streamingError }
                        );
                        console.error('Fallback API also failed:', errorDetails.technicalMessage)
                        throw new Error(errorDetails.technicalMessage)
                    }
                }
            } catch (error) {
                // Get Malayalam error message for user and log technical details
                const errorDetails = showErrorInChat(
                    error instanceof Error ? error : new Error(String(error)),
                    'chat_message_send',
                    {
                        chatId: selectedChatId,
                        messageCount: messages.length,
                        timestamp: new Date().toISOString()
                    }
                );

                // Ensure we don't have duplicate error messages
                const errorMessage: Message = {
                    id: (Date.now() + 3).toString(),
                    content: errorDetails.userMessage, // Show Malayalam message to user
                    sender: "assistant",
                }

                setChatHistories(prev => {
                    const updated = { ...prev }
                    const messages = [...(updated[selectedChatId] || [])]

                    // Check if the last message is already an error message to avoid duplicates
                    const lastMessage = messages[messages.length - 1]
                    if (!(lastMessage && lastMessage.sender === 'assistant' && lastMessage.content.includes('പ്രശ്നമുണ്ട്'))) {
                        messages.push(errorMessage)
                    }

                    updated[selectedChatId] = messages
                    return updated
                })
            } finally {
                // Streaming completed
            }
        }

        return (
            <div ref={chatContainerRef} className="bg-background flex flex-col h-full">
                <ThemeProvider
                    attribute="class"
                    defaultTheme="system"
                    enableSystem
                    disableTransitionOnChange
                >

                    {/* Messages */}
                    <ScrollArea className="flex-1 h-full p-4 overflow-y-auto">
                        <div className="absolute inset-0 flex items-end justify-center pointer-events-none z-25">
                            <Image
                                src="/icon.png"
                                alt="Background Icon"
                                width={500}
                                height={400}
                                className="opacity-20 dark:opacity-20 object-contain"
                                priority
                            />
                        </div>
                        <div className="space-y-4">
                            {messages.map((message) => (
                                <div key={message.id} className={`flex ${message.sender === "user" ? "justify-end" : "justify-start"}`}>
                                    <div
                                        className={`max-w-[80%] rounded-2xl px-4 py-2 ${message.sender === "user"
                                            ? "bg-blue-500 text-primary-foreground rounded-br-none dark:text-white"
                                            : "bg-muted rounded-bl-none"
                                            }`}
                                    >
                                        {message.sender === "assistant" ? (
                                            message.content.includes('|WAVE_EFFECT|') ? (
                                                <div className="text-foreground wave-effect">
                                                    <MarkdownRenderer
                                                        content={message.content.replace(/\|WAVE_EFFECT\|/g, '')}
                                                        className="text-foreground"
                                                    />
                                                </div>
                                            ) : (
                                                <MarkdownRenderer
                                                    content={message.content}
                                                    className="text-foreground"
                                                />
                                            )
                                        ) : (
                                            <p>{message.content.split('\n').map((line, idx, arr) => (
                                                <span key={`${message.id}-line-${idx}`}>
                                                    {line}
                                                    {idx < arr.length - 1 && <br />}
                                                </span>
                                            ))}</p>
                                        )}
                                        <div
                                            className={`text-xs mt-1 ${message.sender === "user" ? "text-primary-foreground/70" : "text-muted-foreground"
                                                }`}
                                        >
                                        </div>
                                    </div>
                                </div>
                            ))}

                            <div ref={messagesEndRef} />
                        </div>
                    </ScrollArea>

                    {/* Input */}
                    <div className="p-4">
                        <div className="flex items-center gap-2">
                            {/* <Button variant="outline" size="icon" className="rounded-full">
                            <Paperclip className="w-5 h-5" />
                        </Button>
                        <Button variant="outline" size="icon" className="rounded-full">
                            <Image className="w-5 h-5" />
                        </Button> */}
                            <div className="relative flex-1">
                                <textarea
                                    id="chat-input"
                                    name="chat-input"
                                    ref={textareaRef}
                                    value={inputValue}
                                    onChange={e => {
                                        setInputValue(e.target.value)
                                        // Auto-grow with 40% of chat window height limit
                                        const el = e.target as HTMLTextAreaElement
                                        el.style.height = 'auto';

                                        // Calculate 40% of chat container height
                                        const chatHeight = chatContainerRef.current?.offsetHeight || 600;
                                        const maxHeight = chatHeight * 0.4;

                                        el.style.height = Math.min(el.scrollHeight, maxHeight) + 'px';
                                    }}
                                    placeholder="ഒരു സന്ദേശം ടൈപ്പ് ചെയ്യുക..."
                                    className="chat-textarea pr-10 rounded-2xl resize-none w-full min-h-[40px] bg-background border border-input px-4 py-2 text-base shadow-xs focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] outline-none transition-colors overflow-hidden"
                                    rows={1}
                                    onKeyDown={e => {
                                        if (e.key === "Enter") {
                                            if (e.shiftKey) {
                                                // Shift+Enter inserts newline
                                                const target = e.target as HTMLTextAreaElement;
                                                const start = target.selectionStart || 0;
                                                const end = target.selectionEnd || 0;
                                                const newValue = inputValue.slice(0, start) + "\n" + inputValue.slice(end);
                                                setInputValue(newValue);

                                                setTimeout(() => {
                                                    target.selectionStart = target.selectionEnd = start + 1;
                                                    // Resize textarea if needed
                                                    target.style.height = 'auto';
                                                    const chatHeight = chatContainerRef.current?.offsetHeight || 600;
                                                    const maxHeight = chatHeight * 0.4;
                                                    target.style.height = Math.min(target.scrollHeight, maxHeight) + 'px';
                                                }, 0);

                                                e.preventDefault(); // prevent form submit or other default
                                            } else {
                                                // Enter or Ctrl+Enter sends message
                                                if (e.ctrlKey || !e.shiftKey) {
                                                    handleSendMessage();
                                                    e.preventDefault();
                                                }
                                            }
                                        }
                                    }}

                                />
                                {/* <Button variant="ghost" size="icon" className="right-1 top-1/2 absolute -translate-y-1/2 rounded-full">
                                <Mic className="w-5 h-5" />
                            </Button> */}
                            </div>
                            <Button onClick={handleSendMessage} size="icon" className="bg-blue-500 rounded-full" disabled={inputValue.trim() === ""}>
                                <Send className="dark:text-white w-5 h-5" />
                            </Button>
                        </div>
                    </div>
                </ThemeProvider>
            </div>
        )
    }
)

export default ChatInterface
