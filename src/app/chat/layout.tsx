import type { Metadata } from 'next'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://kaattaal.ai.in'

export const metadata: Metadata = {
  title: 'Kaattaal AI Chat — Ask About Kattakada Constituency',
  description:
    'Chat with Kaattaal AI to instantly get information about Kattakada LAC — government services, development projects, welfare schemes, and constituency statistics. Answers in English or Malayalam.',
  alternates: {
    canonical: '/chat',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-snippet': -1,
      'max-image-preview': 'large',
    },
  },
  openGraph: {
    type: 'website',
    url: `${SITE_URL}/chat`,
    title: 'Kaattaal AI Chat — Ask About Kattakada Constituency',
    description:
      'Get instant AI-powered answers about Kattakada LAC — government services, development data, and constituency information in English or Malayalam.',
    images: [{ url: '/logo.png', width: 1200, height: 630, alt: 'Kaattaal AI Chat' }],
  },
}

export default function ChatLayout({ children }: { children: React.ReactNode }) {
  return children
}
