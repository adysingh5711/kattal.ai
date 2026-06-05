import type { Metadata } from 'next'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://kaattaal.ai.in'

export const metadata: Metadata = {
  title: 'Upload Documents — Kaattaal AI',
  description:
    'Upload PDF documents to Kaattaal AI to add them to the knowledge base. Processed documents become instantly queryable through the AI chat interface.',
  alternates: {
    canonical: '/upload',
  },
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    type: 'website',
    url: `${SITE_URL}/upload`,
    title: 'Upload Documents — Kaattaal AI',
    description:
      'Upload and process PDF documents to extend the Kaattaal AI knowledge base for Kattakada constituency information.',
    images: [{ url: '/logo.png', width: 1200, height: 630, alt: 'Kaattaal AI Upload' }],
  },
}

export default function UploadLayout({ children }: { children: React.ReactNode }) {
  return children
}
