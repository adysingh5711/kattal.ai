"use client"

import { useState, useRef, useEffect, useCallback, useMemo, forwardRef, useImperativeHandle } from "react"
import { Button } from "./ui/button"
import { Input } from "./ui/input"
// import { Avatar } from "./ui/avatar"
import { ScrollArea } from "./ui/scroll-area"
import { Send } from "lucide-react"
// import { Paperclip, Mic, Image } from "lucide-react"
import { ThemeProvider } from "@/components/theme-provider"

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
        const inputRef = useRef<HTMLInputElement>(null)

        useImperativeHandle(ref, () => ({
            focusInput: () => {
                inputRef.current?.focus()
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

        const handleSendMessage = () => {
            if (!selectedChatId || inputValue.trim() === "") return

            const userMessage: Message = {
                id: Date.now().toString(),
                content: inputValue,
                sender: "user",
            }

            setChatHistories(prev => ({
                ...prev,
                [selectedChatId]: [...(prev[selectedChatId] || []), userMessage],
            }))
            setInputValue("")
            setIsTyping(true)

            setTimeout(() => {
                const assistantMessage: Message = {
                    id: (Date.now() + 1).toString(),
                    content: `I received your message: "${inputValue}"`,
                    sender: "assistant",
                }
                setChatHistories(prev => ({
                    ...prev,
                    [selectedChatId]: [...(prev[selectedChatId] || []), assistantMessage],
                }))
                setIsTyping(false)
            }, 1500)
        }

        return (
            <div className="bg-background flex flex-col h-full">
                <ThemeProvider
                    attribute="class"
                    defaultTheme="system"
                    enableSystem
                    disableTransitionOnChange
                >
                    {/* Header */}
                    {/* <div className="flex items-center p-4 border-b">
                        {selectedUserData ? (
                            <>
                                <Avatar className="w-10 h-10 mr-3">
                                    <img
                                    src={selectedUserData.avatar || "/placeholder.svg"}
                                    alt={selectedUserData.name}
                                    className="object-cover w-full h-full"
                                />
                                </Avatar>
                                <div>
                                    <h2 className="font-semibold">{selectedUserData.name}</h2>
                                    <p className="text-muted-foreground text-xs capitalize">{selectedUserData.status}</p>
                                </div>
                            </>
                        ) : (
                            <>
                                <Avatar className="w-10 h-10 mr-3">
                                    <div className="bg-primary text-primary-foreground flex items-center justify-center w-full h-full font-semibold rounded-full">
                                        AI
                                    </div>
                                </Avatar>
                                <div>
                                    <h2 className="font-semibold">AI Assistant</h2>
                                    <p className="text-muted-foreground text-xs">Always online</p>
                                </div>
                            </>
                        )}
                    </div> */}

                    {/* Messages */}
                    <ScrollArea className="scrollbar-thin scrollbar-thumb-rounded scrollbar-thumb-gray-400 dark:scrollbar-thumb-gray-700 flex-1 h-full p-4 overflow-y-auto">
                        <div className="space-y-4">
                            {messages.map((message) => (
                                <div key={message.id} className={`flex ${message.sender === "user" ? "justify-end" : "justify-start"}`}>
                                    <div
                                        className={`max-w-[80%] rounded-2xl px-4 py-2 ${message.sender === "user"
                                            ? "bg-blue-500 text-primary-foreground rounded-br-none dark:text-white"
                                            : "bg-muted rounded-bl-none"
                                            }`}
                                    >
                                        <p>{message.content}</p>
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
                    <div className="p-4 border-t">
                        <div className="flex items-center gap-2">
                            {/* <Button variant="outline" size="icon" className="rounded-full">
                            <Paperclip className="w-5 h-5" />
                        </Button>
                        <Button variant="outline" size="icon" className="rounded-full">
                            <Image className="w-5 h-5" />
                        </Button> */}
                            <div className="relative flex-1">
                                <Input
                                    ref={inputRef}
                                    value={inputValue}
                                    onChange={(e) => setInputValue(e.target.value)}
                                    placeholder="Type a message..."
                                    className="pr-10 rounded-full"
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter") {
                                            handleSendMessage()
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
