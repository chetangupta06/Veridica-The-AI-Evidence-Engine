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
import { ArrowLeft, CheckCircle2, AlertTriangle, XCircle, ExternalLink, Network, Loader2, Download, Plus, Send, ChevronDown, ChevronUp, PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen, Brain, Check, FileText, Database, Activity, Award, Image } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { ThemeToggle } from "@/components/ThemeToggle"
import { AboutModal } from "@/components/AboutModal"
import Link from "next/link"
import { useRouter } from "next/navigation"
import React, { Suspense, useEffect, useState, useMemo, Fragment } from "react"
import { extractClaims, analyzeClaim, analyzeMisconception, type ExtractedClaim, type ClaimAnalysis, type ModelAnalysisResult } from "@/lib/mesh"
import { gatherEvidence, type EvidenceSnapshot } from "@/lib/retriever"

const DEFAULT_MODELS = ["anthropic/claude-3-haiku", "openai/gpt-4o-mini", "google/gemini-3.1-flash-lite"]
const DEFAULT_DISPLAY_NAMES: Record<string, string> = {
  "anthropic/claude-3-haiku": "Claude 3 Haiku",
  "openai/gpt-4o-mini": "GPT-4o Mini",
  "google/gemini-3.1-flash-lite": "Gemini 3.1 Flash Lite",
  "x-ai/grok-4.3": "Grok",
}

const getVerdictStyle = (verdict: string) => {
  const v = verdict.toLowerCase();
  if (v.includes("mostly true") || v === "true") return { color: "text-green-500", bg: "bg-green-500/10", border: "border-green-500/30", indicator: "bg-green-500", icon: <CheckCircle2 className="w-4 h-4 mr-1 inline" /> };
  if (v.includes("partially true") || v.includes("misleading") || v.includes("mixed")) return { color: "text-yellow-500", bg: "bg-yellow-500/10", border: "border-yellow-500/30", indicator: "bg-yellow-500", icon: <AlertTriangle className="w-4 h-4 mr-1 inline" /> };
  if (v.includes("false")) return { color: "text-red-500", bg: "bg-red-500/10", border: "border-red-500/30", indicator: "bg-red-500", icon: <XCircle className="w-4 h-4 mr-1 inline" /> };
  return { color: "text-gray-500", bg: "bg-gray-500/10", border: "border-gray-500/30", indicator: "bg-gray-500", icon: <AlertTriangle className="w-4 h-4 mr-1 inline" /> };
}

