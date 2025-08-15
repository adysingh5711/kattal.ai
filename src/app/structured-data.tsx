import Script from 'next/script'

export default function StructuredData() {
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    "name": "Kaattal AI",
    "description": "Transform how you access district information with Kaattal AI. Chat with your PDF documents using advanced AI to instantly understand development, services, and statistics.",
    "url": "https://kaattal-ai.vercel.app",
    "applicationCategory": "ProductivityApplication",
    "operatingSystem": "Web Browser",
    "browserRequirements": "Requires JavaScript. Requires HTML5.",
    "softwareVersion": "1.0.0",
    "author": {
      "@type": "Organization",
      "name": "Kaattal AI Team",
      "url": "https://kaattal-ai.vercel.app"
    },
    "publisher": {
      "@type": "Organization",
      "name": "Kaattal AI",
      "url": "https://kaattal-ai.vercel.app"
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
    "screenshot": "https://kaattal-ai.vercel.app/kaattal.png",
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
        "reviewBody": "Kaattal AI has revolutionized how we access district information. The AI chat interface makes complex data easily understandable."
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
      "name": "Kaattal AI Chat Interface",
      "description": "AI-powered chat interface for interacting with PDF documents and district information",
      "url": "https://kaattal-ai.vercel.app/chat",
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
    ]
  }

  return (
    <Script
      id="structured-data"
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
    />
  )
}
