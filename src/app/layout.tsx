import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next"
import StructuredData from "./structured-data";
import { env } from "@/lib/env";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Kattal AI - Know Your District, Instantly | AI-Powered District Information Chat",
  description: "Transform how you access district information with Kattal AI. Chat with your PDF documents using advanced AI to instantly understand development, services, and statistics. Powered by LangChain, Pinecone, and OpenAI.",
  keywords: [
    "AI chat",
    "PDF analysis",
    "district information",
    "government services",
    "document processing",
    "AI assistant",
    "knowledge base",
    "RAG system",
    "vector search",
    "natural language processing",
    "Kerala districts",
    "development data",
    "statistics chat",
    "AI-powered search",
    "generative AI",
    "AI document chat",
    "intelligent search",
    "semantic search",
    "AI knowledge retrieval"
  ],
  authors: [{ name: "Kattal AI Team" }],
  creator: "Kattal AI",
  publisher: "Kattal AI",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  metadataBase: new URL(env.NEXT_PUBLIC_SITE_URL || 'https://kattal-ai.vercel.app'),
  alternates: {
    canonical: '/',
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: env.NEXT_PUBLIC_SITE_URL || 'https://kattal-ai.vercel.app',
    title: 'Kattal AI - Know Your District, Instantly',
    description: 'Transform how you access district information with Kattal AI. Chat with your PDF documents using advanced AI to instantly understand development, services, and statistics.',
    siteName: 'Kattal AI',
    images: [
      {
        url: '/kattal.png',
        width: 1200,
        height: 630,
        alt: 'Kattal AI - AI-Powered District Information Platform',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Kattal AI - Know Your District, Instantly',
    description: 'Transform how you access district information with Kattal AI. Chat with your PDF documents using advanced AI.',
    images: ['/kattal.png'],
    creator: '@kattalai',
    site: '@kattalai',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  verification: {
    google: 'your-google-verification-code',
    yandex: 'your-yandex-verification-code',
    yahoo: 'your-yahoo-verification-code',
  },
  manifest: '/manifest.json',
  icons: [
    {
      rel: 'icon',
      type: 'image/png',
      sizes: '32x32',
      url: '/kattal.png',
    },
    {
      rel: 'icon',
      type: 'image/png',
      sizes: '16x16',
      url: '/kattal.png',
    },
    {
      rel: 'apple-touch-icon',
      type: 'image/png',
      sizes: '180x180',
      url: '/kattal.png',
    },
    {
      rel: 'mask-icon',
      url: '/kattal.png',
      color: '#000000',
    },
  ],
  category: 'technology',
  classification: 'AI-powered information platform',
  other: {
    'msapplication-TileColor': '#000000',
    'theme-color': '#000000',
    // AI Search Engine Optimization
    'ai-search-engine': 'gemini,claude,chatgpt,perplexity',
    'ai-content-type': 'educational,informational,interactive',
    'ai-topic': 'artificial intelligence,district information,government services',
    'ai-complexity': 'intermediate,advanced',
    'ai-audience': 'government officials,researchers,students,business professionals',
    'ai-language-support': 'english,malayalam',
    'ai-features': 'chat interface,PDF processing,vector search,RAG system',
    'ai-use-cases': 'document analysis,information retrieval,knowledge discovery',
    'ai-technology-stack': 'langchain,pinecone,openai,nextjs',
    'ai-performance': 'real-time,responsive,scalable',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=5" />
        <meta name="theme-color" content="#000000" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Kattal AI" />
        <meta name="application-name" content="Kattal AI" />
        <meta name="msapplication-TileColor" content="#000000" />
        <meta name="msapplication-config" content="/browserconfig.xml" />

        {/* AI Search Engine Optimization */}
        <meta name="ai-search-engine" content="gemini,claude,chatgpt,perplexity" />
        <meta name="ai-content-type" content="educational,informational,interactive" />
        <meta name="ai-topic" content="artificial intelligence,district information,government services" />
        <meta name="ai-complexity" content="intermediate,advanced" />
        <meta name="ai-audience" content="government officials,researchers,students,business professionals" />
        <meta name="ai-language-support" content="english,malayalam" />
        <meta name="ai-features" content="chat interface,PDF processing,vector search,RAG system" />
        <meta name="ai-use-cases" content="document analysis,information retrieval,knowledge discovery" />
        <meta name="ai-technology-stack" content="langchain,pinecone,openai,nextjs" />
        <meta name="ai-performance" content="real-time,responsive,scalable" />
        <meta name="ai-developer" content="Aditya Singh" />
        <meta name="ai-developer-linkedin" content="https://linkedin.com/in/singhaditya5711" />

        {/* AI Search Engine Specific Directives */}
        <meta name="gemini:content-type" content="educational,informational,interactive" />
        <meta name="gemini:topic" content="artificial intelligence,district information,government services" />
        <meta name="gemini:complexity" content="intermediate,advanced" />
        <meta name="claude:content-type" content="educational,informational,interactive" />
        <meta name="claude:topic" content="artificial intelligence,district information,government services" />
        <meta name="chatgpt:content-type" content="educational,informational,interactive" />
        <meta name="chatgpt:topic" content="artificial intelligence,district information,government services" />
        <meta name="perplexity:content-type" content="educational,informational,interactive" />
        <meta name="perplexity:topic" content="artificial intelligence,district information,government services" />

        {/* Enhanced AI Understanding */}
        <meta name="ai:summary" content="Kattal AI is an advanced AI-powered platform that enables users to chat with PDF documents to instantly understand district information, development data, and government services using natural language processing and vector search technology." />
        <meta name="ai:capabilities" content="PDF document processing, AI chat interface, vector search, knowledge retrieval, multi-language support, real-time responses" />
        <meta name="ai:benefits" content="Instant access to district information, AI-powered document understanding, efficient knowledge discovery, user-friendly interface, scalable solution" />
        <meta name="ai:applications" content="Government services, research analysis, educational institutions, business intelligence, policy understanding" />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <StructuredData />
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
