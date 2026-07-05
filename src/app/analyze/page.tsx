"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Switch } from "@/components/ui/switch"
import { ArrowLeft, CheckCircle2, AlertTriangle, XCircle, ExternalLink, Network } from "lucide-react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { Suspense, useState } from "react"

// Mock Data
const MODELS = ["Claude 3.5 Sonnet", "GPT-4o", "Gemini 1.5 Pro", "Grok 2", "DeepSeek-V2"]

const MOCK_CLAIMS = [
  {
    id: 1,
    text: "Coffee stunts your growth",
    verdict: "FALSE",
    confidence: 98,
    explanation: "Extensive medical studies have shown no correlation between caffeine consumption and bone growth or height in children or young adults.",
    color: "text-red-500",
    bg: "bg-red-500/10",
    border: "border-red-500/20"
  },
  {
    id: 2,
    text: "Caffeine can cause temporary spikes in blood pressure",
    verdict: "TRUE",
    confidence: 92,
    explanation: "Caffeine can cause a short, but dramatic increase in your blood pressure, even if you don't have high blood pressure.",
    color: "text-green-500",
    bg: "bg-green-500/10",
    border: "border-green-500/20"
  }
]

const MOCK_SOURCES = [
  { id: 1, title: "Harvard Health Publishing: Does coffee stunt your growth?", domain: "health.harvard.edu", credibility: "High" },
  { id: 2, title: "Mayo Clinic: Caffeine and blood pressure", domain: "mayoclinic.org", credibility: "High" },
  { id: 3, title: "Journal of the American Medical Association", domain: "jamanetwork.com", credibility: "Very High" },
]

