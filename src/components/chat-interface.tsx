"use client"

import { useState, useRef, useEffect, useCallback, useMemo, forwardRef, useImperativeHandle } from "react"
import { Button } from "./ui/button"
// import { Avatar } from "./ui/avatar"
import { ScrollArea } from "./ui/scroll-area"
import { Send } from "lucide-react"
// import { Paperclip, Mic, Image } from "lucide-react"
import { ThemeProvider } from "@/components/theme-provider"
import { MarkdownRenderer } from "./markdown-renderer"
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
        const [isTyping, setIsTyping] = useState(false)
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
                            content: "Hello! How can I help you today?",
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
            setIsTyping(true)

            // Reset textarea height
            if (textareaRef.current) {
                textareaRef.current.style.height = 'auto';
            }

            try {
                // Get current chat history for context
                const currentMessages = chatHistories[selectedChatId] || []
                const allMessages = [...currentMessages, userMessage]

                const response = await fetch('/api/chat', {
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
                    throw new Error('Failed to get response')
                }

                const data = await response.json()

                const assistantMessage: Message = {
                    id: (Date.now() + 1).toString(),
                    content: data.text || "Sorry, I couldn't process your request.",
                    sender: "assistant",
                }

                setChatHistories(prev => ({
                    ...prev,
                    [selectedChatId]: [...(prev[selectedChatId] || []), assistantMessage],
                }))
            } catch (error) {
                console.error('Error sending message:', error)
                const errorMessage: Message = {
                    id: (Date.now() + 1).toString(),
                    content: "Sorry, there was an error processing your request. Please try again.",
                    sender: "assistant",
                }
                setChatHistories(prev => ({
                    ...prev,
                    [selectedChatId]: [...(prev[selectedChatId] || []), errorMessage],
                }))
            } finally {
                setIsTyping(false)
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
                                            <MarkdownRenderer
                                                content={message.content}
                                                className="text-foreground"
                                            />
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

                            {isTyping && (
                                <div className="flex justify-start">
                                    <div className="bg-muted rounded-2xl px-4 py-2 rounded-bl-none">
                                        <div className="flex space-x-1">
                                            <div
                                                className="bg-muted-foreground/50 animate-bounce animate-delay-0 w-2 h-2 rounded-full"
                                            ></div>
                                            <div
                                                className="bg-muted-foreground/50 animate-bounce animate-delay-150 w-2 h-2 rounded-full"
                                            ></div>
                                            <div
                                                className="bg-muted-foreground/50 animate-bounce animate-delay-300 w-2 h-2 rounded-full"
                                            ></div>
                                        </div>
                                    </div>
                                </div>
                            )}
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
                                    placeholder="Type a message/ഒരു സന്ദേശം ടൈപ്പ് ചെയ്യുക..."
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
