"use client"

import { useState } from "react"
import { Users, Plus, Pencil } from "lucide-react"
import { Button } from "./ui/button"
// import { Badge } from "./ui/badge"
import {
    Sidebar,
    SidebarContent,
    // SidebarFooter,
    SidebarGroup,
    SidebarGroupContent,
    SidebarGroupLabel,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    // SidebarRail,
    SidebarTrigger,
} from "./ui/sidebar"
import { ThemeProvider } from "@/components/theme-provider"
import { ScrollArea } from "./ui/scroll-area";

// Sample chat history data
const initialChatHistories = [
    {
        id: "1",
        title: "Emma Thompson"
    },
    {
        id: "2",
        title: "James Wilson"
    },
    {
        id: "3",
        title: "Sophia Martinez"
    },
    {
        id: "4",
        title: "Liam Johnson"
    },
    {
        id: "5",
        title: "Olivia Davis"
    },
]

type ChatHistorySidebarProps = {
    onSelectChat: (chatId: string) => void
    selectedChat: string | null
}

export default function ChatHistorySidebar({ onSelectChat, selectedChat }: ChatHistorySidebarProps) {
    const [chatHistories, setChatHistories] = useState(initialChatHistories)
    const [searchQuery] = useState("")
    const [editingId, setEditingId] = useState<string | null>(null)
    const [editValue, setEditValue] = useState("")

    const filteredChats = chatHistories.filter((chat) => chat.title.toLowerCase().includes(searchQuery.toLowerCase()))

    const handleAddChat = () => {
        const newId = (Math.max(0, ...chatHistories.map(c => parseInt(c.id))) + 1).toString()
        const newChat = { id: newId, title: `New Chat ${newId}` }
        setChatHistories([newChat, ...chatHistories])
        setEditingId(newId)
        setEditValue(newChat.title)
    }

    const handleRename = (id: string) => {
        setChatHistories(chats => chats.map(chat => chat.id === id ? { ...chat, title: editValue } : chat))
        setEditingId(null)
    }

    return (
        <div>
            <ThemeProvider
                attribute="class"
                defaultTheme="system"
                enableSystem
                disableTransitionOnChange
            >
                <Sidebar>
                    <SidebarHeader>
                        <div className="flex items-center justify-between p-2">
                            <div className="flex items-center gap-2">
                                <Users className="w-5 h-5" />
                                <h2 className="font-semibold">Trivandrum Chat</h2>
                            </div>
                            <SidebarTrigger />
                            <Button variant="ghost" size="icon" className="rounded-full" onClick={handleAddChat}>
                                <Plus className="w-5 h-5" />
                            </Button>
                        </div>
                        {/* <div className="px-2 pb-2">
                    <div className="relative">
                        <Search className="left-2 top-1/2 text-muted-foreground absolute w-4 h-4 -translate-y-1/2" />
                        <Input
                            placeholder="Search users..."
                            className="pl-8"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                </div> */}
                    </SidebarHeader>

                    <SidebarContent className="flex-1 h-full p-0">
                        <ScrollArea className="h-full p-4">
                            <SidebarGroup>
                                <SidebarGroupLabel>Recent Chat History</SidebarGroupLabel>
                                <SidebarGroupContent>
                                    <SidebarMenu>
                                        {filteredChats.map((chat) => (
                                            <SidebarMenuItem key={chat.id}>
                                                <SidebarMenuButton asChild isActive={selectedChat === chat.id} onClick={() => onSelectChat(chat.id)}>
                                                    <div className="flex items-center w-full gap-3">
                                                        {editingId === chat.id ? (
                                                            <input
                                                                className="font-medium truncate border rounded px-1 py-0.5 w-full"
                                                                value={editValue}
                                                                autoFocus
                                                                onChange={e => setEditValue(e.target.value)}
                                                                onBlur={() => handleRename(chat.id)}
                                                                onKeyDown={e => {
                                                                    if (e.key === "Enter") handleRename(chat.id)
                                                                    if (e.key === "Escape") setEditingId(null)
                                                                }}
                                                                placeholder="Rename chat title"
                                                                aria-label="Rename chat title"
                                                            />
                                                        ) : (
                                                            <>
                                                                <span className="font-medium truncate">{chat.title}</span>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    className="p-1 ml-auto rounded-full"
                                                                    tabIndex={-1}
                                                                    onClick={e => {
                                                                        e.stopPropagation()
                                                                        setEditingId(chat.id)
                                                                        setEditValue(chat.title)
                                                                    }}
                                                                >
                                                                    <Pencil className="w-4 h-4" />
                                                                </Button>
                                                            </>
                                                        )}
                                                    </div>
                                                </SidebarMenuButton>
                                            </SidebarMenuItem>
                                        ))}
                                    </SidebarMenu>
                                </SidebarGroupContent>
                            </SidebarGroup>
                        </ScrollArea>
                    </SidebarContent>
                </Sidebar>
                <SidebarTrigger />
            </ThemeProvider>
        </div >
    )
}
