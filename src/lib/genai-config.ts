/**
 * GenAI Configuration for Kaattal AI
 * Comprehensive configuration for AI search engine optimization
 * Including Gemini, Claude, ChatGPT, and Perplexity optimization
 */

export const genaiConfig = {
  // AI Search Engine Support
  supportedAIEngines: [
    'gemini',      // Google Gemini
    'claude',      // Anthropic Claude
    'chatgpt',     // OpenAI ChatGPT
    'perplexity',  // Perplexity AI
    'copilot',     // Microsoft Copilot
    'bard',        // Google Bard (legacy)
    'bing',        // Bing AI
    'duckduckgo'   // DuckDuckGo AI
  ],

  // AI Content Classification
  contentClassification: {
    type: ['educational', 'informational', 'interactive', 'functional'],
    topic: [
      'artificial intelligence',
      'district information',
      'government services',
      'document processing',
      'vector search',
      'RAG system',
      'AI chat interface',
      'knowledge retrieval'
    ],
    complexity: ['intermediate', 'advanced'],
    audience: [
      'government officials',
      'researchers',
      'students',
      'business professionals',
      'general public',
      'content creators',
      'administrators'
    ],
    language: ['english', 'malayalam']
  },

  // AI Features and Capabilities
  aiFeatures: {
    chatInterface: {
      description: 'AI-powered chat interface for document interaction',
      capabilities: ['real-time responses', 'context awareness', 'multi-language support']
    },
    pdfProcessing: {
      description: 'Advanced PDF document processing and analysis',
      capabilities: ['text extraction', 'chunking', 'vector embedding']
    },
    vectorSearch: {
      description: 'Semantic search using vector database',
      capabilities: ['similarity search', 'context retrieval', 'semantic understanding']
    },
    ragSystem: {
      description: 'Retrieval Augmented Generation system',
      capabilities: ['knowledge grounding', 'context-aware responses', 'source attribution']
    }
  },

  // AI Use Cases
  aiUseCases: {
    government: [
      'District information access',
      'Policy document review',
      'Development data analysis',
      'Service discovery',
      'Statistical interpretation'
    ],
    education: [
      'Research support',
      'Document understanding',
      'Knowledge discovery',
      'Learning assistance',
      'Academic analysis'
    ],
    business: [
      'Document analysis',
      'Business intelligence',
      'Compliance review',
      'Knowledge management',
      'Research support'
    ],
    research: [
      'Data interpretation',
      'Document analysis',
      'Knowledge retrieval',
      'Context understanding',
      'Information synthesis'
    ]
  },

  // AI Technology Stack
  technologyStack: {
    frontend: ['Next.js', 'React', 'TypeScript', 'Tailwind CSS'],
    backend: ['Node.js', 'LangChain', 'OpenAI API'],
    database: ['Pinecone', 'Vector Database'],
    ai: ['OpenAI GPT', 'Embeddings', 'RAG Pipeline'],
    deployment: ['Vercel', 'Serverless'],
    monitoring: ['Vercel Analytics', 'Performance Monitoring']
  },

  // AI Performance Metrics
  performanceMetrics: {
    responseTime: 'Real-time (< 2 seconds)',
    accuracy: 'High (> 90%)',
    scalability: 'Enterprise-grade',
    reliability: '99.9% uptime',
    availability: '24/7 global access'
  },

  // AI-Specific Meta Tags
  aiMetaTags: {
    // General AI
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

    // AI Summary
    'ai:summary': 'Kaattal AI is an advanced AI-powered platform that enables users to chat with PDF documents to instantly understand district information, development data, and government services using natural language processing and vector search technology.',
    'ai:capabilities': 'PDF document processing, AI chat interface, vector search, knowledge retrieval, multi-language support, real-time responses',
    'ai:benefits': 'Instant access to district information, AI-powered document understanding, efficient knowledge discovery, user-friendly interface, scalable solution',
    'ai:applications': 'Government services, research analysis, educational institutions, business intelligence, policy understanding'
  },

  // AI Search Engine Specific Tags
  aiEngineTags: {
    gemini: {
      'gemini:content-type': 'educational,informational,interactive',
      'gemini:topic': 'artificial intelligence,district information,government services',
      'gemini:complexity': 'intermediate,advanced',
      'gemini:audience': 'government officials,researchers,students,business professionals'
    },
    claude: {
      'claude:content-type': 'educational,informational,interactive',
      'claude:topic': 'artificial intelligence,district information,government services',
      'claude:complexity': 'intermediate,advanced',
      'claude:audience': 'government officials,researchers,students,business professionals'
    },
    chatgpt: {
      'chatgpt:content-type': 'educational,informational,interactive',
      'chatgpt:topic': 'artificial intelligence,district information,government services',
      'chatgpt:complexity': 'intermediate,advanced',
      'chatgpt:audience': 'government officials,researchers,students,business professionals'
    },
    perplexity: {
      'perplexity:content-type': 'educational,informational,interactive',
      'perplexity:topic': 'artificial intelligence,district information,government services',
      'perplexity:complexity': 'intermediate,advanced',
      'perplexity:audience': 'government officials,researchers,students,business professionals'
    }
  },

  // AI Content Strategy
  contentStrategy: {
    // Content Types for AI
    contentTypes: {
      educational: {
        description: 'Educational content about AI, districts, and government services',
        targetAI: 'all',
        priority: 'high'
      },
      informational: {
        description: 'Informational content about features and capabilities',
        targetAI: 'all',
        priority: 'high'
      },
      interactive: {
        description: 'Interactive elements like chat interface and uploads',
        targetAI: 'all',
        priority: 'medium'
      },
      functional: {
        description: 'Functional content about how to use the platform',
        targetAI: 'all',
        priority: 'medium'
      }
    },

    // AI-Friendly Content Guidelines
    guidelines: [
      'Use clear, descriptive language',
      'Include relevant keywords naturally',
      'Provide context and examples',
      'Structure content logically',
      'Use headings and subheadings',
      'Include relevant links',
      'Provide comprehensive information',
      'Use consistent terminology'
    ]
  },

  // AI Monitoring and Analytics
  aiAnalytics: {
    metrics: [
      'AI search engine visibility',
      'AI-generated content performance',
      'AI user engagement',
      'AI search rankings',
      'AI content discovery'
    ],
    tools: [
      'Google Search Console',
      'Bing Webmaster Tools',
      'AI-specific analytics',
      'Performance monitoring',
      'User behavior analysis'
    ]
  }
};

