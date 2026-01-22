"use client";

import * as React from "react";
import { User, LogOut } from "lucide-react";
// import { Settings } from "lucide-react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

import { createClient } from "@/lib/supabase/client";
import { useEffect, useState } from "react";

export function UserDropdown() {
    const router = useRouter();
    const [userName, setUserName] = useState<string>("User");
    const supabase = createClient();

    useEffect(() => {
        const getUser = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (user?.user_metadata?.full_name) {
                setUserName(user.user_metadata.full_name.split(' ')[0]);
            } else if (user?.user_metadata?.display_name) {
                setUserName(user.user_metadata.display_name.split(' ')[0]);
            } else if (user?.email) {
                // Fallback to name from email if no metadata
                setUserName(user.email.split('@')[0]);
            }
        };
        getUser();
    }, [supabase]);

    const handleLogout = async () => {
        try {
            // Call the signout API
            const response = await fetch('/api/auth/signout', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
            });

            if (response.ok) {
                // Successfully signed out, redirect to home page
                router.push("/");
            } else {
                console.error('Failed to sign out');
                // Redirect anyway for better UX
                router.push("/");
            }
        } catch (error) {
            console.error('Logout error:', error);
            // Redirect anyway for better UX
            router.push("/");
        }
    };

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" className="rounded-full">
                    <Avatar className="h-6 w-6">
                        <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                            <User className="h-3 w-3" />
                        </AvatarFallback>
                    </Avatar>
                    <span className="sr-only">User menu</span>
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-auto min-w-[120px] max-w-[225px]">
                <DropdownMenuLabel>
                    <div className="flex flex-col space-y-1">
                        <p className="text-sm font-medium leading-none">Hello {userName}!</p>
                    </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="text-red-600 focus:text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/20">
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Log out</span>
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
