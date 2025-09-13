"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import ChatInterface, { ChatInterfaceHandle } from "@/components/chat-interface"
// import ChatHistorySidebar from "@/components/user-sidebar"
import { SidebarProvider } from "@/components/ui/sidebar"
import { ThemeProvider } from "@/components/theme-provider"
import { UserDropdown } from "@/components/user-dropdown"
import { Skeleton } from "@/components/ui/skeleton"
// import { ModeToggle } from "@/components/mode-toggle"

// Move initial chat list here
// const initialChatHistories: { id: string; title: string }[] = []

export default function Home() {
    const router = useRouter()
    const supabase = createClient()
    // const [chatHistories, setChatHistories] = useState(initialChatHistories)
    const [selectedChat, setSelectedChat] = useState<string | null>(null)
    const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null)
    const [isLoading, setIsLoading] = useState(true)
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

    // Check authentication on mount
    useEffect(() => {
        const checkAuth = async () => {
            try {
                const { data: { user }, error } = await supabase.auth.getUser()

                if (error || !user) {
                    setIsAuthenticated(false)
                    // Redirect to home page with auth error message
                    router.push('/?auth_required=true')
                } else {
                    setIsAuthenticated(true)
                }
            } catch (error) {
                console.error('Auth check error:', error)
                setIsAuthenticated(false)
                router.push('/?auth_required=true')
            } finally {
                setIsLoading(false)
            }
        }

        checkAuth()
    }, [router, supabase.auth])

    // On mount, if no chat is selected, create and select a new chat and focus input
    useEffect(() => {
        if (!selectedChat && isAuthenticated) {
            // addChat()
            setSelectedChat("1") // Set a default chat ID
        }
    }, [selectedChat, isAuthenticated])

    // Focus input when chat is selected
    useEffect(() => {
        if (selectedChat && isAuthenticated) {
            setTimeout(() => {
                chatInterfaceRef.current?.focusInput()
            }, 0)
        }
    }, [selectedChat, isAuthenticated])

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

    // Show loading state while checking authentication
    if (isLoading) {
        return (
            <main className="flex min-h-screen relative overflow-hidden">
                <ThemeProvider
                    attribute="class"
                    defaultTheme="light"
                    enableSystem={false}
                    forcedTheme="light"
                    disableTransitionOnChange
                >
                    <div className="flex items-center justify-center flex-1 p-4">
                        <div className="w-full max-w-5xl shadow-xl rounded-xl overflow-hidden border border-border mt-[50px] h-[88vh]">
                            <div className="bg-gradient-to-r from-muted to-muted border-b border-border p-4 text-center">
                                <Skeleton className="h-8 w-32 mx-auto mb-2" />
                                <Skeleton className="h-4 w-48 mx-auto" />
                            </div>
                            <div className="p-8 space-y-4">
                                <Skeleton className="h-4 w-full" />
                                <Skeleton className="h-4 w-3/4" />
                                <Skeleton className="h-4 w-1/2" />
                            </div>
                        </div>
                    </div>
                </ThemeProvider>
            </main>
        )
    }

    // Don't render anything if not authenticated (will redirect)
    if (!isAuthenticated) {
        return null
    }

    // Pass addChat to sidebar for use in "New Chat" button
    return (
        <main className="flex min-h-screen relative overflow-hidden">
            <ThemeProvider
                attribute="class"
                defaultTheme="light"
                enableSystem={false}
                forcedTheme="light"
                disableTransitionOnChange
            >
                <div className="top-5 right-5 absolute z-50 flex items-center gap-2">
                    {/* <ModeToggle /> */}
                    <UserDropdown />
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
                        <div className="w-full max-w-5xl shadow-xl rounded-xl overflow-hidden border border-border mt-[50px] h-[88vh]">
                            {/* Kattal AI Heading */}
                            <div className="bg-gradient-to-r from-muted to-muted border-b border-border p-4 text-center">
                                <h1 className="text-3xl font-bold tracking-wide text-foreground">Kattal AI</h1>
                                <p className="text-muted-foreground text-sm mt-1">Your Intelligent Assistant</p>
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
