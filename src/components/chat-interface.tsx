"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { Button } from "./ui/button"
import { Input } from "./ui/input"
import { Avatar } from "./ui/avatar"
import { ScrollArea } from "./ui/scroll-area"
import { Send } from "lucide-react"
// import { Paperclip, Mic, Image } from "lucide-react"

const users = [
    {
        id: "1",
        name: "Emma Thompson"
    },
    {
        id: "2",
        name: "James Wilson"
    },
    {
        id: "3",
        name: "Sophia Martinez"
    },
    {
        id: "4",
        name: "Liam Johnson"
    },
    {
        id: "5",
        name: "Olivia Davis"
    },
]

type Message = {
    id: string
    content: string
    sender: "user" | "assistant"
}

type ChatInterfaceProps = {
    selectedUser?: string | null
}
// [role=assistant]:bg-gray-100 data-[role=user]:bg-blue-500
export default function ChatInterface({ selectedUser }: ChatInterfaceProps) {
    const [messages, setMessages] = useState<Message[]>([
        {
            id: "1",
            content: "Hello! How can I help you today?",
            sender: "assistant",
        },
    ])
    const [inputValue, setInputValue] = useState("")
    const [isTyping, setIsTyping] = useState(false)
    const messagesEndRef = useRef<HTMLDivElement>(null)

    // Find the selected user from our data
    const selectedUserData = selectedUser ? users.find((user) => user.id === selectedUser) : null

    const scrollToBottom = useCallback(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
    }, [])

    useEffect(() => {
        scrollToBottom()
    }, [messages, scrollToBottom])

    const handleSendMessage = () => {
        if (inputValue.trim() === "") return

        // Add user message
        const userMessage: Message = {
            id: Date.now().toString(),
            content: inputValue,
            sender: "user",
        }

        setMessages((prev) => [...prev, userMessage])
        setInputValue("")

        // Simulate assistant typing
        setIsTyping(true)

        // Simulate assistant response after a delay
        setTimeout(() => {
            const assistantMessage: Message = {
                id: (Date.now() + 1).toString(),
                content: `I received your message: "${inputValue}"`,
                sender: "assistant",
            }

            setMessages((prev) => [...prev, assistantMessage])
            setIsTyping(false)
        }, 1500)
    }

    return (
        <div className="bg-background flex flex-col h-full">
            {/* Header */}
            <div className="flex items-center p-4 border-b">
                {selectedUserData ? (
                    <>
                        <Avatar className="w-10 h-10 mr-3">
                            {/* <img
                                src={selectedUserData.avatar || "/placeholder.svg"}
                                alt={selectedUserData.name}
                                className="object-cover w-full h-full"
                            /> */}
                        </Avatar>
                        <div>
                            <h2 className="font-semibold">{selectedUserData.name}</h2>
                            {/* <p className="text-muted-foreground text-xs capitalize">{selectedUserData.status}</p> */}
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
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1 p-4">
                <div className="space-y-4">
                    {messages.map((message) => (
                        <div key={message.id} className={`flex ${message.sender === "user" ? "justify-end" : "justify-start"}`}>
                            <div
                                className={`max-w-[80%] rounded-2xl px-4 py-2 ${message.sender === "user"
                                    ? "bg-blue-500 text-primary-foreground rounded-br-none"
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
                                        className="bg-muted-foreground/50 animate-bounce w-2 h-2 rounded-full"
                                        style={{ animationDelay: "0ms" }}
                                    ></div>
                                    <div
                                        className="bg-muted-foreground/50 animate-bounce w-2 h-2 rounded-full"
                                        style={{ animationDelay: "150ms" }}
                                    ></div>
                                    <div
                                        className="bg-muted-foreground/50 animate-bounce w-2 h-2 rounded-full"
                                        style={{ animationDelay: "300ms" }}
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
                    <Button onClick={handleSendMessage} size="icon" className="rounded-full" disabled={inputValue.trim() === ""}>
                        <Send className="w-5 h-5" />
                    </Button>
                </div>
            </div>
        </div>
    )
}
