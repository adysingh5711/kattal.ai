"use client"

import { useState } from "react"
import ChatInterface from "@/components/chat-interface"
import UserSidebar from "@/components/user-sidebar"
import { SidebarProvider } from "@/components/ui/sidebar"

export default function Home() {
    const [selectedUser, setSelectedUser] = useState<string | null>(null)

    return (
        <main className="bg-gray-50 flex min-h-screen">
            <SidebarProvider>
                <UserSidebar onSelectUser={setSelectedUser} selectedUser={selectedUser} />
                <div className="flex items-center justify-center flex-1 p-4">
                    <div className="w-full max-w-4xl h-[80vh] shadow-xl rounded-xl overflow-hidden border border-gray-200">
                        <ChatInterface selectedUser={selectedUser} />
                    </div>
                </div>
            </SidebarProvider>
        </main>
    )
}
