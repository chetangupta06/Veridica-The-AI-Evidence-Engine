"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Switch } from "@/components/ui/switch"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { ArrowLeft, CheckCircle2, AlertTriangle, XCircle, ExternalLink, Network, Loader2, Download } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Suspense, useEffect, useState, useMemo } from "react"
import { extractClaims, analyzeClaim, type ExtractedClaim, type ClaimAnalysis, type ModelAnalysisResult } from "@/lib/mesh"

const MODELS = ["claude-3-5-sonnet", "gpt-4o", "gemini-1.5-pro", "grok", "deepseek-chat"]
const MODEL_DISPLAY_NAMES: Record<string, string> = {
  "claude-3-5-sonnet": "Claude 3.5 Sonnet",
  "gpt-4o": "GPT-4o",
  "gemini-1.5-pro": "Gemini 1.5 Pro",
  "grok": "Grok 2",
  "deepseek-chat": "DeepSeek-V2"
}

// Helper to colorize verdict
const getVerdictStyle = (verdict: string) => {
  const v = verdict.toLowerCase();
  if (v.includes("mostly true") || v === "true") return { color: "text-green-500", bg: "bg-green-500/10", border: "border-green-500/30", icon: <CheckCircle2 className="w-4 h-4 mr-1 inline" /> };
  if (v.includes("partially true") || v.includes("misleading") || v.includes("mixed")) return { color: "text-yellow-500", bg: "bg-yellow-500/10", border: "border-yellow-500/30", icon: <AlertTriangle className="w-4 h-4 mr-1 inline" /> };
  if (v.includes("false")) return { color: "text-red-500", bg: "bg-red-500/10", border: "border-red-500/30", icon: <XCircle className="w-4 h-4 mr-1 inline" /> };
  return { color: "text-gray-500", bg: "bg-gray-500/10", border: "border-gray-500/30", icon: <AlertTriangle className="w-4 h-4 mr-1 inline" /> };
}

// Simple highlighter for heatmap simulation
const HeatmapText = ({ text, claims }: { text: string, claims: ClaimAnalysis[] }) => {
  let highlighted = text;
  claims.forEach(claim => {
    // Basic fuzzy match / exact match highlight for the mock
    const snippet = claim.text.split(' ').slice(0, 4).join(' '); // find first few words to highlight
    if (snippet && text.includes(snippet)) {
      const style = getVerdictStyle(claim.aggregatedVerdict);
      highlighted = highlighted.replace(
        snippet, 
        `<mark class="${style.bg} ${style.color} px-1 rounded font-medium bg-transparent">${snippet}</mark>`
      );
    }
  });

  return <p className="text-lg leading-relaxed text-muted-foreground" dangerouslySetInnerHTML={{ __html: highlighted }} />
}

