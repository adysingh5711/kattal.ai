import type { Metadata } from 'next'
import Script from 'next/script'
import Image from 'next/image'
import Link from 'next/link'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://kaattaal.ai.in'

export const metadata: Metadata = {
  title: 'About Kaattaal AI — India\'s First AI-Powered LAC Information System',
  description:
    'Learn about Kaattaal AI — an initiative by Adv. I.B. Satheesh MLA, developed by PACE Tech, that gives Kattakada residents instant AI-powered access to constituency information, government services, and development data.',
  alternates: {
    canonical: '/about',
  },
  openGraph: {
    type: 'website',
    url: `${SITE_URL}/about`,
    title: 'About Kaattaal AI — India\'s First AI-Powered LAC Information System',
    description:
      'An initiative by Adv. I.B. Satheesh MLA and PACE Tech to make Kattakada constituency information instantly accessible through AI.',
    images: [{ url: '/logo.png', width: 1200, height: 630, alt: 'Kaattaal AI' }],
  },
}

const aboutSchema = {
  "@context": "https://schema.org",
  "@type": "AboutPage",
  "name": "About Kaattaal AI",
  "description": "India's First AI Powered LAC Information System for Kattakada Legislative Assembly Constituency",
  "url": `${SITE_URL}/about`,
  "mainEntity": {
    "@type": "Organization",
    "name": "Kaattaal AI",
    "url": SITE_URL,
    "logo": `${SITE_URL}/logo.png`,
    "foundingDate": "2024",
    "description": "India's First AI Powered LAC Information System, developed by PACE Tech as per the ideology of Adv. I.B. Satheesh MLA for Kattakada Legislative Assembly Constituency.",
    "sameAs": [
      "https://x.com/singhaditya5711",
      "https://linkedin.com/in/singhaditya5711",
      "https://www.youtube.com/@singhaditya5711"
    ],
    "member": [
      {
        "@type": "Person",
        "name": "Adv. I.B. Satheesh",
        "jobTitle": "MLA, Kattakada Legislative Assembly Constituency",
        "sameAs": [
          "https://facebook.com/ibsathishonline",
          "https://instagram.com/ibsathishonline",
          "https://twitter.com/ibsathishonlinee",
          "https://youtube.com/@ibsathishonline"
        ]
      },
      {
        "@type": "Person",
        "name": "Aditya Singh",
        "jobTitle": "Lead Developer",
        "sameAs": [
          "https://linkedin.com/in/singhaditya5711",
          "https://x.com/singhaditya5711",
          "https://www.youtube.com/@singhaditya5711"
        ]
      }
    ]
  }
}

const faqs = [
  {
    q: 'What is Kaattaal AI?',
    a: 'Kaattaal AI is India\'s first AI-powered LAC (Legislative Assembly Constituency) Information System for Kattakada. It lets citizens ask questions in plain English or Malayalam and instantly receive accurate answers sourced from official constituency documents.',
  },
  {
    q: 'What information can I find using Kaattaal AI?',
    a: 'Development project updates, government service details, infrastructure statistics, welfare scheme eligibility, and constituency-specific data for Kattakada LAC — all through a conversational chat interface.',
  },
  {
    q: 'How does the AI work?',
    a: 'Kaattaal AI uses Retrieval Augmented Generation (RAG). Official documents are indexed in a vector database. When you ask a question, the system retrieves the most relevant passages and uses a large language model to generate a clear, accurate answer grounded in the source material.',
  },
  {
    q: 'Does it support Malayalam?',
    a: 'Yes. You can ask questions and receive answers in both English and Malayalam.',
  },
  {
    q: 'Is it free?',
    a: 'Yes. Kaattaal AI is free for all citizens. Sign up with your email or Google account to get started.',
  },
]

