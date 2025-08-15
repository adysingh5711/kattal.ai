import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next"
import StructuredData from "./structured-data";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Kaattal AI - Know Your District, Instantly | AI-Powered District Information Chat",
  description: "Transform how you access district information with Kaattal AI. Chat with your PDF documents using advanced AI to instantly understand development, services, and statistics. Powered by LangChain, Pinecone, and OpenAI.",
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
    "AI-powered search"
  ],
  authors: [{ name: "Kaattal AI Team" }],
  creator: "Kaattal AI",
  publisher: "Kaattal AI",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  metadataBase: new URL('https://kaattal-ai.vercel.app'),
  alternates: {
    canonical: '/',
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://kaattal-ai.vercel.app',
    title: 'Kaattal AI - Know Your District, Instantly',
    description: 'Transform how you access district information with Kaattal AI. Chat with your PDF documents using advanced AI to instantly understand development, services, and statistics.',
    siteName: 'Kaattal AI',
    images: [
      {
        url: '/kaattal.png',
        width: 1200,
        height: 630,
        alt: 'Kaattal AI - AI-Powered District Information Platform',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Kaattal AI - Know Your District, Instantly',
    description: 'Transform how you access district information with Kaattal AI. Chat with your PDF documents using advanced AI.',
    images: ['/kaattal.png'],
    creator: '@kaattalai',
    site: '@kaattalai',
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
      url: '/kaattal.png',
    },
    {
      rel: 'icon',
      type: 'image/png',
      sizes: '16x16',
      url: '/kaattal.png',
    },
    {
      rel: 'apple-touch-icon',
      type: 'image/png',
      sizes: '180x180',
      url: '/kaattal.png',
    },
    {
      rel: 'mask-icon',
      url: '/kaattal.png',
      color: '#000000',
    },
  ],
  category: 'technology',
  classification: 'AI-powered information platform',
  other: {
    'msapplication-TileColor': '#000000',
    'theme-color': '#000000',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=5" />
        <meta name="theme-color" content="#000000" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Kaattal AI" />
        <meta name="application-name" content="Kaattal AI" />
        <meta name="msapplication-TileColor" content="#000000" />
        <meta name="msapplication-config" content="/browserconfig.xml" />
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