function AnalyzeContent() {
  const router = useRouter()
  const [smartRouting, setSmartRouting] = useState(true)
  const [selectedModel, setSelectedModel] = useState(MODELS[0])
  
  const [originalInput, setOriginalInput] = useState("")
  const [loadingState, setLoadingState] = useState<"idle" | "extracting" | "analyzing" | "done">("idle")
  
  const [analyzedClaims, setAnalyzedClaims] = useState<ClaimAnalysis[]>([])
  const [overallScore, setOverallScore] = useState(0)

  const activeModels = smartRouting ? ["claude-3-5-sonnet", "gpt-4o", "gemini-1.5-pro"] : [selectedModel];

  const runFullPipeline = async (text: string, modelsToUse: string[]) => {
    setLoadingState("extracting")
    try {
      // Step 1: Extract
      const extracted = await extractClaims(text, modelsToUse[0])
      
      // Step 2: Analyze top claims
      setLoadingState("analyzing")
      const claimsToAnalyze = extracted.slice(0, 5) // Analyze top 5
      
      const detailedClaims: ClaimAnalysis[] = []
      
      for (const claim of claimsToAnalyze) {
        const results = await analyzeClaim(claim.text, text, modelsToUse)
        
        // Aggregate logic
        let totalConfidence = 0;
        let trueCount = 0;
        let falseCount = 0;
        
        results.forEach(r => {
          totalConfidence += r.confidence;
          if (r.verdict.includes("True")) trueCount++;
          if (r.verdict.includes("False")) falseCount++;
        });

        const avgConf = Math.round(totalConfidence / results.length);
        
        // Bonus for agreement
        const agreementBonus = (results.length > 1 && (trueCount === results.length || falseCount === results.length)) ? 10 : 0;
        const finalConf = Math.min(100, avgConf + agreementBonus);

        const aggVerdict = trueCount > falseCount ? "Mostly True" : falseCount > trueCount ? "Mostly False" : "Mixed/Misleading";

        detailedClaims.push({
          ...claim,
          modelResults: results,
          aggregatedVerdict: aggVerdict,
          aggregatedConfidence: finalConf
        })
      }

      setAnalyzedClaims(detailedClaims)
      
      // Calculate overall score
      if (detailedClaims.length > 0) {
        let totalScore = 0;
        detailedClaims.forEach(c => {
          totalScore += c.aggregatedVerdict === "Mostly True" ? c.aggregatedConfidence : (100 - c.aggregatedConfidence);
        });
        setOverallScore(Math.round(totalScore / detailedClaims.length));
      } else {
        setOverallScore(0);
      }

    } catch (error) {
      console.error("Pipeline error:", error)
    } finally {
      setLoadingState("done")
    }
  }

  useEffect(() => {
    const payloadStr = sessionStorage.getItem("veridica_input")
    if (payloadStr) {
      try {
        const payload = JSON.parse(payloadStr)
        let textToAnalyze = payload.content
        if (payload.type === "url") {
          textToAnalyze = `[Fetched from URL: ${payload.content}] Coffee stunts your growth and decreases bone density. Caffeine can cause temporary spikes in blood pressure.` 
        }
        setOriginalInput(textToAnalyze)
        runFullPipeline(textToAnalyze, activeModels)
      } catch (e) {
        console.error("Failed to parse input payload", e)
      }
    } else {
      router.push("/")
    }
  }, []) // eslint-disable-line

  const handleModelChange = (model: string) => {
    if (smartRouting) return
    setSelectedModel(model)
    if (originalInput) {
      runFullPipeline(originalInput, [model])
    }
  }

  // Derived overall state
  const isOverallTrue = overallScore > 60;
  const isOverallMixed = overallScore >= 40 && overallScore <= 60;
  const overallVerdictText = analyzedClaims.length === 0 ? "UNKNOWN" : isOverallTrue ? "MOSTLY TRUE" : isOverallMixed ? "MIXED" : "MOSTLY FALSE"
  const verdictStyle = getVerdictStyle(overallVerdictText)

  // Collect all sources
  const allSources = useMemo(() => {
    const sourcesMap = new Map();
    analyzedClaims.forEach(c => {
      c.modelResults.forEach(m => {
        m.key_sources.forEach(s => {
          if (!sourcesMap.has(s.title)) sourcesMap.set(s.title, s);
        })
      })
    })
    return Array.from(sourcesMap.values());
  }, [analyzedClaims])

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
          <Button variant="outline" size="sm" className="gap-2" onClick={() => alert("Report exported! (Mock)")}>
            <Download className="w-4 h-4" /> Export Report
          </Button>

          <div className="flex items-center gap-2 border-l pl-6">
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
                onClick={() => handleModelChange(model)}
              >
                {MODEL_DISPLAY_NAMES[model]}
              </Badge>
            ))}
          </div>
        </div>
      </header>

      {/* 3-Column Main Content */}
      <div className="flex flex-1 overflow-hidden relative">
        
        {/* Full-screen Loading Overlay */}
        {loadingState !== "idle" && loadingState !== "done" && (
          <div className="absolute inset-0 z-50 bg-background/80 backdrop-blur-sm flex flex-col items-center justify-center">
            <Loader2 className="h-12 w-12 text-primary animate-spin mb-4" />
            <h2 className="text-2xl font-semibold mb-2">
              {loadingState === "extracting" ? "Extracting verifiable claims..." : "Consulting multiple models via Mesh API..."}
            </h2>
            <p className="text-muted-foreground">
              {smartRouting ? `Using ${activeModels.map(m => MODEL_DISPLAY_NAMES[m]).join(", ")}` : MODEL_DISPLAY_NAMES[selectedModel]}
            </p>
          </div>
        )}

        {/* Left Sidebar: Original Input & Extracted Claims */}
        <div className="w-80 border-r bg-muted/20 flex flex-col hidden lg:flex">
          <div className="p-4 border-b">
            <h3 className="font-semibold text-sm text-muted-foreground mb-2">ORIGINAL INPUT</h3>
            <div className="text-sm bg-card p-3 rounded-md border shadow-sm max-h-[150px] overflow-y-auto">
              "{originalInput}"
            </div>
          </div>
          
          <div className="p-4 flex-1 flex flex-col min-h-0">
            <h3 className="font-semibold text-sm text-muted-foreground mb-4">EXTRACTED CLAIMS ({analyzedClaims.length})</h3>
            <ScrollArea className="flex-1 -mx-4 px-4">
              <div className="space-y-3">
                {analyzedClaims.map((claim) => (
                  <Card key={claim.id} className="border-l-4" style={{ borderLeftColor: claim.aggregatedVerdict.includes('True') ? 'var(--color-green-500)' : claim.aggregatedVerdict.includes('False') ? 'var(--color-red-500)' : 'var(--color-yellow-500)' }}>
                    <CardContent className="p-3">
                      <p className="text-sm line-clamp-3">{claim.text}</p>
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
                  Overall Verdict: <span className={`${verdictStyle.color} font-bold tracking-wide`}>{overallVerdictText}</span>
                </CardTitle>
                <CardDescription>Based on analysis from {smartRouting ? "an ensemble of AI models" : MODEL_DISPLAY_NAMES[selectedModel]}.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col md:flex-row items-center gap-8">
                  <div className={`flex flex-col items-center justify-center w-32 h-32 shrink-0 rounded-full border-8 ${verdictStyle.border} ${verdictStyle.color} relative`}>
                    <span className="text-3xl font-bold">{overallScore}</span>
                    <span className="text-xs uppercase tracking-wider font-semibold">Evidence Score</span>
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold mb-2">Text Heatmap Simulation</h4>
                    <HeatmapText text={originalInput} claims={analyzedClaims} />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Detailed Claims Breakdown */}
            <div className="space-y-4">
              <h3 className="text-xl font-semibold flex items-center gap-2">
                Detailed Analysis
              </h3>
              
              {analyzedClaims.length === 0 && loadingState === "done" && (
                <div className="text-center p-8 text-muted-foreground border border-dashed rounded-lg">
                  No verifiable claims could be extracted from the provided text.
                </div>
              )}

              <Accordion className="w-full space-y-4">
                {analyzedClaims.map((claim, idx) => {
                  const style = getVerdictStyle(claim.aggregatedVerdict);
                  return (
                    <AccordionItem key={claim.id} value={`item-${claim.id}`} className={`border ${style.border} rounded-lg bg-card shadow-sm overflow-hidden`}>
                      <AccordionTrigger className={`px-4 py-3 hover:no-underline ${style.bg}`}>
                        <div className="flex items-start justify-between w-full text-left pr-4 gap-4">
                          <span className="text-base font-semibold leading-tight flex-1">{claim.text}</span>
                          <Badge variant="outline" className={`${style.color} border-current shrink-0 text-sm py-1 bg-background/50`}>
                            {style.icon}
                            {claim.aggregatedVerdict} ({claim.aggregatedConfidence}%)
                          </Badge>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="p-4 pt-6 space-y-6">
                        
                        {/* Model Breakdown */}
                        <div>
                          <h4 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wider">Model Consensus</h4>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            {claim.modelResults.map(res => {
                              const mStyle = getVerdictStyle(res.verdict);
                              return (
                                <div key={res.model} className="p-3 border rounded-md bg-muted/30">
                                  <div className="flex items-center justify-between mb-1">
                                    <span className="font-medium text-sm">{MODEL_DISPLAY_NAMES[res.model] || res.model}</span>
                                    <span className={`text-xs font-bold ${mStyle.color}`}>{res.verdict}</span>
                                  </div>
                                  <p className="text-xs text-muted-foreground line-clamp-3" title={res.explanation}>
                                    {res.explanation}
                                  </p>
                                </div>
                              )
                            })}
                          </div>
                        </div>

                      </AccordionContent>
                    </AccordionItem>
                  )
                })}
              </Accordion>
            </div>

          </div>
        </ScrollArea>

        {/* Right Sidebar: Consensus & Sources */}
        <div className="w-80 border-l bg-muted/10 hidden xl:flex flex-col">
          <div className="p-6 border-b">
            <h3 className="font-semibold text-sm text-muted-foreground mb-4">GLOBAL CONSENSUS</h3>
            <div className="space-y-4">
              {activeModels.map(model => {
                // Determine a rough global verdict for this model by averaging its votes across all claims
                let trueCount = 0; let falseCount = 0;
                analyzedClaims.forEach(c => {
                  const res = c.modelResults.find(m => m.model === model);
                  if (res?.verdict.includes("True")) trueCount++;
                  if (res?.verdict.includes("False")) falseCount++;
                })
                const globalVerdict = trueCount > falseCount ? "Mostly True" : falseCount > trueCount ? "Mostly False" : "Mixed";
                const mStyle = getVerdictStyle(globalVerdict);
                
                return (
                  <div key={model} className="flex justify-between items-center text-sm">
                    <span>{MODEL_DISPLAY_NAMES[model]}</span>
                    <Badge variant="outline" className={`${mStyle.color} ${mStyle.border}`}>
                      {globalVerdict}
                    </Badge>
                  </div>
                )
              })}
            </div>
          </div>
          
          <div className="p-6 flex-1 flex flex-col min-h-0">
            <h3 className="font-semibold text-sm text-muted-foreground mb-4">CITED SOURCES ({allSources.length})</h3>
            <ScrollArea className="flex-1 -mx-2 px-2">
              <div className="space-y-4">
                {allSources.length === 0 && (
                   <div className="text-xs text-muted-foreground text-center">No sources cited.</div>
                )}
                {allSources.map((source, i) => (
                  <div key={i} className="group cursor-pointer">
                    <h4 className="text-sm font-medium group-hover:text-primary transition-colors line-clamp-2">
                      {source.title}
                    </h4>
                    <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <ExternalLink className="w-3 h-3" />
                        {source.domain}
                      </span>
                      <span>•</span>
                      <span className={source.credibility === 'High' ? 'text-green-500' : source.credibility === 'Low' ? 'text-red-500' : 'text-yellow-500'}>
                        {source.credibility}
                      </span>
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
    <Suspense fallback={<div className="flex items-center justify-center h-screen"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>}>
      <AnalyzeContent />
    </Suspense>
  )
}
