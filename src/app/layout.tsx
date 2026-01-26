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
  title: "Kaattaal AI - Know All about Kattakada LAC Instantly | India's First AI Powered LAC Information System",
  description: "Kaattaal AI is India's First AI Powered LAC Information System developed by PACE Tech as per the ideology of Adv. I.B.Satheesh MLA for Kattakada Legislative Assembly Constituency.",
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
  authors: [{ name: "Kaattaal AI Team" }],
  creator: "Kaattaal AI",
  publisher: "Kaattaal AI",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  metadataBase: new URL(env.NEXT_PUBLIC_SITE_URL || 'https://kaattaal.ai.in'),
  alternates: {
    canonical: '/',
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: env.NEXT_PUBLIC_SITE_URL || 'https://kaattaal.ai.in',
    title: 'Kaattaal AI - Know All about Kattakada LAC Instantly',
    description: "Kaattaal AI is India's First AI Powered LAC Information System developed by PACE Tech as per the ideology of Adv. I.B.Satheesh MLA for Kattakada Legislative Assembly Constituency.",
    siteName: 'Kaattaal AI',
    images: [
      {
        url: '/logo.png',
        width: 1200,
        height: 630,
        alt: 'Kaattaal AI - Know All about Kattakada LAC Instantly',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Kaattaal AI - Know All about Kattakada LAC Instantly',
    description: "Kaattaal AI is India's First AI Powered LAC Information System developed by PACE Tech as per the ideology of Adv.I.B.Satheesh MLA for Kattakada Legislative Assembly Constituency.",
    images: ['/logo.png'],
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
      url: '/favicon-32x32.png',
    },
    {
      rel: 'icon',
      type: 'image/png',
      sizes: '16x16',
      url: '/favicon-16x16.png',
    },
    {
      rel: 'apple-touch-icon',
      sizes: '180x180',
      url: '/apple-touch-icon.png',
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
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Kaattaal AI" />
        <meta name="application-name" content="Kaattaal AI" />
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
        <meta name="ai:summary" content="Kaattaal AI is an advanced AI-powered platform that enables users to chat with PDF documents to instantly understand district information, development data, and government services using natural language processing and vector search technology." />
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