/**
 * Generate AI-specific meta tags for a page
 */
export function generateAIMetaTags(
  page: 'home' | 'chat' | 'upload',
  customTags?: Record<string, string>
) {
  const baseTags = genaiConfig.aiMetaTags;
  const engineTags = Object.values(genaiConfig.aiEngineTags).flatMap(tags => tags);

  const pageSpecificTags = {
    home: {
      'ai:page-type': 'landing',
      'ai:primary-function': 'information',
      'ai:content-focus': 'overview,features,benefits'
    },
    chat: {
      'ai:page-type': 'interactive',
      'ai:primary-function': 'chat interface',
      'ai:content-focus': 'document interaction,AI responses'
    },
    upload: {
      'ai:page-type': 'functional',
      'ai:primary-function': 'document upload',
      'ai:content-focus': 'file processing,AI ingestion'
    }
  };

  return {
    ...baseTags,
    ...engineTags,
    ...pageSpecificTags[page],
    ...customTags
  };
}

/**
 * Generate AI-optimized content recommendations
 */
export function generateAIContentRecommendations(page: 'home' | 'chat' | 'upload') {
  const recommendations: Record<'home' | 'chat' | 'upload', string[]> = {
    home: [
      'Include comprehensive feature descriptions',
      'Add use case examples',
      'Provide technology stack details',
      'Include audience targeting information',
      'Add performance metrics'
    ],
    chat: [
      'Explain chat interface capabilities',
      'Describe AI response quality',
      'Include interaction examples',
      'Add feature highlights',
      'Provide usage instructions'
    ],
    upload: [
      'Explain upload process',
      'Describe supported formats',
      'Include processing details',
      'Add feature benefits',
      'Provide technical specifications'
    ]
  };

  return recommendations[page];
}

export default genaiConfig;
