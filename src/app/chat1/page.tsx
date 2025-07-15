"use client"

import { useState } from "react"
import ChatInterface from "@/components/chat-interface"
import ChatHistorySidebar from "@/components/user-sidebar"
import { SidebarProvider } from "@/components/ui/sidebar"
import { ThemeProvider } from "@/components/theme-provider"
import { ModeToggle } from "@/components/mode-toggle";

export default function Home() {
    const [selectedChat, setSelectedChat] = useState<string | null>(null)

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
                    <div className="mt-6">
                        <ChatHistorySidebar onSelectChat={setSelectedChat} selectedChat={selectedChat} />
                    </div>
                    <div className="flex items-center justify-center flex-1 p-4">
                        <div className="w-full max-w-4xl h-[80vh] shadow-xl rounded-xl overflow-hidden border border-gray-200 dark:border-gray-800 mt-[50px]">
                            <ChatInterface selectedChatId={selectedChat} />
                        </div>
                    </div>
                </SidebarProvider>
            </ThemeProvider>
        </main>
    )
}
