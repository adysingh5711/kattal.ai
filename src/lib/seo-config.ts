/**
 * SEO Configuration for Kattal AI
 * Centralized configuration for consistent metadata across the application
 */

import { env } from './env';

export const seoConfig = {
  // Basic Information
  siteName: 'Kattal AI',
  siteDescription: 'Transform how you access district information with Kattal AI. Chat with your PDF documents using advanced AI to instantly understand development, services, and statistics.',
  siteUrl: env.NEXT_PUBLIC_SITE_URL || 'https://kattal-ai.vercel.app',
  siteLanguage: 'en',
  siteLocale: 'en_US',

  // Social Media
  twitterHandle: '@kattalai',
  facebookAppId: 'your-facebook-app-id',

  // Contact Information
  contactEmail: 'support@kattal.ai',
  contactPhone: '+91-XXXXXXXXXX',

  // Business Information
  businessName: 'Kattal AI',
  businessType: 'Technology Company',
  industry: 'Artificial Intelligence',
  foundedYear: '2024',

  // Keywords for different pages
  keywords: {
    home: [
      'AI chat',
      'PDF analysis',
      'district information',
      'government services',
      'document processing',
      'AI assistant',
      'knowledge base',
      'RAG system',
      'vector search',
      'natural language processing',
      'Kerala districts',
      'development data',
      'statistics chat',
      'AI-powered search'
    ],
    chat: [
      'AI chat interface',
      'document chat',
      'PDF chat',
      'intelligent search',
      'semantic search',
      'vector database',
      'AI conversation',
      'document analysis',
      'knowledge retrieval',
      'RAG chat'
    ],
    upload: [
      'PDF upload',
      'document processing',
      'file upload',
      'document analysis',
      'AI processing',
      'vector embedding',
      'knowledge base creation'
    ]
  },

  // Open Graph defaults
  openGraph: {
    type: 'website',
    locale: 'en_US',
    siteName: 'Kattal AI',
    images: [
      {
        url: '/kattal.png',
        width: 1200,
        height: 630,
        alt: 'Kattal AI - AI-Powered District Information Platform',
      }
    ]
  },

  // Twitter Card defaults
  twitter: {
    card: 'summary_large_image',
    creator: '@kattalai',
    site: '@kattalai',
  },

  // Verification codes (replace with actual codes)
  verification: {
    google: 'your-google-verification-code',
    yandex: 'your-yandex-verification-code',
    yahoo: 'your-yahoo-verification-code',
    bing: 'your-bing-verification-code',
  },

  // Analytics and tracking
  analytics: {
    googleAnalytics: 'G-XXXXXXXXXX',
    googleTagManager: 'GTM-XXXXXXX',
    facebookPixel: 'your-facebook-pixel-id',
    hotjar: 'your-hotjar-id',
  },

  // Performance and monitoring
  monitoring: {
    sentry: 'your-sentry-dsn',
    logRocket: 'your-logrocket-id',
    fullStory: 'your-fullstory-id',
  },

  // PWA Configuration
  pwa: {
    name: 'Kattal AI',
    shortName: 'Kattal AI',
    description: 'Know Your District, Instantly',
    themeColor: '#000000',
    backgroundColor: '#ffffff',
    display: 'standalone',
    orientation: 'portrait',
    scope: '/',
    startUrl: '/',
  },

  // Structured Data types
  structuredData: {
    organization: {
      '@type': 'Organization',
      name: 'Kattal AI',
      url: 'https://kattal-ai.vercel.app',
      logo: 'https://kattal-ai.vercel.app/kattal.png',
      sameAs: [
        'https://twitter.com/kattalai',
        'https://linkedin.com/company/kattal-ai',
        'https://github.com/yourusername/kattal-ai'
      ]
    },
    webApplication: {
      '@type': 'WebApplication',
      name: 'Kattal AI',
      description: 'AI-powered district information platform',
      applicationCategory: 'ProductivityApplication',
      operatingSystem: 'Web Browser',
      browserRequirements: 'Requires JavaScript. Requires HTML5.',
      softwareVersion: '1.0.0'
    }
  }
};

/**
 * Generate page-specific SEO metadata
 */
export function generatePageMetadata(
  page: 'home' | 'chat' | 'upload',
  customData?: Partial<typeof seoConfig>
) {
  const config = { ...seoConfig, ...customData };

  return {
    title: `${config.siteName} - ${getPageTitle(page)}`,
    description: getPageDescription(page, config),
    keywords: config.keywords[page].join(', '),
    openGraph: {
      ...config.openGraph,
      title: `${config.siteName} - ${getPageTitle(page)}`,
      description: getPageDescription(page, config),
      url: `${config.siteUrl}${getPagePath(page)}`,
    },
    twitter: {
      ...config.twitter,
      title: `${config.siteName} - ${getPageTitle(page)}`,
      description: getPageDescription(page, config),
    },
    alternates: {
      canonical: `${config.siteUrl}${getPagePath(page)}`,
    },
  };
}

function getPageTitle(page: 'home' | 'chat' | 'upload'): string {
  const titles = {
    home: 'Know Your District, Instantly | AI-Powered District Information Chat',
    chat: 'AI Chat Interface | Chat with Your Documents',
    upload: 'Document Upload | Process PDFs with AI'
  };
  return titles[page];
}

function getPageDescription(page: 'home' | 'chat' | 'upload', config: typeof seoConfig): string {
  const descriptions = {
    home: config.siteDescription,
    chat: 'Interact with your documents using our advanced AI chat interface. Ask questions, get insights, and understand complex information instantly.',
    upload: 'Upload and process your PDF documents with AI. Transform unstructured data into searchable, intelligent knowledge bases.'
  };
  return descriptions[page];
}

function getPagePath(page: 'home' | 'chat' | 'upload'): string {
  const paths = {
    home: '/',
    chat: '/chat',
    upload: '/upload'
  };
  return paths[page];
}

/**
 * Generate JSON-LD structured data for a specific page
 */
export function generateStructuredData(
  page: 'home' | 'chat' | 'upload',
  customData?: any
) {
  const baseData = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: `Kattal AI - ${getPageTitle(page)}`,
    description: getPageDescription(page, seoConfig),
    url: `${seoConfig.siteUrl}${getPagePath(page)}`,
    mainEntity: seoConfig.structuredData.webApplication,
    publisher: seoConfig.structuredData.organization,
    ...customData
  };

  return baseData;
}
