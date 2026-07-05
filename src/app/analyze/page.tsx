"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Switch } from "@/components/ui/switch"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Progress } from "@/components/ui/progress"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"
import { ArrowLeft, CheckCircle2, AlertTriangle, XCircle, ExternalLink, Network, Loader2, Download, Plus, Send, ChevronDown } from "lucide-react"
import { AboutModal } from "@/components/AboutModal"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Suspense, useEffect, useState, useMemo } from "react"
import { extractClaims, analyzeClaim, type ExtractedClaim, type ClaimAnalysis, type ModelAnalysisResult } from "@/lib/mesh"
import { gatherEvidence, type EvidenceSnapshot } from "@/lib/retriever"

const MODELS = ["claude-3-5-sonnet", "gpt-4o", "gemini-1.5-pro", "grok", "deepseek-chat"]
const MODEL_DISPLAY_NAMES: Record<string, string> = {
  "claude-3-5-sonnet": "Claude 3.5 Sonnet",
  "gpt-4o": "GPT-4o",
  "gemini-1.5-pro": "Gemini 1.5 Pro",
  "grok": "Grok 2",
  "deepseek-chat": "DeepSeek-V2"
}

const getVerdictStyle = (verdict: string) => {
  const v = verdict.toLowerCase();
  if (v.includes("mostly true") || v === "true") return { color: "text-green-500", bg: "bg-green-500/10", border: "border-green-500/30", indicator: "bg-green-500", icon: <CheckCircle2 className="w-4 h-4 mr-1 inline" /> };
  if (v.includes("partially true") || v.includes("misleading") || v.includes("mixed")) return { color: "text-yellow-500", bg: "bg-yellow-500/10", border: "border-yellow-500/30", indicator: "bg-yellow-500", icon: <AlertTriangle className="w-4 h-4 mr-1 inline" /> };
  if (v.includes("false")) return { color: "text-red-500", bg: "bg-red-500/10", border: "border-red-500/30", indicator: "bg-red-500", icon: <XCircle className="w-4 h-4 mr-1 inline" /> };
  return { color: "text-gray-500", bg: "bg-gray-500/10", border: "border-gray-500/30", indicator: "bg-gray-500", icon: <AlertTriangle className="w-4 h-4 mr-1 inline" /> };
}

const HeatmapText = ({ text, claims }: { text: string, claims: ClaimAnalysis[] }) => {
  if (claims.length === 0) return <p className="text-lg leading-relaxed text-muted-foreground">{text}</p>;

  // A more robust highlighting approach:
  // We split the text by spaces and rebuild it, wrapping matching segments in tooltips
  let parts = [{ text, matched: false, claim: null as ClaimAnalysis | null }];

  claims.forEach(claim => {
    const snippet = claim.text.split(' ').slice(0, 4).join(' '); // 4 word signature
    if (!snippet) return;
    
    parts = parts.flatMap(part => {
      if (part.matched) return [part];
      const idx = part.text.indexOf(snippet);
      if (idx === -1) return [part];

      return [
        { text: part.text.substring(0, idx), matched: false, claim: null },
        { text: snippet, matched: true, claim },
        { text: part.text.substring(idx + snippet.length), matched: false, claim: null }
      ];
    });
  });

  return (
    <p className="text-lg leading-relaxed text-muted-foreground">
      {parts.map((p, i) => {
        if (!p.matched || !p.claim) return <span key={i}>{p.text}</span>;
        
        const style = getVerdictStyle(p.claim.aggregatedVerdict);
        return (
          <Tooltip key={i}>
            <TooltipTrigger render={<mark className={`${style.bg} ${style.color} px-1 rounded font-medium bg-transparent cursor-help underline decoration-dotted underline-offset-4`} />}>
              {p.text}
            </TooltipTrigger>
            <TooltipContent className="max-w-sm">
              <div className="font-semibold mb-1 flex items-center">
                {style.icon} {p.claim.aggregatedVerdict} ({p.claim.aggregatedConfidence}%)
              </div>
              <p className="text-sm">{p.claim.text}</p>
            </TooltipContent>
          </Tooltip>
        );
      })}
    </p>
  )
}

