"use client"

import ReactMarkdown from 'react-markdown'
import { cn } from '@/lib/utils'

interface MarkdownRendererProps {
    content: string
    className?: string
}

export function MarkdownRenderer({ content, className }: MarkdownRendererProps) {
    return (
        <div className={cn("prose prose-sm max-w-none dark:prose-invert", className)}>
            <ReactMarkdown
                components={{
                    // Customize heading styles
                    h1: ({ children }) => {
                        return <h1 className="text-xl font-bold mb-2 mt-4 first:mt-0">{children}</h1>
                    },
                    h2: ({ children }) => {
                        return <h2 className="text-lg font-semibold mb-2 mt-3 first:mt-0">{children}</h2>
                    },
                    h3: ({ children }) => {
                        return <h3 className="text-base font-medium mb-1 mt-2 first:mt-0">{children}</h3>
                    },
                    // Customize paragraph styles
                    p: ({ children }) => {
                        return <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>
                    },
                    // Customize list styles
                    ul: ({ children }) => {
                        return <ul className="list-disc list-inside mb-2 space-y-1">{children}</ul>
                    },
                    ol: ({ children }) => {
                        return <ol className="list-decimal list-inside mb-2 space-y-1">{children}</ol>
                    },
                    li: ({ children }) => {
                        return <li className="leading-relaxed">{children}</li>
                    },
                    // Customize code styles
                    code: ({ children, className }) => {
                        const isInline = !className
                        if (isInline) {
                            return (
                                <code className="bg-muted px-1.5 py-0.5 rounded text-sm font-mono">
                                    {children}
                                </code>
                            )
                        }
                        return (
                            <code className="block bg-muted p-3 rounded-md text-sm font-mono overflow-x-auto whitespace-pre">
                                {children}
                            </code>
                        )
                    },
                    // Customize blockquote styles
                    blockquote: ({ children }) => {
                        return (
                            <blockquote className="border-l-4 border-muted-foreground/20 pl-4 italic mb-2">
                                {children}
                            </blockquote>
                        )
                    },
                    // Customize strong/bold styles
                    strong: ({ children }) => {
                        return <strong className="font-semibold">{children}</strong>
                    },
                    // Customize emphasis/italic styles
                    em: ({ children }) => {
                        return <em className="italic">{children}</em>
                    },
                    // Remove default margins from the wrapper
                    div: ({ children }) => {
                        return <div className="space-y-0">{children}</div>
                    },
                }}
            >
                {content}
            </ReactMarkdown>
        </div>
    )
}