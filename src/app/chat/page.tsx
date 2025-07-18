"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import ChatInterface, { ChatInterfaceHandle } from "@/components/chat-interface"
import ChatHistorySidebar from "@/components/user-sidebar"
import { SidebarProvider } from "@/components/ui/sidebar"
import { ThemeProvider } from "@/components/theme-provider"
import { ModeToggle } from "@/components/mode-toggle"

// Move initial chat list here
const initialChatHistories: { id: string; title: string }[] = []

export default function Home() {
    const [chatHistories, setChatHistories] = useState(initialChatHistories)
    const [selectedChat, setSelectedChat] = useState<string | null>(null)
    const chatInterfaceRef = useRef<ChatInterfaceHandle>(null)

    // Add chat and select it, then focus input
    const addChat = useCallback(() => {
        const newId = (Math.max(0, ...chatHistories.map(c => parseInt(c.id))) + 1).toString()
        const newChat = { id: newId, title: `New Chat ${newId}` }
        setChatHistories([newChat, ...chatHistories])
        setSelectedChat(newId)
        // Focus input after state updates
        setTimeout(() => {
            chatInterfaceRef.current?.focusInput()
        }, 0)
        return newId
    }, [chatHistories])

    // On mount, if no chat is selected, create and select a new chat and focus input
    useEffect(() => {
        if (!selectedChat) {
            addChat()
        }
    }, [selectedChat, addChat])

    // Focus input when chat is selected
    useEffect(() => {
        if (selectedChat) {
            setTimeout(() => {
                chatInterfaceRef.current?.focusInput()
            }, 0)
        }
    }, [selectedChat])

    // Listen for chat title update events
    useEffect(() => {
        const handleUpdateChatTitle = (event: CustomEvent) => {
            const { chatId, title } = event.detail;
            if (chatId && title) {
                setChatHistories(prev =>
                    prev.map(chat =>
                        chat.id === chatId ? { ...chat, title } : chat
                    )
                );
            }
        };

        // Add event listener
        window.addEventListener('updateChatTitle', handleUpdateChatTitle as EventListener);

        // Clean up
        return () => {
            window.removeEventListener('updateChatTitle', handleUpdateChatTitle as EventListener);
        };
    }, []);

    // Custom handler to always focus input on tab click
    const handleSelectChat = useCallback((chatId: string) => {
        setSelectedChat(prev => {
            if (prev !== chatId) {
                return chatId;
            } else {
                // If re-clicking the same tab, still focus input
                setTimeout(() => {
                    chatInterfaceRef.current?.focusInput();
                }, 0);
                return prev;
            }
        });
        // Always focus input (also covers first click)
        setTimeout(() => {
            chatInterfaceRef.current?.focusInput();
        }, 0);
    }, []);

    // Pass addChat to sidebar for use in "New Chat" button
    return (
        <main className="flex min-h-screen">
            <ThemeProvider
                attribute="class"
                defaultTheme="system"
                enableSystem
                disableTransitionOnChange
            >
                <div className="top-5 right-5 z-100 absolute">
                    <ModeToggle />
                </div>
                <SidebarProvider>
                    <div className="mt-6 ml-4">
                        <ChatHistorySidebar
                            onSelectChat={handleSelectChat}
                            selectedChat={selectedChat}
                            chatHistories={chatHistories}
                            setChatHistories={setChatHistories}
                            addChat={addChat}
                        />
                    </div>
                    <div className="flex items-center justify-center flex-1 p-4">
                        <div className="w-full max-w-4xl h-[80vh] shadow-xl rounded-xl overflow-hidden border border-gray-200 dark:border-gray-800 mt-[50px]">
                            <ChatInterface ref={chatInterfaceRef} selectedChatId={selectedChat} />
                        </div>
                    </div>
                </SidebarProvider>
            </ThemeProvider>
        </main>
    )
}