function AnalyzeContent() {
  const router = useRouter()
  const [smartRouting, setSmartRouting] = useState(true)
  const [selectedModels, setSelectedModels] = useState<string[]>([MODELS[0]])
  const [dropdownOpen, setDropdownOpen] = useState(false)
  
  const [originalInput, setOriginalInput] = useState("")
  const [loadingState, setLoadingState] = useState<"idle" | "extracting" | "retrieving" | "analyzing" | "done">("idle")
  
  const [analyzedClaims, setAnalyzedClaims] = useState<ClaimAnalysis[]>([])
  const [overallScore, setOverallScore] = useState(0)

  const activeModels = smartRouting ? ["claude-3-5-sonnet", "gpt-4o", "gemini-1.5-pro"] : selectedModels;

  useEffect(() => {
    // Load settings
    const saved = localStorage.getItem("veridica_settings")
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        if (parsed.smartRouting !== undefined) setSmartRouting(parsed.smartRouting)
        if (parsed.defaultModel) setSelectedModels([parsed.defaultModel])
      } catch(e) {}
    }

    const payloadStr = sessionStorage.getItem("veridica_input")
    if (payloadStr) {
      try {
        const payload = JSON.parse(payloadStr)
        let textToAnalyze = payload.content
        if (payload.type === "url") {
          textToAnalyze = `[Fetched from URL: ${payload.content}] Coffee stunts your growth and decreases bone density. Caffeine can cause temporary spikes in blood pressure.` 
        }
        setOriginalInput(textToAnalyze)
        // Note: we use activeModels here based on initial state, but state might not have updated yet.
        // For robustness, we read localStorage again here.
        let sm = true; let dm = MODELS[0];
        if (saved) {
           const parsed = JSON.parse(saved)
           if (parsed.smartRouting !== undefined) sm = parsed.smartRouting
           if (parsed.defaultModel) dm = parsed.defaultModel
        }
        const initialModels = sm ? ["claude-3-5-sonnet", "gpt-4o", "gemini-1.5-pro"] : [dm];
        runFullPipeline(textToAnalyze, initialModels)
      } catch (e) {
        console.error("Failed to parse input payload", e)
      }
    } else {
      router.push("/")
    }
  }, []) // eslint-disable-line

  const runFullPipeline = async (text: string, modelsToUse: string[]) => {
    setLoadingState("extracting")
    try {
      const extracted = await extractClaims(text, modelsToUse[0])
      
      if (extracted.length > 0 && (extracted[0] as any).isMock) {
        toast.warning("Mesh API rate limited or key invalid. Falling back to Demo Mode.");
      } else {
        toast.success(`Successfully extracted ${extracted.length} verifiable claims.`);
      }

      setLoadingState("retrieving")
      const claimsToAnalyze = extracted.slice(0, 5) 
      const detailedClaims: ClaimAnalysis[] = []
      
      for (const claim of claimsToAnalyze) {
        const snapshot = await gatherEvidence(claim.text)
        
        setLoadingState("analyzing") // Switch state as we pass to models
        const results = await analyzeClaim(claim.text, snapshot, modelsToUse)
        let totalConfidence = 0; let trueCount = 0; let falseCount = 0;
        
        results.forEach(r => {
          totalConfidence += r.confidence;
          if (r.verdict.includes("True")) trueCount++;
          if (r.verdict.includes("False")) falseCount++;
        });

        const avgConf = Math.round(totalConfidence / results.length);
        const agreementBonus = (results.length > 1 && (trueCount === results.length || falseCount === results.length)) ? 10 : 0;
        const finalConf = Math.min(100, avgConf + agreementBonus);
        const aggVerdict = trueCount > falseCount ? "Mostly True" : falseCount > trueCount ? "Mostly False" : "Mixed";

        detailedClaims.push({ 
          ...claim, 
          modelResults: results, 
          aggregatedVerdict: aggVerdict, 
          aggregatedConfidence: finalConf,
          snapshot: snapshot
        } as any)
      }

      setAnalyzedClaims(detailedClaims)
      if (detailedClaims.length > 0) {
        let totalScore = 0;
        detailedClaims.forEach(c => {
          totalScore += c.aggregatedVerdict === "Mostly True" ? c.aggregatedConfidence : (100 - c.aggregatedConfidence);
        });
        setOverallScore(Math.round(totalScore / detailedClaims.length));
        toast.success("Multi-model analysis complete.");
      } else {
        setOverallScore(0);
        toast.error("No claims found to analyze.");
      }
    } catch (error) {
      console.error("Pipeline error:", error)
    } finally {
      setLoadingState("done")
    }
  }



  const handleExport = async () => {
    const element = document.getElementById("pdf-report-content")
    if (!element) return;
    
    // Dynamically import html2pdf to avoid SSR 'self is not defined' error
    const html2pdf = (await import("html2pdf.js")).default;
    
    // Un-hide the branding header just for PDF, adjust styles
    element.classList.add("print-mode")
    const opt = {
      margin:       0.5,
      filename:     'veridica_report.pdf',
      image:        { type: 'jpeg' as const, quality: 0.98 },
      html2canvas:  { scale: 2, useCORS: true, logging: false },
      jsPDF:        { unit: 'in', format: 'letter', orientation: 'portrait' as const }
    };

    html2pdf().set(opt).from(element).save().then(() => {
      element.classList.remove("print-mode")
    });
  }

  const isOverallTrue = overallScore > 60;
  const isOverallMixed = overallScore >= 40 && overallScore <= 60;
  const overallVerdictText = analyzedClaims.length === 0 ? "UNKNOWN" : isOverallTrue ? "MOSTLY TRUE" : isOverallMixed ? "MIXED" : "MOSTLY FALSE"
  const verdictStyle = getVerdictStyle(overallVerdictText)

  const allSources = useMemo(() => {
    const sourcesMap = new Map();
    analyzedClaims.forEach(c => c.modelResults.forEach(m => m.key_sources.forEach(s => {
      if (!sourcesMap.has(s.title)) sourcesMap.set(s.title, s);
    })))
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

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <AboutModal />
            <Link href="https://github.com" target="_blank" rel="noreferrer">
              <Button variant="ghost" size="icon">
                <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
              </Button>
            </Link>
          </div>

          <div className="flex items-center gap-3 border-l pl-4">
            <Button variant="outline" size="sm" onClick={() => { sessionStorage.removeItem("veridica_input"); router.push("/") }}>
              <Plus className="w-4 h-4 mr-2" /> New Analysis
            </Button>
            <Button size="sm" className="bg-primary hover:bg-primary/90" onClick={handleExport}>
              <Download className="w-4 h-4 mr-2" /> Export Report
            </Button>
          </div>

          <div className="flex items-center gap-2 border-l pl-6">
            <Switch id="smart-routing" checked={smartRouting} onCheckedChange={setSmartRouting} />
            <label htmlFor="smart-routing" className="text-sm font-medium cursor-pointer text-muted-foreground">Smart Routing</label>
          </div>
          
          <div className="hidden md:flex items-center gap-2 border-l pl-6 relative">
            <span className="text-sm text-muted-foreground mr-2">Route to:</span>
            <div className="relative">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className={`min-w-[180px] justify-between ${smartRouting ? 'opacity-50 pointer-events-none' : ''}`}
              >
                {selectedModels.length === 1 ? (MODEL_DISPLAY_NAMES[selectedModels[0]] || selectedModels[0]) : `${selectedModels.length} Models Selected`}
                <ChevronDown className="w-4 h-4 ml-2 opacity-50" />
              </Button>
              {dropdownOpen && (
                <div className="absolute top-full right-0 mt-2 w-56 bg-card border border-primary/20 rounded-md shadow-xl z-50 p-2 flex flex-col gap-1">
                  {MODELS.map(m => (
                    <label key={m} className="flex items-center gap-3 px-2 py-2 hover:bg-muted rounded-md cursor-pointer text-sm font-medium transition-colors">
                      <input 
                        type="checkbox" 
                        className="rounded border-primary text-primary focus:ring-primary w-4 h-4 accent-primary"
                        checked={selectedModels.includes(m)}
                        onChange={(e) => {
                          let newModels;
                          if (e.target.checked) {
                            newModels = [...selectedModels, m];
                          } else {
                            newModels = selectedModels.filter(x => x !== m);
                            if (newModels.length === 0) newModels = [m]; // Prevent empty
                          }
                          setSelectedModels(newModels)
                        }}
                      />
                      {MODEL_DISPLAY_NAMES[m] || m}
                    </label>
                  ))}
                  <div className="border-t mt-2 pt-2 text-right">
                    <Button size="sm" className="w-full" onClick={() => {
                       setDropdownOpen(false)
                       if (originalInput) runFullPipeline(originalInput, selectedModels)
                    }}>Apply & Run</Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* 3-Column Main Content */}
      <div className="flex flex-1 overflow-hidden relative">
        
        {loadingState !== "idle" && loadingState !== "done" && (
          <div className="absolute inset-0 z-50 bg-background/80 backdrop-blur-md flex flex-col items-center justify-center animate-in fade-in duration-300">
            <Loader2 className="h-16 w-16 text-primary animate-spin mb-6" />
            <h2 className="text-3xl font-bold mb-3 tracking-tight">
              {loadingState === "extracting" && "Extracting verifiable claims..."}
              {loadingState === "retrieving" && "Research Agents gathering evidence..."}
              {loadingState === "analyzing" && "Consulting multiple models..."}
            </h2>
            <p className="text-muted-foreground text-lg">
              {loadingState === "retrieving" && "Simulating Gemini & Grok Searches, removing duplicates, and generating Evidence Snapshot..."}
              {loadingState === "analyzing" && (smartRouting ? `Using ${activeModels.map(m => MODEL_DISPLAY_NAMES[m]).join(", ")}` : `Using ${selectedModels.map(m => MODEL_DISPLAY_NAMES[m]).join(", ")}`)}
            </p>
          </div>
        )}

        {/* Left Sidebar */}
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
              <div className="space-y-3 animate-in slide-in-from-left-4 fade-in duration-700">
                {analyzedClaims.map((claim) => (
                  <Card key={claim.id} className="border-l-4 transition-all hover:shadow-md" style={{ borderLeftColor: getVerdictStyle(claim.aggregatedVerdict).indicator }}>
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
        <div className="flex-1 bg-background relative flex flex-col min-w-0">
          <div className="absolute inset-0 overflow-y-auto pb-32">
            <div id="pdf-report-content" className="max-w-4xl mx-auto p-6 md:p-8 space-y-8 pb-32 animate-in slide-in-from-bottom-8 fade-in duration-700 fill-mode-both">
              
              {/* PDF Header (Hidden normally, shown during print) */}
              <div className="hidden print-header mb-8 pb-4 border-b">
                <div className="flex items-center gap-2 mb-2">
                  <Network className="h-8 w-8 text-primary" />
                  <h1 className="text-3xl font-bold tracking-tight">Veridica Report</h1>
                </div>
                <p className="text-muted-foreground">Generated on {new Date().toLocaleDateString()}</p>
              </div>

              {/* Overview Card */}
              <Card className="bg-card border-primary/20 shadow-lg relative overflow-hidden">
                <div className="absolute top-0 right-0 p-8 opacity-5">
                  <Network className="w-48 h-48" />
                </div>
                <CardHeader>
                  <CardTitle className="text-2xl flex items-center gap-2">
                    Overall Verdict: <span className={`${verdictStyle.color} font-bold tracking-wide`}>{overallVerdictText}</span>
                  </CardTitle>
                  <CardDescription>Based on analysis from {smartRouting ? "an ensemble of AI models" : selectedModels.map(m => MODEL_DISPLAY_NAMES[m]).join(", ")}.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-col md:flex-row items-center gap-8">
                    <div className={`flex flex-col items-center justify-center w-36 h-36 shrink-0 rounded-full border-8 ${verdictStyle.border} ${verdictStyle.color} relative`}>
                      <span className="text-4xl font-bold">{overallScore}</span>
                      <span className="text-[10px] uppercase tracking-wider font-semibold text-center leading-tight mt-1 px-2">Evidence Score</span>
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold mb-2">Text Heatmap</h4>
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
                  {analyzedClaims.map((claim, index) => {
                    const style = getVerdictStyle(claim.aggregatedVerdict);
                    return (
                      <AccordionItem key={claim.id} value={`item-${claim.id}`} className={`border ${style.border} rounded-lg bg-card shadow-sm overflow-hidden hover:shadow-md transition-shadow animate-in slide-in-from-bottom-4 fade-in duration-500 fill-mode-both`} style={{ animationDelay: `${index * 150}ms` }}>
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
                          
                          <div>
                            <h4 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wider">Model Consensus</h4>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                              {claim.modelResults.map(res => {
                                const mStyle = getVerdictStyle(res.verdict);
                                return (
                                  <div key={res.model} className="p-4 border rounded-md bg-muted/30 flex flex-col justify-between">
                                    <div>
                                      <div className="flex items-center justify-between mb-2">
                                        <span className="font-medium text-sm">{MODEL_DISPLAY_NAMES[res.model] || res.model}</span>
                                        <span className={`text-xs font-bold ${mStyle.color}`}>{res.verdict}</span>
                                      </div>
                                      <p className="text-sm text-muted-foreground mb-4">
                                        {res.explanation}
                                      </p>
                                    </div>
                                    <div className="space-y-1.5">
                                      <div className="flex justify-between text-xs text-muted-foreground">
                                        <span>Confidence</span>
                                        <span>{res.confidence}%</span>
                                      </div>
                                      <Progress value={res.confidence} className={`h-1.5 ${mStyle.bg}`} indicatorColor={mStyle.indicator} />
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          </div>

                          {(claim as any).snapshot && (
                            <div>
                              <h4 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wider">Evidence Snapshot ({(claim as any).snapshot.sources.length} sources)</h4>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {(claim as any).snapshot.sources.map((source: any) => (
                                  <div key={source.id} className="p-3 border rounded-md bg-card flex flex-col text-sm">
                                    <div className="flex justify-between items-start mb-2">
                                      <span className="font-semibold">{source.title}</span>
                                      <Badge variant="outline" className="text-[10px] h-5 py-0">Found by {source.retrievedBy}</Badge>
                                    </div>
                                    <span className="text-xs text-muted-foreground mb-2 flex items-center gap-1"><ExternalLink className="w-3 h-3"/> {source.domain} (Reliability: {source.reliabilityScore})</span>
                                    <p className="text-muted-foreground italic text-xs">"{source.snippet}"</p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </AccordionContent>
                      </AccordionItem>
                    )
                  })}
                </Accordion>
              </div>

            </div>
            {/* Spacer block to guarantee scroll clearance for absolute chat input */}
            <div className="h-32 w-full shrink-0"></div>
          </div>

          {/* Ask Follow-up Input anchored at bottom */}
          <div className="absolute bottom-0 left-0 right-0 p-4 bg-background/80 backdrop-blur-md border-t">
            <div className="max-w-4xl mx-auto flex gap-2">
              <Input placeholder="Ask a follow-up question about these claims..." className="flex-1 bg-card" />
              <Button size="icon" className="shrink-0 bg-primary hover:bg-primary/90"><Send className="w-4 h-4" /></Button>
            </div>
          </div>
        </div>

        {/* Right Sidebar: Consensus & Sources */}
        <div className="w-80 border-l bg-muted/10 hidden xl:flex flex-col">
          <div className="p-6 border-b animate-in slide-in-from-right-4 fade-in duration-700">
            <h3 className="font-semibold text-sm text-muted-foreground mb-4">GLOBAL CONSENSUS</h3>
            <div className="space-y-4">
              {activeModels.map(model => {
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
          
          <div className="p-6 flex-1 flex flex-col min-h-0 animate-in slide-in-from-right-4 fade-in duration-700 delay-100">
            <h3 className="font-semibold text-sm text-muted-foreground mb-4">CITED SOURCES ({allSources.length})</h3>
            <ScrollArea className="flex-1 -mx-2 px-2">
              <div className="space-y-4">
                {allSources.length === 0 && <div className="text-xs text-muted-foreground text-center">No sources cited.</div>}
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

      <style dangerouslySetInnerHTML={{__html: `
        .print-mode {
          background: white !important;
          color: black !important;
        }
        .print-mode .print-header {
          display: block !important;
        }
        .print-mode .bg-card {
          background: white !important;
          border-color: #e5e7eb !important;
        }
        .print-mode mark {
          color: black !important;
        }
      `}} />
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