function AnalyzeContent() {
  const searchParams = useSearchParams()
  const query = searchParams.get("q") || "No claim provided."
  const [smartRouting, setSmartRouting] = useState(true)
  const [selectedModel, setSelectedModel] = useState(MODELS[0])

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Top Navigation & Model Selector */}
      <header className="flex items-center justify-between border-b px-6 py-4 bg-card z-10 shrink-0">
        <div className="flex items-center gap-4">
          <Link href="/">
            <Button variant="ghost" size="icon" className="rounded-full">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div className="font-semibold text-lg flex items-center gap-2">
            <Network className="h-5 w-5 text-primary" />
            Analysis Engine
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <Switch 
              id="smart-routing" 
              checked={smartRouting} 
              onCheckedChange={setSmartRouting} 
            />
            <label htmlFor="smart-routing" className="text-sm font-medium cursor-pointer text-muted-foreground">
              Smart Routing
            </label>
          </div>
          
          <div className="hidden md:flex items-center gap-2 border-l pl-6">
            <span className="text-sm text-muted-foreground mr-2">Route to:</span>
            {MODELS.map((model) => (
              <Badge 
                key={model} 
                variant={selectedModel === model && !smartRouting ? "default" : "secondary"}
                className={`cursor-pointer transition-colors ${smartRouting ? 'opacity-50 pointer-events-none' : ''}`}
                onClick={() => !smartRouting && setSelectedModel(model)}
              >
                {model}
              </Badge>
            ))}
          </div>
        </div>
      </header>

      {/* 3-Column Main Content */}
      <div className="flex flex-1 overflow-hidden">
        
        {/* Left Sidebar: Original Input & Extracted Claims */}
        <div className="w-80 border-r bg-muted/20 flex flex-col hidden lg:flex">
          <div className="p-4 border-b">
            <h3 className="font-semibold text-sm text-muted-foreground mb-2">ORIGINAL INPUT</h3>
            <div className="text-sm bg-card p-3 rounded-md border shadow-sm">
              "{query}"
            </div>
          </div>
          
          <div className="p-4 flex-1 flex flex-col min-h-0">
            <h3 className="font-semibold text-sm text-muted-foreground mb-4">EXTRACTED CLAIMS (2)</h3>
            <ScrollArea className="flex-1 -mx-4 px-4">
              <div className="space-y-3">
                {MOCK_CLAIMS.map((claim) => (
                  <Card key={claim.id} className="border-l-4" style={{ borderLeftColor: claim.verdict === 'TRUE' ? 'var(--color-green-500)' : 'var(--color-red-500)' }}>
                    <CardContent className="p-3">
                      <p className="text-sm">{claim.text}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          </div>
        </div>

        {/* Main Area: Heatmap, Score, Verdicts */}
        <ScrollArea className="flex-1 bg-background">
          <div className="max-w-4xl mx-auto p-6 md:p-8 space-y-8">
            
            {/* Overview Card */}
            <Card className="bg-card border-primary/20 shadow-lg relative overflow-hidden">
              <div className="absolute top-0 right-0 p-8 opacity-5">
                <Network className="w-48 h-48" />
              </div>
              <CardHeader>
                <CardTitle className="text-2xl flex items-center gap-2">
                  Overall Verdict: <span className="text-red-500 font-bold tracking-wide">MOSTLY FALSE</span>
                </CardTitle>
                <CardDescription>Based on consensus from 3 advanced AI models.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-8">
                  <div className="flex flex-col items-center justify-center w-32 h-32 rounded-full border-8 border-red-500/20 text-red-500 relative">
                    <span className="text-3xl font-bold">24</span>
                    <span className="text-xs uppercase tracking-wider font-semibold">Truth Score</span>
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold mb-2">Text Heatmap</h4>
                    <p className="text-lg leading-relaxed">
                      <span className="bg-red-500/20 text-red-500 px-1 rounded">Coffee stunts your growth</span>, but research shows that <span className="bg-green-500/20 text-green-500 px-1 rounded">caffeine can cause temporary spikes in blood pressure</span>.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Detailed Claims Breakdown */}
            <div className="space-y-6">
              <h3 className="text-xl font-semibold flex items-center gap-2">
                Detailed Analysis
              </h3>
              
              {MOCK_CLAIMS.map((claim) => (
                <Card key={claim.id} className={`border ${claim.border} shadow-sm`}>
                  <CardHeader className={`${claim.bg} pb-4 rounded-t-lg`}>
                    <div className="flex items-start justify-between gap-4">
                      <CardTitle className="text-lg leading-tight">{claim.text}</CardTitle>
                      <Badge variant="outline" className={`${claim.color} border-current shrink-0 text-sm py-1`}>
                        {claim.verdict === 'TRUE' ? <CheckCircle2 className="w-4 h-4 mr-1 inline" /> : <XCircle className="w-4 h-4 mr-1 inline" />}
                        {claim.verdict} ({claim.confidence}%)
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-4">
                    <p className="text-muted-foreground">{claim.explanation}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

          </div>
        </ScrollArea>

        {/* Right Sidebar: Consensus & Sources */}
        <div className="w-80 border-l bg-muted/10 hidden xl:flex flex-col">
          <div className="p-6 border-b">
            <h3 className="font-semibold text-sm text-muted-foreground mb-4">MODEL CONSENSUS</h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center text-sm">
                <span>Claude 3.5 Sonnet</span>
                <Badge variant="outline" className="text-red-500 border-red-500/30">Mostly False</Badge>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span>GPT-4o</span>
                <Badge variant="outline" className="text-red-500 border-red-500/30">Mostly False</Badge>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span>Gemini 1.5 Pro</span>
                <Badge variant="outline" className="text-red-500 border-red-500/30">Mostly False</Badge>
              </div>
            </div>
          </div>
          
          <div className="p-6 flex-1 flex flex-col min-h-0">
            <h3 className="font-semibold text-sm text-muted-foreground mb-4">CITED SOURCES</h3>
            <ScrollArea className="flex-1 -mx-2 px-2">
              <div className="space-y-4">
                {MOCK_SOURCES.map((source) => (
                  <div key={source.id} className="group cursor-pointer">
                    <h4 className="text-sm font-medium group-hover:text-primary transition-colors line-clamp-2">
                      {source.title}
                    </h4>
                    <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <ExternalLink className="w-3 h-3" />
                        {source.domain}
                      </span>
                      <span>•</span>
                      <span className="text-primary/80">{source.credibility} Trust</span>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        </div>

      </div>
    </div>
  )
}

export default function AnalyzePage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-screen">Loading analysis...</div>}>
      <AnalyzeContent />
    </Suspense>
  )
}
