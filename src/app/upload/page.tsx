"use client"
import React from "react"
import { FileUpload } from "@/components/ui/file-upload"
import { ThemeProvider } from "@/components/theme-provider"
import { ModeToggle } from "@/components/mode-toggle";
// import { default as LetterGlitch } from "@/components/LetterGlitch/LetterGlitch";


const upload = () => {
    return (
        <div className="overflow-x-clip item-align-center justify-center">
            <ThemeProvider
                attribute="class"
                defaultTheme="system"
                enableSystem
                disableTransitionOnChange
            >
                <div className="top-5 right-5 z-100 absolute">
                    <ModeToggle />
                </div>
                <div className="flex justify-center mt-16">
                    <FileUpload />
                </div>
                {/* <div className="absolute w-full h-full">
                    <LetterGlitch />
                </div> */}
            </ThemeProvider>
        </div>
    )
}

export default upload