"use client"

import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkBreaks from 'remark-breaks'
import rehypeHighlight from 'rehype-highlight'
import rehypeRaw from 'rehype-raw'
import rehypeSanitize from 'rehype-sanitize'
import { cn } from '@/lib/utils'
import { ExternalLink, Copy, Check } from 'lucide-react'
import { useState } from 'react'

// Import highlight.js styles
import 'highlight.js/styles/github.css'
import 'highlight.js/styles/github-dark.css'

interface MarkdownRendererProps {
    content: string
    className?: string
}

// Copy to clipboard component for code blocks
function CopyButton({ code }: { code: string }) {
    const [copied, setCopied] = useState(false)

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(code)
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
        } catch (err) {
            console.error('Failed to copy code:', err)
        }
    }

    return (
        <button
            onClick={handleCopy}
            className="absolute top-2 right-2 p-1.5 rounded-md bg-muted hover:bg-muted/80 transition-colors opacity-0 group-hover:opacity-100"
            title={copied ? 'Copied!' : 'Copy code'}
        >
            {copied ? (
                <Check className="h-3 w-3 text-green-600" />
            ) : (
                <Copy className="h-3 w-3" />
            )}
        </button>
    )
}

export function MarkdownRenderer({ content, className }: MarkdownRendererProps) {
    return (
        <div className={cn("prose prose-sm max-w-none dark:prose-invert", className)}>
            <ReactMarkdown
                remarkPlugins={[remarkGfm, remarkBreaks]}
                rehypePlugins={[
                    rehypeRaw,
                    rehypeSanitize, // Use default configuration
                    [rehypeHighlight, {
                        detect: true,
                        ignoreMissing: true,
                        subset: false
                    }]
                ]}
                components={{
                    // Enhanced heading styles with anchors
                    h1: ({ children, ...props }) => {
                        return (
                            <h1 className="text-xl font-bold mb-3 mt-6 first:mt-0 border-b border-border pb-2" {...props}>
                                {children}
                            </h1>
                        )
                    },
                    h2: ({ children, ...props }) => {
                        return (
                            <h2 className="text-lg font-semibold mb-2 mt-5 first:mt-0 border-b border-border/50 pb-1" {...props}>
                                {children}
                            </h2>
                        )
                    },
                    h3: ({ children, ...props }) => {
                        return (
                            <h3 className="text-base font-medium mb-2 mt-4 first:mt-0" {...props}>
                                {children}
                            </h3>
                        )
                    },
                    h4: ({ children, ...props }) => {
                        return (
                            <h4 className="text-sm font-medium mb-1 mt-3 first:mt-0" {...props}>
                                {children}
                            </h4>
                        )
                    },
                    h5: ({ children, ...props }) => {
                        return (
                            <h5 className="text-sm font-medium mb-1 mt-2 first:mt-0" {...props}>
                                {children}
                            </h5>
                        )
                    },
                    h6: ({ children, ...props }) => {
                        return (
                            <h6 className="text-xs font-medium mb-1 mt-2 first:mt-0" {...props}>
                                {children}
                            </h6>
                        )
                    },
                    // Enhanced paragraph styles
                    p: ({ children }) => {
                        return <p className="mb-3 last:mb-0 leading-relaxed">{children}</p>
                    },
                    // Enhanced list styles
                    ul: ({ children }) => {
                        return <ul className="list-disc list-inside mb-3 space-y-1 ml-2">{children}</ul>
                    },
                    ol: ({ children }) => {
                        return <ol className="list-decimal list-inside mb-3 space-y-1 ml-2">{children}</ol>
                    },
                    li: ({ children, ...props }) => {
                        return <li className="leading-relaxed" {...props}>{children}</li>
                    },
                    // Enhanced code styles with copy button
                    code: ({ children, className, ...props }) => {
                        const isInline = !className
                        if (isInline) {
                            return (
                                <code className="bg-muted px-1.5 py-0.5 rounded text-sm font-mono border" {...props}>
                                    {children}
                                </code>
                            )
                        }

                        const codeString = String(children).replace(/\n$/, '')
                        return (
                            <div className="relative group my-3">
                                <pre className="bg-muted p-4 rounded-lg text-sm font-mono overflow-x-auto border">
                                    <code className={className} {...props}>
                                        {children}
                                    </code>
                                </pre>
                                <CopyButton code={codeString} />
                            </div>
                        )
                    },
                    // Enhanced blockquote styles
                    blockquote: ({ children }) => {
                        return (
                            <blockquote className="border-l-4 border-primary/30 pl-4 py-2 my-3 bg-muted/30 rounded-r-md italic">
                                {children}
                            </blockquote>
                        )
                    },
                    // Enhanced table styles - simplified to work with prose
                    table: ({ children }) => {
                        return (
                            <div className="overflow-x-auto my-4">
                                <table className="min-w-full">
                                    {children}
                                </table>
                            </div>
                        )
                    },
                    // Enhanced link styles
                    a: ({ children, href, ...props }) => {
                        const isExternal = href?.startsWith('http')
                        return (
                            <a
                                href={href}
                                className="text-primary hover:text-primary/80 underline underline-offset-2 inline-flex items-center gap-1"
                                target={isExternal ? '_blank' : undefined}
                                rel={isExternal ? 'noopener noreferrer' : undefined}
                                {...props}
                            >
                                {children}
                                {isExternal && <ExternalLink className="h-3 w-3" />}
                            </a>
                        )
                    },
                    // Enhanced strong/bold styles
                    strong: ({ children }) => {
                        return <strong className="font-semibold text-foreground">{children}</strong>
                    },
                    // Enhanced emphasis/italic styles
                    em: ({ children }) => {
                        return <em className="italic">{children}</em>
                    },
                    // Enhanced horizontal rule
                    hr: () => {
                        return <hr className="my-6 border-border" />
                    },
                    // Task list items (from GFM)
                    input: ({ type, checked, ...props }) => {
                        if (type === 'checkbox') {
                            return (
                                <input
                                    type="checkbox"
                                    checked={checked}
                                    readOnly
                                    className="mr-2 accent-primary"
                                    {...props}
                                />
                            )
                        }
                        return <input type={type} {...props} />
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