export default function AboutPage() {
  return (
    <>
      <Script
        id="structured-data-about"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(aboutSchema) }}
      />

      <div className="min-h-screen bg-background">
        {/* Nav back */}
        <div className="border-b">
          <div className="container mx-auto px-4 py-3">
            <Link href="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              ← Back to Kaattaal AI
            </Link>
          </div>
        </div>

        <main className="container mx-auto px-4 py-12 max-w-3xl">

          {/* Hero */}
          <section aria-labelledby="about-heading">
            <div className="flex items-center gap-4 mb-6">
              <Image src="/logo.png" alt="Kaattaal AI logo" width={56} height={56} className="rounded-xl" />
              <div>
                <h1 id="about-heading" className="text-3xl font-bold tracking-tight">Kaattaal AI</h1>
                <p className="text-muted-foreground text-sm mt-0.5">India&apos;s First AI-Powered LAC Information System</p>
              </div>
            </div>

            <p className="text-base text-foreground leading-relaxed mb-4">
              Kaattaal AI gives every resident of Kattakada Legislative Assembly Constituency instant,
              conversational access to government services information, development project data, and
              constituency statistics — in plain English or Malayalam.
            </p>
            <p className="text-base text-muted-foreground leading-relaxed">
              Ask a question; get a clear answer sourced directly from official documents, with no
              search-and-scroll required.
            </p>
          </section>

          <hr className="my-10 border-border" />

          {/* The initiative */}
          <section aria-labelledby="initiative-heading">
            <h2 id="initiative-heading" className="text-xl font-semibold mb-3">The Initiative</h2>
            <p className="text-base text-muted-foreground leading-relaxed mb-3">
              Kaattaal AI was conceived as per the ideology of{' '}
              <strong className="text-foreground">Adv. I.B. Satheesh, MLA</strong> for Kattakada,
              who envisioned a platform that breaks down information barriers between the constituency
              office and its citizens. Rather than navigating multiple government portals, residents
              can simply ask a question.
            </p>
            <p className="text-base text-muted-foreground leading-relaxed">
              The system was built by <strong className="text-foreground">PACE Tech</strong> with{' '}
              <strong className="text-foreground">Trinity</strong> as community partner. It launched
              in 2024 as the first AI-powered information assistant for a Kerala LAC.
            </p>
          </section>

          <hr className="my-10 border-border" />

          {/* How it works */}
          <section aria-labelledby="how-heading">
            <h2 id="how-heading" className="text-xl font-semibold mb-3">How It Works</h2>
            <ol className="space-y-3 text-base text-muted-foreground">
              <li className="flex gap-3">
                <span className="font-semibold text-foreground w-5 shrink-0">1.</span>
                <span>
                  <strong className="text-foreground">Documents are indexed.</strong> Official constituency
                  records, project reports, and service guides are processed and stored in a vector database.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="font-semibold text-foreground w-5 shrink-0">2.</span>
                <span>
                  <strong className="text-foreground">You ask a question.</strong> In English or Malayalam,
                  through the chat interface.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="font-semibold text-foreground w-5 shrink-0">3.</span>
                <span>
                  <strong className="text-foreground">The system retrieves and answers.</strong> Retrieval
                  Augmented Generation (RAG) finds the most relevant source passages and a large language
                  model synthesises an accurate, grounded answer.
                </span>
              </li>
            </ol>
          </section>

          <hr className="my-10 border-border" />

          {/* Key facts */}
          <section aria-labelledby="facts-heading">
            <h2 id="facts-heading" className="text-xl font-semibold mb-4">Key Facts</h2>
            <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              {[
                { term: 'Founded', detail: '2026' },
                { term: 'Languages', detail: 'English + Malayalam' },
                { term: 'Constituency', detail: 'Kattakada LAC, Kerala' },
                { term: 'Technology', detail: 'RAG + Vector Search' },
                { term: 'Developer', detail: 'PACE Tech' },
                { term: 'Cost to users', detail: 'Free' },
              ].map(({ term, detail }) => (
                <div key={term} className="rounded-lg border p-3 bg-muted/30">
                  <dt className="text-xs text-muted-foreground uppercase tracking-wide">{term}</dt>
                  <dd className="mt-1 text-sm font-medium text-foreground">{detail}</dd>
                </div>
              ))}
            </dl>
          </section>

          <hr className="my-10 border-border" />

          {/* FAQ */}
          <section aria-labelledby="faq-heading">
            <h2 id="faq-heading" className="text-xl font-semibold mb-4">Frequently Asked Questions</h2>
            <div className="space-y-5">
              {faqs.map(({ q, a }) => (
                <div key={q}>
                  <h3 className="text-base font-medium text-foreground mb-1">{q}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{a}</p>
                </div>
              ))}
            </div>
          </section>

          <hr className="my-10 border-border" />

          {/* CTA */}
          <section className="text-center py-4">
            <p className="text-muted-foreground mb-4 text-sm">Ready to explore Kattakada?</p>
            <Link
              href="/"
              className="inline-flex items-center justify-center rounded-xl bg-primary px-6 py-3 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90 transition-colors"
            >
              Start Asking Questions
            </Link>
          </section>
        </main>
      </div>
    </>
  )
}
