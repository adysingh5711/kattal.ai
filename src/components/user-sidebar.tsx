"use client"

import { useState } from "react"
import { Users, Plus } from "lucide-react"
// import {Search, Settings, LogOut } from "lucide-react"
// import { Avatar } from "./ui/avatar"
// import { Input } from "./ui/input"
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
    SidebarRail,
} from "./ui/sidebar"

// Sample user data
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

type UserSidebarProps = {
    onSelectUser: (userId: string) => void
    selectedUser: string | null
}

export default function UserSidebar({ onSelectUser, selectedUser }: UserSidebarProps) {
    const [searchQuery] = useState("")

    const filteredUsers = users.filter((user) => user.name.toLowerCase().includes(searchQuery.toLowerCase()))

    return (
        <Sidebar>
            <SidebarHeader>
                <div className="flex items-center justify-between p-2">
                    <div className="flex items-center gap-2">
                        <Users className="w-5 h-5" />
                        <h2 className="font-semibold">Trivandrum Chat</h2>
                    </div>
                    <Button variant="ghost" size="icon" className="rounded-full">
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

            <SidebarContent>
                <SidebarGroup>
                    <SidebarGroupLabel>Recent Chat History</SidebarGroupLabel>
                    <SidebarGroupContent>
                        <SidebarMenu>
                            {filteredUsers.map((user) => (
                                <SidebarMenuItem key={user.id}>
                                    <SidebarMenuButton asChild isActive={selectedUser === user.id} onClick={() => onSelectUser(user.id)}>
                                        <div className="flex items-center w-full gap-3">
                                            <span className="font-medium truncate">{user.name}</span>
                                        </div>
                                    </SidebarMenuButton>
                                </SidebarMenuItem>
                            ))}
                        </SidebarMenu>
                    </SidebarGroupContent>
                </SidebarGroup>
            </SidebarContent>

            {/* <SidebarFooter>
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton asChild>
                            <div className="flex items-center gap-2">
                                <Settings className="w-5 h-5" />
                                <span>Settings</span>
                            </div>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                        <SidebarMenuButton asChild>
                            <div className="flex items-center gap-2">
                                <LogOut className="w-5 h-5" />
                                <span>Logout</span>
                            </div>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarFooter> */}

            <SidebarRail />
        </Sidebar>
    )
}
