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
    useSidebar,
} from "./ui/sidebar"
import { ThemeProvider } from "@/components/theme-provider"
import { ScrollArea } from "./ui/scroll-area";

type ChatHistorySidebarProps = {
    onSelectChat: (chatId: string) => void
    selectedChat: string | null
    chatHistories: { id: string, title: string }[]
    setChatHistories: (chats: { id: string, title: string }[]) => void
    addChat: () => void
}

export default function ChatHistorySidebar({ onSelectChat, selectedChat, chatHistories, setChatHistories, addChat }: ChatHistorySidebarProps) {
    // Remove internal chatHistories state
    const [searchQuery] = useState("")
    const [editingId, setEditingId] = useState<string | null>(null)
    const [editValue, setEditValue] = useState("")
    const sidebar = useSidebar();

    const filteredChats = chatHistories.filter((chat) => chat.title.toLowerCase().includes(searchQuery.toLowerCase()))

    // Remove handleAddChat, use addChat from props

    const handleRename = (id: string) => {
        setChatHistories(chatHistories.map(chat => chat.id === id ? { ...chat, title: editValue } : chat))
        setEditingId(null)
    }

    const handleNewChat = () => {
        addChat();
        // Close sidebar if on mobile
        if (sidebar.isMobile) {
            sidebar.setOpenMobile(false);
        }
    }

    const handleSelectChat = (chatId: string) => {
        onSelectChat(chatId);
        if (sidebar.isMobile) {
            sidebar.setOpenMobile(false);
        }
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
                                <h2 className="font-semibold">Kattal AI</h2>
                            </div>
                            <SidebarTrigger />
                            <Button variant="ghost" size="icon" className="rounded-full" onClick={handleNewChat}>
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
                                                <SidebarMenuButton asChild isActive={selectedChat === chat.id} onClick={() => handleSelectChat(chat.id)}>
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
