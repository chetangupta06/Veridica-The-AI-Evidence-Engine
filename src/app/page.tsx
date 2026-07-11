"use client"

import { Button } from "@/components/ui/button"
import { ShieldCheck, Search, Zap, Layers, BarChart, CheckCircle2, FileSearch, ArrowRight, BrainCircuit, Globe, MessageSquareWarning } from "lucide-react"
import Link from "next/link"
import { ThemeToggle } from "@/components/ThemeToggle"
import Image from "next/image"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"

export default function LandingPage() {
  return (
    <div className="flex flex-col min-h-screen bg-background">
      
      {/* Header */}
      <header className="px-6 py-4 flex items-center justify-between sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b">
        <div className="flex items-center gap-2">
          <div className="relative w-10 h-10 flex items-center justify-center">
             <img src="/logo.png" alt="Veridica Logo" className="object-contain w-full h-full drop-shadow-sm scale-125" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
          </div>
          <span className="font-bold text-xl tracking-tight">Veridica</span>
        </div>
        <div className="flex items-center gap-4">
          <Link href="https://github.com/chetangupta06/Veridica-The-AI-Evidence-Engine" target="_blank" rel="noopener noreferrer">
            <Button variant="ghost" size="icon" className="rounded-full">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 22v-4a4.8 4.8 0 0 0-1-3.02c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A4.8 4.8 0 0 0 8 18v4"></path></svg>
              <span className="sr-only">GitHub Repository</span>
            </Button>
          </Link>
          <ThemeToggle />
          <Link href="/search">
            <Button size="sm" className="font-medium bg-primary text-primary-foreground hover:bg-primary/90">
              Analyze Claim <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Link>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center">
        
        {/* Hero Section */}
        <section className="w-full max-w-5xl mx-auto px-6 py-20 md:py-32 flex flex-col items-center text-center space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
            <SparklesIcon className="w-4 h-4" /> The AI Evidence Engine
          </div>
          
          <div className="relative w-32 h-32 md:w-48 md:h-48 mb-4">
            <div className="w-full h-full flex items-center justify-center p-2">
              <img src="/logo.png" alt="Veridica Logo" className="w-full h-full object-contain drop-shadow-2xl scale-110" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
            </div>
            <div className="absolute inset-0 -z-10 bg-primary/20 blur-3xl rounded-full"></div>
          </div>

          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight max-w-4xl bg-clip-text text-transparent bg-gradient-to-br from-foreground to-foreground/60">
            Verify. Analyze. Trust.
          </h1>
          
          <p className="text-xl md:text-2xl text-muted-foreground max-w-2xl leading-relaxed">
            Stop relying on SEO noise and AI hallucinations. Veridica extracts claims and verifies them against a consensus of top AI reasoning engines and real-world web evidence.
          </p>

          <div className="pt-8 pb-12 flex flex-col sm:flex-row gap-4 items-center">
            <Link href="/search">
              <Button size="lg" className="h-14 px-8 text-lg font-semibold rounded-full shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 transition-all hover:-translate-y-1">
                Start Analyzing Claims <Search className="ml-2 w-5 h-5" />
              </Button>
            </Link>
          </div>
        </section>

        {/* Why Veridica Section */}
        <section className="w-full bg-muted/30 border-y py-24">
          <div className="max-w-6xl mx-auto px-6">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">Why Veridica?</h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                Built for researchers, journalists, and truth-seekers who demand rigorous, unbiased evidence.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
              <div className="bg-card p-8 rounded-2xl border shadow-sm flex flex-col items-center text-center hover:shadow-md transition-shadow">
                <div className="w-14 h-14 bg-primary/10 rounded-xl flex items-center justify-center mb-6 text-primary">
                  <BrainCircuit className="w-7 h-7" />
                </div>
                <h3 className="text-xl font-bold mb-3">Multi-Model Consensus</h3>
                <p className="text-muted-foreground">
                  We don't trust just one AI. Veridica runs your claim simultaneously through 1,000+ models to find the ultimate consensus.
                </p>
              </div>

              <div className="bg-card p-8 rounded-2xl border shadow-sm flex flex-col items-center text-center hover:shadow-md transition-shadow">
                <div className="w-14 h-14 bg-primary/10 rounded-xl flex items-center justify-center mb-6 text-primary">
                  <Globe className="w-7 h-7" />
                </div>
                <h3 className="text-xl font-bold mb-3">Live Web Extraction</h3>
                <p className="text-muted-foreground">
                  AI without search is just guessing. Veridica dynamically searches Google and Wikipedia, providing primary source links for every verdict.
                </p>
              </div>

              <div className="bg-card p-8 rounded-2xl border shadow-sm flex flex-col items-center text-center hover:shadow-md transition-shadow">
                <div className="w-14 h-14 bg-primary/10 rounded-xl flex items-center justify-center mb-6 text-primary">
                  <BarChart className="w-7 h-7" />
                </div>
                <h3 className="text-xl font-bold mb-3">Fact-Based Scoring</h3>
                <p className="text-muted-foreground">
                  No more vague answers. Get a definitive Truth Score (0-100) backed by citation grades, scientific consensus, and reasoning consistency.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Compare to Others Section */}
        <section className="w-full max-w-6xl mx-auto px-6 py-24">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">How We Compare</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              See why Veridica is the ultimate upgrade to your fact-checking workflow.
            </p>
          </div>

          <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
            <div className="grid grid-cols-4 border-b bg-muted/50 p-4 font-semibold text-sm md:text-base">
              <div className="col-span-1">Feature</div>
              <div className="col-span-1 text-center text-primary flex flex-col items-center gap-1">
                <ShieldCheck className="w-5 h-5" /> Veridica
              </div>
              <div className="col-span-1 text-center text-muted-foreground">Traditional Search</div>
              <div className="col-span-1 text-center text-muted-foreground">Standard AI Chat</div>
            </div>
            
            <div className="divide-y text-sm md:text-base">
              <div className="grid grid-cols-4 p-4 items-center">
                <div className="col-span-1 font-medium">Verdict Confidence</div>
                <div className="col-span-1 flex justify-center text-primary"><CheckCircle2 className="w-5 h-5" /></div>
                <div className="col-span-1 flex justify-center text-muted-foreground"><XIcon className="w-5 h-5 opacity-50" /></div>
                <div className="col-span-1 flex justify-center text-muted-foreground"><MessageSquareWarning className="w-5 h-5 opacity-50" /></div>
              </div>
              
              <div className="grid grid-cols-4 p-4 items-center">
                <div className="col-span-1 font-medium">Multiple AI Consensus</div>
                <div className="col-span-1 flex justify-center text-primary"><CheckCircle2 className="w-5 h-5" /></div>
                <div className="col-span-1 flex justify-center text-muted-foreground"><XIcon className="w-5 h-5 opacity-50" /></div>
                <div className="col-span-1 flex justify-center text-muted-foreground"><XIcon className="w-5 h-5 opacity-50" /></div>
              </div>

              <div className="grid grid-cols-4 p-4 items-center">
                <div className="col-span-1 font-medium">Primary Source Citations</div>
                <div className="col-span-1 flex justify-center text-primary"><CheckCircle2 className="w-5 h-5" /></div>
                <div className="col-span-1 flex justify-center text-muted-foreground"><CheckCircle2 className="w-5 h-5 opacity-50" /></div>
                <div className="col-span-1 flex justify-center text-muted-foreground"><XIcon className="w-5 h-5 opacity-50" /></div>
              </div>

              <div className="grid grid-cols-4 p-4 items-center">
                <div className="col-span-1 font-medium">Immune to SEO Spam</div>
                <div className="col-span-1 flex justify-center text-primary"><CheckCircle2 className="w-5 h-5" /></div>
                <div className="col-span-1 flex justify-center text-muted-foreground"><XIcon className="w-5 h-5 opacity-50" /></div>
                <div className="col-span-1 flex justify-center text-muted-foreground"><CheckCircle2 className="w-5 h-5 opacity-50" /></div>
              </div>
            </div>
          </div>
        </section>

        {/* FAQs */}
        <section className="w-full bg-muted/30 border-y py-24">
          <div className="max-w-3xl mx-auto px-6">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold mb-4">Common FAQs</h2>
            </div>
            
            <Accordion className="w-full bg-card rounded-2xl border px-6 py-2 shadow-sm">
              <AccordionItem value="item-1">
                <AccordionTrigger className="text-lg font-medium hover:no-underline hover:text-primary transition-colors">What is Veridica?</AccordionTrigger>
                <AccordionContent className="text-muted-foreground text-base">
                Veridica is an AI-powered evidence engine that fact-checks claims using a consensus of 1,000+ models backed by real-time web search retrieval.
              </AccordionContent>
              </AccordionItem>
              <AccordionItem value="item-2">
                <AccordionTrigger className="text-lg font-medium hover:no-underline hover:text-primary transition-colors">How does the multi-model consensus work?</AccordionTrigger>
                <AccordionContent className="text-muted-foreground text-base leading-relaxed">
                  When you submit a claim, Veridica searches the web to build an "evidence snapshot". It then feeds this exact same snapshot to multiple different AI models simultaneously. The system calculates an aggregated truth score based on whether the different AIs agree or disagree.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="item-3">
                <AccordionTrigger className="text-lg font-medium hover:no-underline hover:text-primary transition-colors">Are the search results biased?</AccordionTrigger>
                <AccordionContent className="text-muted-foreground text-base leading-relaxed">
                  We use neutral retrieval systems and strictly instruct our AI reviewers to look for primary source evidence rather than relying on internet rumor consensus.
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        </section>

        {/* Final CTA */}
        <section className="w-full max-w-4xl mx-auto px-6 py-24 text-center">
          <h2 className="text-3xl md:text-5xl font-bold mb-6">Ready to find the truth?</h2>
          <p className="text-xl text-muted-foreground mb-8">Join the researchers verifying the internet, one claim at a time.</p>
          <Link href="/search">
            <Button size="lg" className="h-14 px-8 text-lg font-semibold rounded-full shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 transition-all hover:-translate-y-1">
              Start Analyzing Claims <ArrowRight className="ml-2 w-5 h-5" />
            </Button>
          </Link>
        </section>

      </main>

      {/* Footer / Mesh API Credit */}
      <footer className="border-t bg-card py-12 px-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2 opacity-80">
            <ShieldCheck className="w-6 h-6 text-primary" />
            <span className="font-bold text-lg">Veridica</span>
          </div>
          
          <div className="flex flex-col items-center md:items-end text-sm text-muted-foreground">
            <div className="flex items-center gap-2 bg-muted/50 px-4 py-2 rounded-full border mb-2 shadow-sm">
              <Zap className="w-4 h-4 text-yellow-500" />
              <span>A huge thanks to <a href="https://meshapi.ai/" target="_blank" rel="noopener noreferrer" className="hover:underline font-bold text-foreground">Mesh API</a></span>
            </div>
            <p className="text-center md:text-right max-w-sm">
              Powering the multi-model infrastructure and routing backend that makes our consensus engine possible.
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}

function SparklesIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
      <path d="M5 3v4" />
      <path d="M19 17v4" />
      <path d="M3 5h4" />
      <path d="M17 19h4" />
    </svg>
  )
}

function XIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  )
}
