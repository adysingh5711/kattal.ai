"use client"

import { useState, useEffect, useRef } from "react"
import ChatInterface, { ChatInterfaceHandle } from "@/components/chat-interface"
// import ChatHistorySidebar from "@/components/user-sidebar"
import { SidebarProvider } from "@/components/ui/sidebar"
import { ThemeProvider } from "@/components/theme-provider"
import { ModeToggle } from "@/components/mode-toggle"

// Move initial chat list here
// const initialChatHistories: { id: string; title: string }[] = []

export default function Home() {
    // const [chatHistories, setChatHistories] = useState(initialChatHistories)
    const [selectedChat, setSelectedChat] = useState<string | null>(null)
    const chatInterfaceRef = useRef<ChatInterfaceHandle>(null)

    // Add chat and select it, then focus input
    // const addChat = useCallback(() => {
    //     const newId = (Math.max(0, ...chatHistories.map(c => parseInt(c.id))) + 1).toString()
    //     const newChat = { id: newId, title: `New Chat ${newId}` }
    //     setChatHistories([newChat, ...chatHistories])
    //     setSelectedChat(newId)
    //     // Focus input after state updates
    //     setTimeout(() => {
    //         chatInterfaceRef.current?.focusInput()
    //     }, 0)
    //     return newId
    // }, [chatHistories])

    // On mount, if no chat is selected, create and select a new chat and focus input
    useEffect(() => {
        if (!selectedChat) {
            // addChat()
            setSelectedChat("1") // Set a default chat ID
        }
    }, [selectedChat])

    // Focus input when chat is selected
    useEffect(() => {
        if (selectedChat) {
            setTimeout(() => {
                chatInterfaceRef.current?.focusInput()
            }, 0)
        }
    }, [selectedChat])

    // Listen for chat title update events
    // useEffect(() => {
    //     const handleUpdateChatTitle = (event: CustomEvent) => {
    //         const { chatId, title } = event.detail;
    //         if (chatId && title) {
    //             setChatHistories(prev =>
    //                 prev.map(chat =>
    //                     chat.id === chatId ? { ...chat, title } : chat
    //                 )
    //             );
    //         }
    //     };

    //     // Add event listener
    //     window.addEventListener('updateChatTitle', handleUpdateChatTitle as EventListener);

    //     // Clean up
    //     return () => {
    //         window.removeEventListener('updateChatTitle', handleUpdateChatTitle as EventListener);
    //     };
    // }, []);

    // Custom handler to always focus input on tab click
    // const handleSelectChat = useCallback((chatId: string) => {
    //     setSelectedChat(prev => {
    //         if (prev !== chatId) {
    //             return chatId;
    //         } else {
    //             // If re-clicking the same tab, still focus input
    //             setTimeout(() => {
    //                 chatInterfaceRef.current?.focusInput();
    //             }, 0);
    //             return prev;
    //         }
    //     });
    //     // Always focus input (also covers first click)
    //     setTimeout(() => {
    //         chatInterfaceRef.current?.focusInput();
    //     }, 0);
    // }, []);

    // Pass addChat to sidebar for use in "New Chat" button
    return (
        <main className="flex min-h-screen relative overflow-hidden">
            <ThemeProvider
                attribute="class"
                defaultTheme="light"
                enableSystem={false}
                disableTransitionOnChange
            >
                <div className="top-5 right-5 absolute z-50">
                    <ModeToggle />
                </div>
                <SidebarProvider>
                    {/* <div className="mt-6 ml-4 z-10">
                        <ChatHistorySidebar
                            onSelectChat={handleSelectChat}
                            selectedChat={selectedChat}
                            chatHistories={chatHistories}
                            setChatHistories={setChatHistories}
                            addChat={addChat}
                        />
                    </div> */}
                    <div className="flex items-center justify-center flex-1 p-4 z-10">
                        <div className="w-full max-w-5xl shadow-xl rounded-xl overflow-hidden border border-gray-200 dark:border-gray-800 mt-[50px] h-[88vh]">
                            {/* Kaattak AI Heading */}
                            <div className="bg-gradient-to-r from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-700 border-b border-slate-200 dark:border-slate-700 p-4 text-center">
                                <h1 className="text-3xl font-bold tracking-wide text-slate-800 dark:text-slate-100">Kaattak AI</h1>
                                <p className="text-slate-600 dark:text-slate-300 text-sm mt-1">Your Intelligent Assistant</p>
                            </div>
                            {/* Chat Interface Container */}
                            <div className="h-[calc(100%-80px)]">
                                <ChatInterface ref={chatInterfaceRef} selectedChatId={selectedChat} />
                            </div>
                        </div>
                    </div>
                </SidebarProvider>
            </ThemeProvider>
        </main>
    )
}