const SegmentedBar = ({ value, activeColor = "bg-primary" }: { value: number; activeColor?: string }) => {
  const filledCount = Math.round(value / 10);
  return (
    <div className="flex gap-0.5 items-center shrink-0">
      {Array.from({ length: 10 }).map((_, i) => (
        <div 
          key={i} 
          className={`h-2 w-2 rounded-[2px] transition-all duration-700 ease-out ${
            i < filledCount 
              ? activeColor 
              : "bg-muted/30 dark:bg-muted/10"
          }`}
        />
      ))}
      <span className="text-[10px] font-mono font-bold ml-1.5 text-muted-foreground w-8 text-right shrink-0">{value}%</span>
    </div>
  );
};


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
  const [selectedModels, setSelectedModels] = useState<string[]>([DEFAULT_MODELS[0]])
  const [dropdownOpen, setDropdownOpen] = useState(false)
  
  // Custom models from localStorage
  const [customModels, setCustomModels] = useState<{ id: string; name: string }[]>([])
  const allModels = [...DEFAULT_MODELS, ...customModels.map(m => m.id)]
  const getDisplayName = (modelId: string) => {
    if (DEFAULT_DISPLAY_NAMES[modelId]) return DEFAULT_DISPLAY_NAMES[modelId];
    const custom = customModels.find(m => m.id === modelId);
    return custom?.name || modelId.split('/').pop() || modelId;
  }
  
  const [originalInput, setOriginalInput] = useState("")
  const [loadingState, setLoadingState] = useState<"idle" | "extracting" | "retrieving" | "analyzing" | "done">("idle")
  
  const [leftSidebarOpen, setLeftSidebarOpen] = useState(true)
  const [rightSidebarOpen, setRightSidebarOpen] = useState(true)
  
  const [analyzedClaims, setAnalyzedClaims] = useState<ClaimAnalysis[]>([])
  const [overallScore, setOverallScore] = useState(0)
  const [ridiculousnessScore, setRidiculousnessScore] = useState(0)
  const [isHumorous, setIsHumorous] = useState(false)
  const [misconception, setMisconception] = useState("")
  const [isMisconceptionExpanded, setIsMisconceptionExpanded] = useState(true)
  
  // Redesign state variables
  const [activeTab, setActiveTab] = useState<"overview" | "claims" | "sources" | "consensus">("overview")
  const [inputCollapsed, setInputCollapsed] = useState(false)
  const [expandedClaims, setExpandedClaims] = useState<Record<number, boolean>>({})
  const [expandedModels, setExpandedModels] = useState<Record<string, boolean>>({})
  const [sourceExtractorModels, setSourceExtractorModels] = useState<string[]>(["openai/gpt-4o-mini"])

  const activeModels = smartRouting ? ["anthropic/claude-3-haiku", "openai/gpt-4o-mini", "google/gemini-3.1-flash-lite"] : selectedModels;

  useEffect(() => {
    // Load custom models from localStorage
    let loadedCustomModels: { id: string; name: string }[] = [];
    const savedModels = localStorage.getItem("veridica_custom_models")
    if (savedModels) {
      try { 
        loadedCustomModels = JSON.parse(savedModels);
        setCustomModels(loadedCustomModels) 
      } catch (e) {}
    }
    
    const validIds = [...DEFAULT_MODELS, ...loadedCustomModels.map(m => m.id)];
    
    // Load settings
    const saved = localStorage.getItem("veridica_settings")
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        if (parsed.smartRouting !== undefined) setSmartRouting(parsed.smartRouting)
        if (parsed.defaultModel) setSelectedModels([parsed.defaultModel])
        if (parsed.sourceExtractorModels) {
          setSourceExtractorModels(parsed.sourceExtractorModels)
        } else if (parsed.sourceExtractorModel) {
          setSourceExtractorModels([parsed.sourceExtractorModel]) // migrate old single string
        }
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
        // Check if payload specified custom routing and models.
        let sm = true; 
        let dm = DEFAULT_MODELS[0];
        let modelsList = [dm];
        let extractor = ["openai/gpt-4o-mini"];
        
        if (saved) {
           const parsed = JSON.parse(saved)
           if (parsed.smartRouting !== undefined) sm = parsed.smartRouting
           if (parsed.defaultModel && validIds.includes(parsed.defaultModel)) {
             dm = parsed.defaultModel
             modelsList = [dm]
           }
           if (parsed.sourceExtractorModels) {
             extractor = parsed.sourceExtractorModels;
             setSourceExtractorModels(extractor);
           } else if (parsed.sourceExtractorModel) {
             extractor = [parsed.sourceExtractorModel];
             setSourceExtractorModels(extractor);
           }
        }
        
        // Override with payload routing/models if provided
        if (payload.smartRouting !== undefined) {
          setSmartRouting(payload.smartRouting)
          sm = payload.smartRouting
        }
        if (payload.selectedModels && payload.selectedModels.length > 0) {
          const scrubbedModels = payload.selectedModels.filter((m: string) => validIds.includes(m));
          const finalModels = scrubbedModels.length > 0 ? scrubbedModels : [DEFAULT_MODELS[0]];
          setSelectedModels(finalModels)
          modelsList = finalModels
        }

        const initialModels = sm 
          ? ["anthropic/claude-3-haiku", "openai/gpt-4o-mini", "google/gemini-3.1-flash-lite"] 
          : modelsList;
          
        runFullPipeline(textToAnalyze, initialModels, extractor)
      } catch (e) {
        console.error("Failed to parse input payload", e)
      }
    } else {
      router.push("/")
    }
  }, []) // eslint-disable-line

  const runFullPipeline = async (text: string, modelsToUse: string[], extractorModels: string[]) => {
    setLoadingState("extracting")
    try {
      const result = await extractClaims(text, modelsToUse)
      setRidiculousnessScore(result.ridiculousnessScore)
      setIsHumorous(result.isHumorous)
      
      const extracted = result.claims;
      toast.success(`Successfully extracted ${extracted.length} verifiable claims.`);

      setLoadingState("retrieving")
      const claimsToAnalyze = extracted.slice(0, 5) 
      const detailedClaims: ClaimAnalysis[] = []
      
      for (const claim of claimsToAnalyze) {
        const snapshot = await gatherEvidence(claim.text, extractorModels)
        
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
        const aggVerdict = trueCount > falseCount ? (falseCount === 0 ? "True" : "Mostly True") : falseCount > trueCount ? (trueCount === 0 ? "False" : "Mostly False") : "Mixed";

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
          totalScore += c.aggregatedVerdict.includes("True") ? c.aggregatedConfidence : (100 - c.aggregatedConfidence);
        });
        const computedScore = Math.round(totalScore / detailedClaims.length);
        setOverallScore(computedScore);
        
        if (computedScore <= 60) {
          const fullSnapshot = { sources: [] as any[], context: "" };
          detailedClaims.forEach(c => {
            const snap = (c as any).snapshot;
            if (snap) {
              fullSnapshot.sources.push(...snap.sources);
              fullSnapshot.context += "\n" + snap.context;
            }
          });
          const explanation = await analyzeMisconception(text, fullSnapshot as unknown as EvidenceSnapshot, modelsToUse[0]);
          setMisconception(explanation);
        } else {
          setMisconception("");
        }
        
        toast.success("Multi-model analysis complete.");
        setInputCollapsed(true);
      } else {
        setOverallScore(0);
        toast.error("No claims found to analyze.");
      }
    } catch (error: any) {
      console.error("Pipeline error:", error)
      if (error.message === "API_KEY_MISSING") {
        toast.error("Mesh API Key missing. Please configure it in Settings.");
        router.push("/settings");
      } else {
        toast.error(error.message || "An error occurred during analysis. Check the console.");
      }
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

  let overallVerdictText = "UNKNOWN";
  if (analyzedClaims.length > 0) {
    if (overallScore >= 80) overallVerdictText = "TRUE";
    else if (overallScore > 60) overallVerdictText = "MOSTLY TRUE";
    else if (overallScore >= 40) overallVerdictText = "MIXED";
    else if (overallScore >= 20) overallVerdictText = "MOSTLY FALSE";
    else overallVerdictText = "FALSE";
  }
  const verdictStyle = getVerdictStyle(overallVerdictText)

  const allSources = useMemo(() => {
    const sourcesMap = new Map();
    analyzedClaims.forEach(c => {
      // Gather sources from the evidence snapshot instead of model citations
      if ((c as any).snapshot && (c as any).snapshot.sources) {
        (c as any).snapshot.sources.forEach((s: any) => {
          if (!sourcesMap.has(s.title)) sourcesMap.set(s.title, s);
        });
      }
    });
    return Array.from(sourcesMap.values());
  }, [analyzedClaims])

  const trustMetrics = useMemo(() => {
    if (analyzedClaims.length === 0) return { consensus: 0, quality: 0, consistency: 0 };
    
    let agreeCount = 0;
    analyzedClaims.forEach(c => {
      let trueVotes = 0; let falseVotes = 0;
      c.modelResults.forEach(r => {
        if (r.verdict.includes("True")) trueVotes++;
        if (r.verdict.includes("False")) falseVotes++;
      });
      agreeCount += Math.max(trueVotes, falseVotes) / (c.modelResults.length || 1);
    });
    
    const consensus = Math.round((agreeCount / analyzedClaims.length) * 100);
    const quality = allSources.length > 0 ? Math.round(allSources.reduce((acc, s) => acc + s.reliabilityScore, 0) / allSources.length) : 0;
    const consistency = Math.round(analyzedClaims.reduce((acc, c) => acc + c.aggregatedConfidence, 0) / (analyzedClaims.length || 1));
    
    return { consensus, quality, consistency };
  }, [analyzedClaims, allSources]);


  return (
    <div className="flex flex-col h-screen overflow-hidden bg-background">
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

        <div className="flex items-center gap-2 md:gap-4">
          <div className="flex items-center gap-1 md:gap-2">
            <ThemeToggle />
            <AboutModal />
            <Link href="https://github.com/chetangupta06/Veridica-The-AI-Evidence-Engine" target="_blank" rel="noreferrer">
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
                {selectedModels.length === 1 ? (getDisplayName(selectedModels[0]) || selectedModels[0]) : `${selectedModels.length} Models Selected`}
                <ChevronDown className="w-4 h-4 ml-2 opacity-50" />
              </Button>
              {dropdownOpen && (
                <div className="absolute top-full right-0 mt-2 w-56 bg-card border border-primary/20 rounded-md shadow-xl z-50 p-2 flex flex-col gap-1">
                  {allModels.map(m => (
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
                      {getDisplayName(m)}
                    </label>
                  ))}
                  <div className="border-t mt-2 pt-2 text-right">
                    <Button size="sm" className="w-full" onClick={() => {
                       setDropdownOpen(false)
                       if (originalInput) runFullPipeline(originalInput, selectedModels, sourceExtractorModels)
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
              {loadingState === "analyzing" && (smartRouting ? `Using ${activeModels.map(m => getDisplayName(m)).join(", ")}` : `Using ${selectedModels.map(m => getDisplayName(m)).join(", ")}`)}
            </p>
          </div>
        )}

        {/* Left Sidebar */}
        {leftSidebarOpen ? (
          <div className="w-72 border-r bg-muted/10 flex flex-col hidden lg:flex h-full transition-all">
            <div className="p-4 border-b">
              <button 
                onClick={() => setInputCollapsed(!inputCollapsed)}
                className="flex items-center justify-between w-full mb-2 hover:opacity-85 transition-opacity text-left"
              >
                <h3 className="font-semibold text-xs text-muted-foreground tracking-wider uppercase">Original Input</h3>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-muted-foreground/80 font-medium">
                    {inputCollapsed ? "Show" : "Hide"}
                  </span>
                  <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground/80 transition-transform duration-200 ${inputCollapsed ? "" : "rotate-180"}`} />
                </div>
              </button>
              
              {!inputCollapsed && (
                <div className="text-sm bg-card p-3 rounded-xl border shadow-sm max-h-[150px] overflow-y-auto font-medium text-foreground/90 animate-in fade-in slide-in-from-top-1 duration-200">
                  "{originalInput}"
                </div>
              )}

              {/* Multimodal Preview placeholder */}
              <div className="mt-3 border border-dashed border-muted-foreground/20 rounded-xl p-3 bg-muted/5 flex items-center justify-center gap-2 text-xs text-muted-foreground">
                <Image className="w-4 h-4 text-muted-foreground/60" />
                <span>No Image Uploaded</span>
              </div>
            </div>
            
            <div className="p-4 flex-1 flex flex-col min-h-0">
              <h3 className="font-semibold text-xs text-muted-foreground tracking-wider uppercase mb-4">Extracted Claims ({analyzedClaims.length})</h3>
              <ScrollArea className="flex-1 -mx-4 px-4 scrollbar-hide">
                <div className="space-y-2.5 animate-in slide-in-from-left-4 fade-in duration-700">
                  {analyzedClaims.map((claim) => (
                    <Card key={claim.id} className="border-l-4 rounded-xl transition-all hover:shadow-sm" style={{ borderLeftColor: getVerdictStyle(claim.aggregatedVerdict).indicator }}>
                      <CardContent className="p-3">
                        <p className="text-sm font-medium leading-normal text-foreground/90 line-clamp-3">{claim.text}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </ScrollArea>
            </div>
          </div>
        ) : (
          <div className="w-12 border-r bg-muted/20 flex flex-col hidden lg:flex items-center py-4 transition-all">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setLeftSidebarOpen(true)}>
              <PanelLeftOpen className="w-5 h-5 text-muted-foreground" />
            </Button>
          </div>
        )}

        {/* Main Area: Heatmap, Score, Verdicts */}
        <div className="flex-1 bg-background relative flex flex-col min-w-0">
          <div className="absolute inset-0 overflow-y-auto scrollbar-hide pb-32">
            <div key={loadingState} id="pdf-report-content" className="max-w-7xl mx-auto p-8 space-y-6 pb-32 animate-in slide-in-from-bottom-8 fade-in duration-700 fill-mode-both">
              
              {/* PDF Header (Hidden normally, shown during print) */}
              <div className="hidden print-header mb-8 pb-4 border-b">
                <div className="flex items-center gap-2 mb-2">
                  <Network className="h-8 w-8 text-primary" />
                  <h1 className="text-3xl font-bold tracking-tight">Veridica Report</h1>
                </div>
                <p className="text-muted-foreground">Generated on {new Date().toLocaleDateString()}</p>
              </div>

              {/* Hero Verdict */}
              <div className="border border-border/50 rounded-2xl p-6 bg-card shadow-sm space-y-4">
                <div className="flex items-center gap-3">
                  <span className={overallVerdictText === "TRUE" ? "text-emerald-500" : overallVerdictText === "FALSE" ? "text-red-500" : "text-amber-500"}>
                    {overallVerdictText === "TRUE" ? <CheckCircle2 className="w-12 h-12" /> : overallVerdictText === "FALSE" ? <XCircle className="w-12 h-12" /> : <AlertTriangle className="w-12 h-12" />}
                  </span>
                  <h1 className={`text-5xl font-extrabold tracking-tight ${
                    overallVerdictText === "TRUE" ? "text-emerald-500" : overallVerdictText === "FALSE" ? "text-red-500" : "text-amber-500"
                  }`}>
                    {overallVerdictText}
                  </h1>
                </div>
                
                <p className="text-base font-semibold leading-relaxed text-foreground">
                  {misconception ? (misconception.split('.').slice(0, 2).join('.') + '.') : (analyzedClaims[0]?.explanation ? (analyzedClaims[0].explanation.split('.')[0] + '.') : "Analyzing claim evidence...")}
                </p>
                
                <hr className="border-border/30" />
                
                <div className="flex flex-wrap items-center justify-between gap-4 text-xs font-semibold text-[#6B7280]">
                  <div className="flex items-center gap-4">
                    <span>Confidence <strong className="text-foreground font-bold">{Math.round(analyzedClaims.reduce((acc, c) => acc + c.aggregatedConfidence, 0) / (analyzedClaims.length || 1)) || 0}%</strong></span>
                    <span>•</span>
                    <span><strong className="text-foreground font-bold">{activeModels.length}/{activeModels.length}</strong> AI Models Agree</span>
                    <span>•</span>
                    <span><strong className="text-foreground font-bold">{allSources.length}</strong> Cited Sources</span>
                  </div>
                  
                  <div className="flex gap-2">
                    {isHumorous && (
                      <span className="bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 px-2 py-0.5 rounded-full text-[10px] tracking-wider uppercase font-extrabold">Humor</span>
                    )}
                    {ridiculousnessScore > 50 && (
                      <span className="bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 px-2 py-0.5 rounded-full text-[10px] tracking-wider uppercase font-extrabold">
                        {ridiculousnessScore > 80 ? "Satire" : "Silly"}
                      </span>
                    )}
                    <span className="bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded-full text-[10px] tracking-wider uppercase font-extrabold">AI Verified</span>
                  </div>
                </div>
              </div>

              {/* Key Metrics Stack (no dividers, whitespace) */}
              <div className="grid md:grid-cols-2 gap-6 border border-border/30 rounded-2xl p-6 bg-card shadow-sm">
                {/* Left: Trust Summary */}
                <div className="space-y-6">
                  <h3 className="text-xs font-bold text-[#6B7280] uppercase tracking-widest">Trust Summary</h3>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between gap-2 min-w-0">
                      <span className="text-xs font-semibold text-foreground/80 truncate">Evidence Strength</span>
                      <SegmentedBar value={overallScore} activeColor={overallScore <= 30 ? "bg-red-500" : overallScore <= 70 ? "bg-amber-500" : "bg-emerald-500"} />
                    </div>
                    <div className="flex items-center justify-between gap-2 min-w-0">
                      <span className="text-xs font-semibold text-foreground/80 truncate">Scientific Consensus</span>
                      <SegmentedBar value={trustMetrics.consensus} activeColor="bg-blue-500" />
                    </div>
                    <div className="flex items-center justify-between gap-2 min-w-0">
                      <span className="text-xs font-semibold text-foreground/80 truncate">Source Quality</span>
                      <SegmentedBar value={trustMetrics.quality} activeColor="bg-emerald-500" />
                    </div>
                    <div className="flex items-center justify-between gap-2 min-w-0">
                      <span className="text-xs font-semibold text-foreground/80 truncate">Reasoning Consistency</span>
                      <SegmentedBar value={trustMetrics.consistency} activeColor="bg-blue-500" />
                    </div>
                  </div>
                </div>
                
                {/* Right: Evidence & Ridiculousness (Supplementary) */}
                <div className="flex flex-col justify-between space-y-6">
                  <div>
                    <h3 className="text-xs font-bold text-[#6B7280] uppercase tracking-widest mb-3">Evidence Grade</h3>
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-primary/5 rounded-xl border border-primary/10">
                        <Brain className={`w-8 h-8 ${overallScore <= 30 ? "text-red-500" : overallScore <= 70 ? "text-amber-500" : "text-emerald-500"}`} />
                      </div>
                      <div>
                        <div className="text-2xl font-bold font-mono tracking-tight text-foreground">{overallScore}/100</div>
                        <div className={`text-xs font-bold uppercase tracking-wider ${overallScore <= 30 ? "text-red-500" : overallScore <= 70 ? "text-amber-500" : "text-emerald-500"}`}>
                          {overallScore <= 30 ? "Weak Evidence" : overallScore <= 70 ? "Moderate Evidence" : "Strong Evidence"}
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div>
                    <h3 className="text-xs font-bold text-[#6B7280] uppercase tracking-widest mb-2">Ridiculousness</h3>
                    {loadingState === "extracting" ? (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Calculating...</span>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <div className="flex gap-0.5 items-center">
                          {Array.from({ length: 10 }).map((_, i) => (
                            <div 
                              key={i} 
                              className={`h-2 w-2 rounded-[2px] transition-all duration-500 ${
                                i < Math.round(ridiculousnessScore / 10) 
                                  ? "bg-purple-500" 
                                  : "bg-muted/30 dark:bg-muted/10"
                              }`}
                            />
                          ))}
                          <span className="text-[10px] font-mono font-bold ml-1.5 text-purple-600 dark:text-purple-400">{ridiculousnessScore}%</span>
                        </div>
                        <div className="text-[10px] font-extrabold uppercase tracking-widest text-purple-500/80">
                          {ridiculousnessScore > 80 ? "ABSURD" : ridiculousnessScore > 50 ? "SILLY" : ridiculousnessScore > 20 ? "QUESTIONABLE" : "SERIOUS"}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Why This Verdict */}
              <div className="border border-border/30 rounded-2xl p-6 bg-card shadow-sm space-y-4">
                <h3 className="text-xs font-bold text-[#6B7280] uppercase tracking-widest">Why This Verdict</h3>
                <ul className="space-y-3 pl-1">
                  {analyzedClaims.slice(0, 4).map((claim, i) => {
                    const isTrue = claim.aggregatedVerdict.includes("True");
                    const shortSummary = claim.explanation ? (claim.explanation.split('.')[0] + '.') : "Reasoning summary not available.";
                    return (
                      <li key={i} className="flex items-start gap-2.5 text-sm">
                        <span className="mt-0.5 shrink-0">
                          {isTrue ? (
                            <Check className="w-4 h-4 text-emerald-500" />
                          ) : (
                            <XCircle className="w-4 h-4 text-red-500" />
                          )}
                        </span>
                        <span className="text-foreground/90 font-medium leading-relaxed">
                          <strong>{claim.text}:</strong> {shortSummary}
                        </span>
                      </li>
                    );
                  })}
                  {analyzedClaims.length === 0 && <li className="text-sm text-muted-foreground">Waiting for consensus findings...</li>}
                </ul>
                
                <div className="pt-2 border-t border-border/30 text-xs font-medium text-[#6B7280]">
                  <span>Sources: </span>
                  {allSources.length > 0 ? (
                    <span className="text-foreground/80 font-semibold">
                      {allSources.slice(0, 5).map(s => s.domain).join(" • ")}
                      {allSources.length > 5 && ` • and ${allSources.length - 5} more`}
                    </span>
                  ) : (
                    <span>No cited domains loaded yet.</span>
                  )}
                </div>
              </div>

              {/* Tabs Navigation & Deep Dive Content */}
              <div className="space-y-6 pt-4">
                {/* Tab Navigation */}
                <div className="flex border-b border-border/30 gap-6 text-sm font-semibold tracking-wide">
                  {(["overview", "claims", "sources", "consensus"] as const).map(tab => (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      className={`pb-3 capitalize transition-all relative ${
                        activeTab === tab 
                          ? "text-primary border-b-2 border-primary font-bold" 
                          : "text-muted-foreground hover:text-foreground/80"
                      }`}
                    >
                      {tab === "consensus" ? "Model Consensus" : tab === "sources" ? "Cited Sources" : tab}
                    </button>
                  ))}
                </div>
                
                {/* Tab Content Panels */}
                <div className="animate-in fade-in duration-300">
                  {activeTab === "overview" && (
                    <div className="space-y-6">
                      {/* Why People Believe This */}
                      {misconception && (
                        <div className="border border-orange-500/20 rounded-2xl relative z-10 overflow-hidden bg-orange-500/5">
                          <button
                            onClick={() => setIsMisconceptionExpanded(!isMisconceptionExpanded)}
                            className="w-full flex items-center justify-between px-6 py-4 hover:bg-orange-500/10 transition-colors text-left"
                          >
                            <div className="flex items-center gap-3">
                              <AlertTriangle className="w-5 h-5 text-orange-500 shrink-0" />
                              <h3 className="text-sm font-bold text-orange-600 dark:text-orange-400 uppercase tracking-wider">
                                Why People Believe This
                              </h3>
                            </div>
                            <ChevronDown className={`w-5 h-5 text-orange-500 transition-transform duration-200 ${isMisconceptionExpanded ? "rotate-180" : ""}`} />
                          </button>
                          
                          {isMisconceptionExpanded && (
                            <div className="px-6 pb-5 pt-1 animate-in fade-in slide-in-from-top-2 duration-200">
                              <p className="text-sm text-foreground/90 leading-relaxed font-medium pl-8">
                                {misconception}
                              </p>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Source Text Heatmap */}
                      <div className="space-y-3">
                        <h3 className="text-xs font-bold text-[#6B7280] uppercase tracking-widest px-1">Source Text Heatmap</h3>
                        <div className="bg-card border border-border/30 shadow-sm p-6 rounded-2xl text-lg leading-relaxed font-medium">
                          <HeatmapText text={originalInput} claims={analyzedClaims} />
                        </div>
                      </div>
                      
                      {/* Multimodal Preview placeholder */}
                      <div className="border border-dashed border-border/30 rounded-2xl p-6 bg-muted/5 flex flex-col items-center justify-center gap-3 text-center">
                        <Image className="w-8 h-8 text-muted-foreground/40" />
                        <div>
                          <h4 className="text-sm font-semibold text-foreground/80">Multimodal Image Context</h4>
                          <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                            Veridica supports analyzing claims extracted from diagrams, screenshots, or receipts. Uploaded documents will preview here.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {activeTab === "claims" && (
                    <div className="space-y-4">
                      {analyzedClaims.length === 0 && (
                        <div className="text-center p-8 text-muted-foreground border border-dashed rounded-2xl">
                          No claims extracted.
                        </div>
                      )}
                      {analyzedClaims.map((claim) => {
                        const style = getVerdictStyle(claim.aggregatedVerdict);
                        const isExpanded = expandedClaims[claim.id] || false;
                        
                        return (
                          <div 
                            key={claim.id} 
                            className={`border ${style.border} rounded-2xl bg-card shadow-sm overflow-hidden hover:shadow-md transition-shadow`}
                          >
                            {/* GitHub PR Comment style header */}
                            <div className="px-6 py-4 flex items-center justify-between gap-4 border-b border-border/30 bg-muted/10">
                              <div className="flex items-center gap-3 min-w-0">
                                <span className="text-xs font-bold text-muted-foreground shrink-0 uppercase tracking-wider">Claim {claim.id}</span>
                                <span className="text-sm font-bold text-foreground leading-normal truncate">{claim.text}</span>
                              </div>
                              <Badge variant="outline" className={`${style.color} border-current shrink-0 text-xs px-2.5 py-0.5 rounded-md`}>
                                {claim.aggregatedVerdict}
                              </Badge>
                            </div>
                            
                            <div className="px-6 py-4">
                              <button
                                onClick={() => setExpandedClaims(prev => ({ ...prev, [claim.id]: !isExpanded }))}
                                className="text-xs font-bold text-[#60A5FA] flex items-center gap-1 hover:underline cursor-pointer"
                              >
                                {isExpanded ? "Collapse analysis ↑" : "Expand analysis →"}
                              </button>
                              
                              {isExpanded && (
                                <div className="mt-4 pt-4 border-t border-border/20 space-y-6 animate-in fade-in slide-in-from-top-2 duration-200">
                                  <div>
                                    <h4 className="text-xs font-bold text-[#6B7280] uppercase tracking-wider mb-3">Model Consensus</h4>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                      {claim.modelResults.map(res => {
                                        const mStyle = getVerdictStyle(res.verdict);
                                        return (
                                          <div key={res.model} className="p-4 border border-border/30 rounded-xl bg-muted/10 flex flex-col justify-between">
                                            <div>
                                              <div className="flex items-center justify-between mb-2">
                                                <span className="font-semibold text-xs text-foreground/80">{getDisplayName(res.model)}</span>
                                                <span className={`text-xs font-extrabold ${mStyle.color}`}>{res.verdict}</span>
                                              </div>
                                              <p className="text-xs text-[#9CA3AF] mb-2 leading-relaxed line-clamp-6">
                                                {res.explanation}
                                              </p>
                                              {res.explanation.length > 200 && (
                                                <Dialog>
                                                  <DialogTrigger className="text-[10px] font-bold text-[#60A5FA] mb-3 hover:underline text-left cursor-pointer block">
                                                    See more
                                                  </DialogTrigger>
                                                  <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                                                    <DialogHeader>
                                                      <DialogTitle>{getDisplayName(res.model)} Analysis</DialogTitle>
                                                      <DialogDescription>
                                                        Detailed explanation of this claim analysis.
                                                      </DialogDescription>
                                                    </DialogHeader>
                                                    <div className="text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap mt-4">
                                                      {res.explanation}
                                                    </div>
                                                  </DialogContent>
                                                </Dialog>
                                              )}
                                            </div>
                                            <div className="space-y-1.5">
                                              <div className="flex justify-between text-[10px] font-bold text-muted-foreground">
                                                <span>Confidence</span>
                                                <span>{res.confidence}%</span>
                                              </div>
                                              <Progress value={res.confidence} className={`h-1 ${mStyle.bg}`} indicatorColor={mStyle.indicator} />
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  
                  {activeTab === "sources" && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {allSources.length === 0 && (
                        <div className="col-span-2 text-center p-8 text-muted-foreground border border-dashed rounded-2xl">
                          No sources cited.
                        </div>
                      )}
                      {allSources.map((source, i) => (
                        <div key={i} className="border border-border/30 rounded-2xl p-5 bg-card flex flex-col justify-between gap-4">
                          <div>
                            <h4 className="text-base font-bold text-foreground leading-normal line-clamp-1">{source.title}</h4>
                            <p className="text-xs text-muted-foreground font-semibold mt-0.5">{source.domain}</p>
                          </div>
                          <div className="flex items-center justify-between pt-2 border-t border-border/20">
                            <span className={`text-sm font-bold ${
                              source.reliabilityScore >= 90 ? 'text-green-500' : source.reliabilityScore >= 80 ? 'text-yellow-500' : 'text-red-500'
                            }`}>
                              {source.reliabilityScore} Reliability
                            </span>
                            <a 
                              href={source.url || "#"} 
                              target="_blank" 
                              rel="noopener noreferrer" 
                              className="text-xs font-bold text-[#60A5FA] flex items-center gap-1 hover:underline cursor-pointer"
                            >
                              Open →
                            </a>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {activeTab === "consensus" && (
                    <div className="border border-border/30 rounded-2xl overflow-hidden bg-card">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-muted/10 text-xs font-bold text-[#6B7280] uppercase tracking-wider border-b border-border/30">
                            <th className="px-6 py-4">Model</th>
                            <th className="px-6 py-4">Verdict</th>
                            <th className="px-6 py-4 text-right">Confidence</th>
                            <th className="px-6 py-4 text-right">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/20 text-sm font-medium">
                          {activeModels.map(model => {
                            let trueCount = 0; let falseCount = 0; let totalConf = 0;
                            let explanations: string[] = [];
                            analyzedClaims.forEach(c => {
                              const res = c.modelResults.find(r => r.model === model);
                              if (res) {
                                totalConf += res.confidence;
                                explanations.push(res.explanation);
                                if (res.verdict.includes("True")) trueCount++;
                                if (res.verdict.includes("False")) falseCount++;
                              }
                            });
                            const globalVerdict = trueCount > falseCount ? (falseCount === 0 ? "True" : "Mostly True") : falseCount > trueCount ? (trueCount === 0 ? "False" : "Mostly False") : "Mixed";
                            const avgConfidence = analyzedClaims.length > 0 ? Math.round(totalConf / analyzedClaims.length) : 0;
                            const mStyle = getVerdictStyle(globalVerdict);
                            const isExpanded = expandedModels[model] || false;
                            
                            return (
                              <React.Fragment key={model}>
                                <tr className="hover:bg-muted/5 transition-colors">
                                  <td className="px-6 py-4 font-bold text-foreground">{getDisplayName(model)}</td>
                                  <td className="px-6 py-4">
                                    <span className={`text-xs font-extrabold ${mStyle.color}`}>{globalVerdict}</span>
                                  </td>
                                  <td className="px-6 py-4 text-right font-mono font-bold text-foreground/80">{avgConfidence}%</td>
                                  <td className="px-6 py-4 text-right">
                                    <button
                                      onClick={() => setExpandedModels(prev => ({ ...prev, [model]: !isExpanded }))}
                                      className="text-xs font-bold text-[#60A5FA] hover:underline cursor-pointer"
                                    >
                                      {isExpanded ? "Collapse explanation ↑" : "Read explanation →"}
                                    </button>
                                  </td>
                                </tr>
                                {isExpanded && (
                                  <tr>
                                    <td colSpan={4} className="px-6 py-4 bg-muted/5 border-t border-b border-border/20">
                                      <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2">
                                        {explanations.map((exp, idx) => (
                                          <div key={idx} className="text-xs text-[#9CA3AF] leading-relaxed border-l-2 border-border/30 pl-3">
                                            <strong className="text-foreground/80 block mb-1">Claim {idx+1} Consensus:</strong>
                                            "{exp}"
                                          </div>
                                        ))}
                                        {explanations.length === 0 && <div className="text-xs text-muted-foreground">No explanations loaded.</div>}
                                      </div>
                                    </td>
                                  </tr>
                                )}
                              </React.Fragment>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
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

        {/* Right Sidebar */}
        {rightSidebarOpen ? (
          <div className="w-80 border-l bg-muted/10 flex flex-col hidden lg:flex h-full transition-all">
            <div className="p-6 pb-4 border-b">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-sm text-muted-foreground">GLOBAL CONSENSUS</h3>
                <Button variant="ghost" size="icon" className="h-6 w-6 -mr-2" onClick={() => setRightSidebarOpen(false)}>
                  <PanelRightClose className="w-4 h-4 text-muted-foreground" />
                </Button>
              </div>
              <div className="space-y-3">
                {activeModels.map(model => {
                  let trueCount = 0; let falseCount = 0;
                  analyzedClaims.forEach(c => {
                    const res = c.modelResults.find(r => r.model === model);
                    if (res?.verdict.includes("True")) trueCount++;
                    if (res?.verdict.includes("False")) falseCount++;
                  })
                  const globalVerdict = trueCount > falseCount ? (falseCount === 0 ? "True" : "Mostly True") : falseCount > trueCount ? (trueCount === 0 ? "False" : "Mostly False") : "Mixed";
                  const mStyle = getVerdictStyle(globalVerdict);
                  
                  return (
                    <div key={model} className="flex justify-between items-center text-sm">
                      <span>{getDisplayName(model)}</span>
                      <Badge variant="outline" className={`${mStyle.color} ${mStyle.border}`}>
                        {globalVerdict}
                      </Badge>
                    </div>
                  )
                })}
              </div>
            </div>
            
            <div className="p-6 flex-1 flex flex-col min-h-0 animate-in slide-in-from-right-4 fade-in duration-700 delay-100">
              <h3 className="font-semibold text-sm text-muted-foreground mb-4 shrink-0">CITED SOURCES ({allSources.length})</h3>
              <div className="flex-1 overflow-y-auto scrollbar-hide min-h-0 -mx-2 px-2">
                  <div className="space-y-4 pr-3">
                    {allSources.length === 0 && <div className="text-xs text-muted-foreground text-center">No sources cited.</div>}
                  {allSources.map((source, i) => (
                    <a key={i} href={source.url || "#"} target="_blank" rel="noopener noreferrer" className="group cursor-pointer block hover:bg-muted/50 p-2 -mx-2 rounded-md transition-colors">
                      <h4 className="text-sm font-medium group-hover:text-primary transition-colors line-clamp-2">
                        {source.title}
                      </h4>
                      <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1 group-hover:text-primary transition-colors">
                          <ExternalLink className="w-3 h-3" />
                          {source.domain}
                        </span>
                        <span>•</span>
                        <span className={source.reliabilityScore >= 90 ? 'text-green-500' : source.reliabilityScore >= 80 ? 'text-yellow-500' : 'text-red-500'}>
                          Reliability: {source.reliabilityScore}
                        </span>
                      </div>
                      {source.retrievedBy && (
                        <div className="text-[10px] text-muted-foreground/70 mt-1 uppercase tracking-wider">
                          Found by {source.retrievedBy}
                        </div>
                      )}
                    </a>
                  ))}
                  </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="w-12 border-l bg-muted/10 flex flex-col hidden lg:flex items-center py-4 h-full transition-all">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setRightSidebarOpen(true)}>
              <PanelRightOpen className="w-5 h-5 text-muted-foreground" />
            </Button>
          </div>
        )}

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
