import Script from 'next/script'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://kaattaal.ai.in'

const organizationSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "Kaattaal AI",
  "url": SITE_URL,
  "logo": {
    "@type": "ImageObject",
    "url": `${SITE_URL}/logo.png`,
    "width": 512,
    "height": 512
  },
  "description": "India's First AI Powered LAC Information System for Kattakada Legislative Assembly Constituency, developed by PACE Tech as per the ideology of Adv. I.B. Satheesh MLA.",
  "foundingDate": "2026",
  "sameAs": [
    "https://x.com/singhaditya5711",
    "https://linkedin.com/in/singhaditya5711",
    "https://www.youtube.com/@singhaditya5711"
  ],
  "knowsAbout": [
    "Kattakada Legislative Assembly Constituency",
    "Kerala Government Services",
    "District Development Data",
    "Artificial Intelligence",
    "Natural Language Processing"
  ],
  "areaServed": {
    "@type": "AdministrativeArea",
    "name": "Kattakada Legislative Assembly Constituency",
    "containedIn": {
      "@type": "State",
      "name": "Kerala",
      "containedIn": {
        "@type": "Country",
        "name": "India"
      }
    }
  }
}

const webApplicationSchema = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  "name": "Kaattaal AI",
  "description": "Kaattaal AI is India's First AI Powered LAC Information System. Ask questions about Kattakada constituency in plain English or Malayalam and get instant, accurate answers from official documents.",
  "url": SITE_URL,
  "applicationCategory": "GovernmentApplication",
  "operatingSystem": "Web Browser",
  "browserRequirements": "Requires JavaScript. Requires HTML5.",
  "softwareVersion": "1.0.0",
  "inLanguage": ["en", "ml"],
  "offers": {
    "@type": "Offer",
    "price": "0",
    "priceCurrency": "INR",
    "availability": "https://schema.org/InStock"
  },
  "featureList": [
    "AI-powered natural language chat interface",
    "PDF and document processing",
    "Vector search and semantic retrieval",
    "Malayalam and English language support",
    "Responsive design for all devices",
    "Dark and light mode"
  ],
  "screenshot": `${SITE_URL}/kattal.png`,
  "author": {
    "@type": "Organization",
    "name": "PACE Tech",
    "url": SITE_URL
  },
  "publisher": {
    "@type": "Organization",
    "name": "Kaattaal AI",
    "url": SITE_URL
  },
  "about": [
    {
      "@type": "GovernmentService",
      "name": "Kattakada LAC Information",
      "description": "Access to government services, development data, and constituency information for Kattakada Legislative Assembly Constituency"
    },
    {
      "@type": "Thing",
      "name": "Retrieval Augmented Generation (RAG)",
      "description": "AI technology combining vector search with large language models to provide accurate, source-grounded answers"
    }
  ],
  "audience": {
    "@type": "Audience",
    "audienceType": [
      "Residents of Kattakada",
      "Government Officials",
      "Researchers",
      "Students",
      "Journalists"
    ]
  }
}

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "What is Kaattaal AI?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Kaattaal AI is India's first AI-powered LAC (Legislative Assembly Constituency) Information System for Kattakada. It lets citizens instantly access district information, government services, and development statistics by asking questions in plain English or Malayalam."
      }
    },
    {
      "@type": "Question",
      "name": "What information can I access through Kaattaal AI?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "You can access development project data, government service information, infrastructure statistics, welfare scheme details, and constituency-specific records for Kattakada Legislative Assembly Constituency through natural language conversation."
      }
    },
    {
      "@type": "Question",
      "name": "How does Kaattaal AI work?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Kaattaal AI uses Retrieval Augmented Generation (RAG) technology. It processes official documents into a vector database and uses large language models to retrieve and synthesize accurate, source-grounded answers to your questions in real time."
      }
    },
    {
      "@type": "Question",
      "name": "Does Kaattaal AI support Malayalam?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Yes. Kaattaal AI fully supports both English and Malayalam. You can ask questions and receive responses in either language, making constituency information accessible to all residents."
      }
    },
    {
      "@type": "Question",
      "name": "Who developed Kaattaal AI?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Kaattaal AI was developed by PACE Tech as per the ideology of Adv. I.B. Satheesh, MLA for Kattakada Legislative Assembly Constituency, with Trinity as community partner."
      }
    },
    {
      "@type": "Question",
      "name": "Is Kaattaal AI free to use?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Yes, Kaattaal AI is free for all citizens. Create an account with your email or Google account to start asking questions about Kattakada."
      }
    }
  ]
}

export default function StructuredData() {
  return (
    <>
      <Script
        id="structured-data-org"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
      />
      <Script
        id="structured-data-app"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(webApplicationSchema) }}
      />
      <Script
        id="structured-data-faq"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
    </>
  )
}
