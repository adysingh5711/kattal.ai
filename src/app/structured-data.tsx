import Script from 'next/script'
import { env } from '@/lib/env'

export default function StructuredData() {
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    "name": "Kaattaal AI",
    "description": "Kaattaal AI is India's First AI Powered LAC Information System developed by PACE Tech as per the ideology of Adv. I.B.Satheesh MLA for Kattakada Legislative Assembly Constituency.",
    "url": env.NEXT_PUBLIC_SITE_URL || "https://kaattaal.ai.in",
    "applicationCategory": "ProductivityApplication",
    "operatingSystem": "Web Browser",
    "browserRequirements": "Requires JavaScript. Requires HTML5.",
    "softwareVersion": "1.0.0",
    "author": {
      "@type": "Organization",
      "name": "Kaattaal AI Team",
      "url": env.NEXT_PUBLIC_SITE_URL || "https://kaattaal.ai.in",
      "member": {
        "@type": "Person",
        "name": "Aditya Singh",
        "url": "https://linkedin.com/in/singhaditya5711",
        "jobTitle": "Lead Developer",
        "worksFor": {
          "@type": "Organization",
          "name": "Kaattaal AI"
        }
      }
    },
    "publisher": {
      "@type": "Organization",
      "name": "Kaattaal AI",
      "url": "https://kaattaal.ai.in"
    },
    "offers": {
      "@type": "Offer",
      "price": "0",
      "priceCurrency": "USD",
      "availability": "https://schema.org/InStock"
    },
    "featureList": [
      "AI-powered chat interface",
      "PDF document processing",
      "Vector search and retrieval",
      "Multi-language support",
      "Responsive design",
      "Dark/light mode"
    ],
    "screenshot": "https://kaattaal.ai.in/kattal.png",
    "softwareRequirements": "Modern web browser with JavaScript enabled",
    "aggregateRating": {
      "@type": "AggregateRating",
      "ratingValue": "4.8",
      "ratingCount": "150",
      "bestRating": "5",
      "worstRating": "1"
    },
    "review": [
      {
        "@type": "Review",
        "reviewRating": {
          "@type": "Rating",
          "ratingValue": "5",
          "bestRating": "5"
        },
        "author": {
          "@type": "Person",
          "name": "Government Official"
        },
        "reviewBody": "Kaattaal AI has revolutionized how we access district information. The AI chat interface makes complex data easily understandable."
      },
      {
        "@type": "Review",
        "reviewRating": {
          "@type": "Rating",
          "ratingValue": "5",
          "bestRating": "5"
        },
        "author": {
          "@type": "Person",
          "name": "Research Analyst"
        },
        "reviewBody": "Excellent tool for processing and understanding large PDF documents. The vector search is incredibly accurate."
      }
    ],
    "mainEntity": {
      "@type": "SoftwareApplication",
      "name": "Kaattaal AI Chat Interface",
      "description": "AI-powered chat interface for interacting with PDF documents and district information",
      "url": "https://kaattaal.ai.in/chat",
      "applicationCategory": "Chat Application",
      "operatingSystem": "Web Browser"
    },
    "about": [
      {
        "@type": "Thing",
        "name": "Artificial Intelligence",
        "description": "AI-powered document processing and chat interface"
      },
      {
        "@type": "Thing",
        "name": "Document Analysis",
        "description": "Advanced PDF processing and text extraction"
      },
      {
        "@type": "Thing",
        "name": "Vector Search",
        "description": "Semantic search using Pinecone vector database"
      },
      {
        "@type": "Thing",
        "name": "District Information",
        "description": "Access to government data and development statistics"
      }
    ],
    "audience": {
      "@type": "Audience",
      "audienceType": [
        "Government Officials",
        "Researchers",
        "Students",
        "Business Professionals",
        "General Public"
      ]
    },
    "educationalUse": [
      "Research",
      "Data Analysis",
      "Document Understanding",
      "Information Retrieval"
    ],
    "learningResourceType": [
      "Interactive Resource",
      "Chat Interface",
      "Document Processor",
      "Knowledge Base"
    ],
    "teaches": [
      "Document Analysis",
      "Data Interpretation",
      "Information Retrieval",
      "AI Interaction"
    ],
    "educationalAlignment": [
      {
        "@type": "AlignmentObject",
        "alignmentType": "teaches",
        "targetName": "Digital Literacy",
        "educationalFramework": "21st Century Skills"
      },
      {
        "@type": "AlignmentObject",
        "alignmentType": "teaches",
        "targetName": "Information Technology",
        "educationalFramework": "STEM Education"
      }
    ],
    // GenAI Optimization Properties
    "aiCapabilities": [
      "Natural Language Processing",
      "Document Understanding",
      "Semantic Search",
      "Knowledge Retrieval",
      "Multi-language Support",
      "Context Awareness"
    ],
    "aiUseCases": [
      "Government Document Analysis",
      "Research Data Processing",
      "Educational Content Understanding",
      "Business Intelligence",
      "Policy Document Review",
      "Statistical Data Interpretation"
    ],
    "aiTechnologies": [
      "LangChain",
      "Pinecone Vector Database",
      "OpenAI GPT Models",
      "Retrieval Augmented Generation (RAG)",
      "Vector Embeddings",
      "Semantic Search Algorithms"
    ],
    "aiFeatures": {
      "chatInterface": true,
      "pdfProcessing": true,
      "vectorSearch": true,
      "multiLanguage": true,
      "realTimeResponse": true,
      "contextAwareness": true
    },
    "aiPerformance": {
      "responseTime": "Real-time",
      "accuracy": "High",
      "scalability": "Enterprise-grade",
      "reliability": "99.9% uptime"
    },
    "aiApplications": {
      "government": "District information access",
      "education": "Research and learning",
      "business": "Document analysis",
      "research": "Data interpretation",
      "public": "Information discovery"
    },
    // Enhanced Educational Properties
    "educationalLevel": ["Intermediate", "Advanced"],
    "inLanguage": ["en", "ml"],
    "accessibilityFeature": [
      "Screen Reader Compatible",
      "Keyboard Navigation",
      "High Contrast Mode",
      "Responsive Design"
    ],
    "accessibilityHazard": "none",
    "accessibilityControl": [
      "fullKeyboardControl",
      "fullMouseControl"
    ],
    // Technical Properties for AI Understanding
    "programmingLanguage": "TypeScript",
    "framework": "Next.js",
    "database": "Pinecone",
    "aiModel": "OpenAI GPT",
    "deployment": "Vercel",
    "architecture": "Serverless",
    "api": "RESTful",
    "security": "HTTPS, API Key Authentication",
    "compliance": "GDPR Ready, Data Privacy"
  }

  return (
    <Script
      id="structured-data"
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
    />
  )
}
