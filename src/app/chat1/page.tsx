"use client"

import { useState } from "react"
import ChatInterface from "@/components/chat-interface"
import UserSidebar from "@/components/user-sidebar"
import { SidebarProvider } from "@/components/ui/sidebar"
import { ThemeProvider } from "@/components/theme-provider"
import { ModeToggle } from "@/components/mode-toggle";

export default function Home() {
    const [selectedUser, setSelectedUser] = useState<string | null>(null)

    return (
        <main className="flex min-h-screen">
            <ThemeProvider
                attribute="class"
                defaultTheme="system"
                enableSystem
                disableTransitionOnChange
            >
                <div className="top-6 right-6 absolute z-50">
                    <ModeToggle />
                </div>
                <SidebarProvider>
                    <UserSidebar onSelectUser={setSelectedUser} selectedUser={selectedUser} />
                    <div className="flex items-center justify-center flex-1 p-4">
                        <div className="w-full max-w-4xl h-[80vh] shadow-xl rounded-xl overflow-hidden border border-gray-200 dark:border-gray-800">
                            <ChatInterface selectedUser={selectedUser} />
                        </div>
                    </div>
                </SidebarProvider>
            </ThemeProvider>
        </main>
    )
}
