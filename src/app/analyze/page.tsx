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
import { ArrowLeft, CheckCircle2, AlertTriangle, XCircle, ExternalLink, Network, Loader2, Download, Plus, Send, ChevronDown, ChevronUp, PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen, Brain, Check, FileText, Database, Activity, Award, Image, Search } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { ThemeToggle } from "@/components/ThemeToggle"
import { AboutModal } from "@/components/AboutModal"
import Link from "next/link"
import { useRouter } from "next/navigation"
import React, { Suspense, useEffect, useState, useMemo, Fragment } from "react"
import { extractClaims, analyzeClaim, analyzeMisconception, type ExtractedClaim, type ClaimAnalysis, type ModelAnalysisResult } from "@/lib/mesh"
import { gatherEvidence, type EvidenceSnapshot } from "@/lib/retriever"
import { useMeshModels } from "@/lib/useMeshModels"
import { determineOptimalModels, determineOptimalExtractors } from "@/lib/smartRouter"

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
  const [apiKey] = useState("");
  const { models: availableModels } = useMeshModels(apiKey);
  const [smartRouting, setSmartRouting] = useState(true)
  const [smartExtractorRouting, setSmartExtractorRouting] = useState(true)
  const [selectedModels, setSelectedModels] = useState<string[]>([DEFAULT_MODELS[0]])
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [customModels, setCustomModels] = useState<{ id: string; name: string }[]>([])
  const allModels = [...DEFAULT_MODELS, ...customModels.map(m => m.id)]
  const getDisplayName = (modelId: string) => {
    if (DEFAULT_DISPLAY_NAMES[modelId]) return DEFAULT_DISPLAY_NAMES[modelId];
    const custom = customModels.find(m => m.id === modelId);
    return custom?.name || modelId.split('/').pop() || modelId;
  }
  
  const [originalInput, setOriginalInput] = useState("")
  const [uploadedImage, setUploadedImage] = useState<string | null>(null)
  const [loadingState, setLoadingState] = useState<"idle" | "extracting" | "retrieving" | "analyzing" | "done">("idle")
  
  const [leftSidebarOpen, setLeftSidebarOpen] = useState(true)
  const [rightSidebarOpen, setRightSidebarOpen] = useState(false)
  
  const [analyzedClaims, setAnalyzedClaims] = useState<ClaimAnalysis[]>([])
  const [overallScore, setOverallScore] = useState(0)
  const [ridiculousnessScore, setRidiculousnessScore] = useState(0)
  const [isHumorous, setIsHumorous] = useState(false)
  const [misconception, setMisconception] = useState("")
  const [isMisconceptionExpanded, setIsMisconceptionExpanded] = useState(true)
  
  // Redesign state variables
  const [activeTab, setActiveTab] = useState<"overview" | "claims" | "sources" | "consensus">("overview")
  const [inputCollapsed, setInputCollapsed] = useState(false)
  const [reportDate, setReportDate] = useState("")
  
  useEffect(() => {
    setReportDate(new Date().toLocaleDateString())
  }, [])
  const [expandedClaims, setExpandedClaims] = useState<Record<number, boolean>>({})
  const [expandedModels, setExpandedModels] = useState<Record<string, boolean>>({})
  const [sourceExtractorModels, setSourceExtractorModels] = useState<string[]>(["openai/gpt-4o-mini"])
  
  // Chat state
  const [chatMessages, setChatMessages] = useState<{role: string; content: string}[]>([])
  const [chatModel, setChatModel] = useState<string>("")
  const [chatInput, setChatInput] = useState("")
  const [isChatLoading, setIsChatLoading] = useState(false)
  const [isChatOpen, setIsChatOpen] = useState(false)

  const activeModels = useMemo(() => {
    if (smartRouting && originalInput) {
      const availableModelsList = availableModels.map(m => typeof m === 'string' ? m : (m as any).id || "");
      return determineOptimalModels(originalInput, !!uploadedImage, availableModelsList); 
    }
    return selectedModels.length > 0 ? selectedModels : [DEFAULT_MODELS[0]];
  }, [smartRouting, originalInput, uploadedImage, selectedModels, availableModels]);

  useEffect(() => {
    if (!chatModel && activeModels.length > 0) {
      setChatModel(activeModels[0]);
    }
  }, [activeModels, chatModel]);

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
        const textToAnalyze = payload.content || ""
        if (!textToAnalyze) throw new Error("No content to analyze")
        
        setOriginalInput(textToAnalyze)

        let sm = true; 
        let dm = DEFAULT_MODELS[0];
        let ser = true;
        let modelsList = [dm];
        let extractor = ["openai/gpt-4o-mini"];
        
        if (saved) {
           const parsed = JSON.parse(saved)
           if (parsed.smartRouting !== undefined) sm = parsed.smartRouting
           if (parsed.smartExtractorRouting !== undefined) {
             ser = parsed.smartExtractorRouting
             setSmartExtractorRouting(ser)
           }
           if (parsed.defaultModel) {
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
        
        if (payload.smartRouting !== undefined) {
          setSmartRouting(payload.smartRouting)
          sm = payload.smartRouting
        }
        if (payload.selectedModels && payload.selectedModels.length > 0) {
          setSelectedModels(payload.selectedModels)
          modelsList = payload.selectedModels
        }

        const initialModels = sm 
          ? determineOptimalModels(textToAnalyze, !!payload.image, availableModels.length > 0 ? availableModels.map(m => typeof m === 'string' ? m : (m as any).id || "") : ["openai/gpt-4o-mini", "anthropic/claude-3.5-sonnet", "deepseek/deepseek-coder"])
          : modelsList;

        const initialExtractors = ser
          ? determineOptimalExtractors(textToAnalyze, availableModels.length > 0 ? availableModels.map(m => typeof m === 'string' ? m : (m as any).id || "") : ["openai/gpt-4o-mini", "anthropic/claude-3-haiku"])
          : extractor;
          
        if (payload.image) {
          setUploadedImage(payload.image)
        }

        runFullPipeline(textToAnalyze, payload.image || null, initialModels, initialExtractors)
      } catch (e) {
        console.error("Failed to parse input payload", e)
      }
    } else {
      router.push("/search")
    }
  }, []) // eslint-disable-line

  const runFullPipeline = async (text: string, image: string | null, modelsToUse: string[], extractorModels: string[]) => {
    setLoadingState("extracting")
    try {
      const result = await extractClaims(text, image, modelsToUse)
      setRidiculousnessScore(result.ridiculousnessScore)
      setIsHumorous(result.isHumorous)
      
      const extracted = result.claims;
      toast.success(`Successfully extracted ${extracted.length} verifiable claims.`);

      setLoadingState("retrieving")
      const claimsToAnalyze = extracted.slice(0, 5) 
      setLoadingState("analyzing")
      const detailedClaims: ClaimAnalysis[] = await Promise.all(
        claimsToAnalyze.map(async (claim) => {
          if (claim.claimType === "Personal") {
            const results = modelsToUse.map(model => ({
              model: model,
              verdict: "Unverifiable" as const,
              confidence: 100,
              explanation: "This is a personal claim. Without access to the person's records or independent evidence, it cannot be verified or disproven.",
              key_sources: []
            }));
            const snapshot = {
              claim_analyzed: claim.text,
              total_sources_found: 0,
              sources: [],
              context: "Skipped web search: Semantic classifier detected a personal claim."
            };
            
            return {
              ...claim,
              modelResults: results,
              aggregatedVerdict: "Unverifiable",
              aggregatedConfidence: 100,
              snapshot: snapshot
            } as any;
          }

          const snapshot = await gatherEvidence(claim.text, extractorModels)
          const results = await analyzeClaim(claim.text, snapshot, modelsToUse)
          
          let totalConfidence = 0; let trueCount = 0; let falseCount = 0; let unvCount = 0;
          
          results.forEach(r => {
            totalConfidence += r.confidence;
            if (r.verdict.includes("True")) trueCount++;
            else if (r.verdict.includes("False")) falseCount++;
            else if (r.verdict.includes("Unverifiable")) unvCount++;
          });

          const avgConf = Math.round(totalConfidence / results.length);
          const agreementBonus = (results.length > 1 && (trueCount === results.length || falseCount === results.length)) ? 10 : 0;
          const finalConf = Math.min(100, avgConf + agreementBonus);
          
          let aggVerdict = "Mixed";
          if (unvCount > trueCount && unvCount > falseCount) aggVerdict = "Unverifiable";
          else if (trueCount > falseCount) aggVerdict = falseCount === 0 ? "True" : "Mostly True";
          else if (falseCount > trueCount) aggVerdict = trueCount === 0 ? "False" : "Mostly False";

          return { 
            ...claim, 
            modelResults: results, 
            aggregatedVerdict: aggVerdict, 
            aggregatedConfidence: finalConf,
            snapshot: snapshot
          } as any;
        })
      );

      setAnalyzedClaims(detailedClaims)
      if (detailedClaims.length > 0) {
        let totalScore = 0;
        let verifiableCount = 0;
        detailedClaims.forEach(c => {
          if (!c.aggregatedVerdict.includes("Unverifiable")) {
            totalScore += c.aggregatedVerdict.includes("True") ? c.aggregatedConfidence : (100 - c.aggregatedConfidence);
            verifiableCount++;
          }
        });
        const computedScore = verifiableCount > 0 ? Math.round(totalScore / verifiableCount) : 0;
        setOverallScore(computedScore);
        
        if (computedScore <= 90 && verifiableCount > 0) {
          const fullSnapshot = { sources: [] as any[], context: "" };
          detailedClaims.forEach(c => {
            const snap = (c as any).snapshot;
            if (snap) {
              fullSnapshot.sources.push(...snap.sources);
              fullSnapshot.context += "\n" + snap.context;
            }
          });
          let pipelineVerdictText = "UNKNOWN";
          const isAllUnverifiable = detailedClaims.every(c => c.aggregatedVerdict.includes("Unverifiable"));
          if (isAllUnverifiable) pipelineVerdictText = "UNVERIFIABLE";
          else if (computedScore >= 80) pipelineVerdictText = "TRUE";
          else if (computedScore > 60) pipelineVerdictText = "MOSTLY TRUE";
          else if (computedScore >= 40) pipelineVerdictText = "MIXED";
          else if (computedScore >= 20) pipelineVerdictText = "MOSTLY FALSE";
          else pipelineVerdictText = "FALSE";

          const explanation = await analyzeMisconception(text, fullSnapshot as unknown as EvidenceSnapshot, modelsToUse[0], pipelineVerdictText);
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
    window.print();
  }

  let overallVerdictText = "UNKNOWN";
  if (analyzedClaims.length > 0) {
    const isAllUnverifiable = analyzedClaims.every(c => c.aggregatedVerdict.includes("Unverifiable"));
    if (isAllUnverifiable) overallVerdictText = "UNVERIFIABLE";
    else if (overallScore >= 80) overallVerdictText = "TRUE";
    else if (overallScore > 60) overallVerdictText = "MOSTLY TRUE";
    else if (overallScore >= 40) overallVerdictText = "MIXED";
    else if (overallScore >= 20) overallVerdictText = "MOSTLY FALSE";
    else overallVerdictText = "FALSE";
  }
  const verdictStyle = getVerdictStyle(overallVerdictText)

  let agreeingModelsCount = 0;
  if (analyzedClaims.length > 0 && activeModels.length > 0) {
    activeModels.forEach(model => {
      let trueCount = 0; let falseCount = 0; let unvCount = 0;
      analyzedClaims.forEach(c => {
        const res = c.modelResults.find(r => r.model === model);
        if (res?.verdict.includes("True")) trueCount++;
        else if (res?.verdict.includes("False")) falseCount++;
        else if (res?.verdict.includes("Unverifiable")) unvCount++;
      });
      
      let globalVerdict = "MIXED";
      if (unvCount > trueCount && unvCount > falseCount) globalVerdict = "UNVERIFIABLE";
      else if (trueCount > falseCount) globalVerdict = falseCount === 0 ? "TRUE" : "MOSTLY TRUE";
      else if (falseCount > trueCount) globalVerdict = trueCount === 0 ? "FALSE" : "MOSTLY FALSE";
      
      if (
        (overallVerdictText.includes("TRUE") && globalVerdict.includes("TRUE")) ||
        (overallVerdictText.includes("FALSE") && globalVerdict.includes("FALSE")) ||
        (overallVerdictText === "UNVERIFIABLE" && globalVerdict === "UNVERIFIABLE") ||
        (overallVerdictText === "MIXED" && globalVerdict === "MIXED")
      ) {
        agreeingModelsCount++;
      }
    });
  } else {
    agreeingModelsCount = activeModels.length;
  }

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

  const handleChatSubmit = async () => {
    if (!chatInput.trim() || isChatLoading) return;
    
    const userMsg = chatInput.trim();
    setChatInput("");
    setChatMessages(prev => [...prev, { role: "user", content: userMsg }]);
    setIsChatOpen(true);
    setIsChatLoading(true);

    try {
      const allSourcesText = analyzedClaims.flatMap(c => ((c as any).snapshot as any)?.sources || []).map((s: any) => `[${s.domain}] ${s.title}: ${s.snippet}`).join("\n");
      const claimsText = analyzedClaims.map((c, i) => `Claim ${i+1}: ${c.text}\nVerdict: ${c.aggregatedVerdict}`).join("\n");

      const systemPrompt = `You are Veridica's advanced fact-checking follow-up assistant. You must answer the user's questions strictly based on the analysis context provided below.
      
Original Input:
${originalInput}

Extracted Claims & Verdicts:
${claimsText}

Evidence & Sources:
${allSourcesText}

Always cite your sources using their domain names when explaining your answers. Be extremely helpful and objective.`;

      const messages = [
        { role: "system", content: systemPrompt },
        ...chatMessages,
        { role: "user", content: userMsg }
      ];

      const apiKeyHeader = localStorage.getItem("veridica_api_key") || "";

      const response = await fetch("/api/mesh/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKeyHeader}` },
        body: JSON.stringify({
          model: chatModel,
          messages,
          temperature: 0.0
        })
      });

      if (!response.ok) throw new Error("Failed to fetch response");
      const data = await response.json();
      
      const reply = data.choices[0]?.message?.content || "No response generated.";
      setChatMessages(prev => [...prev, { role: "assistant", content: reply }]);
    } catch (e) {
      console.error(e);
      setChatMessages(prev => [...prev, { role: "assistant", content: "Sorry, I encountered an error answering your question. Please try again." }]);
    } finally {
      setIsChatLoading(false);
    }
  };

  return (
    <div id="report-container" className="flex flex-col h-screen overflow-hidden bg-background">
      {/* Top Navigation & Model Selector */}
      <header className="flex items-center justify-between border-b px-3 py-3 md:px-6 md:py-4 bg-card z-10 shrink-0">
        <div className="flex items-center gap-4">
          <Link href="/search">
            <Button variant="ghost" size="icon" className="rounded-full">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div className="font-semibold text-sm sm:text-lg flex items-center gap-1.5 whitespace-nowrap">
            <Network className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
            Analysis Engine
          </div>
        </div>

        <div className="flex items-center gap-2 md:gap-4">
          <div className="flex items-center gap-1 md:gap-2">
            <ThemeToggle />
          </div>

          <div className="flex items-center gap-2 sm:gap-3 border-l pl-2 sm:pl-4">
            <Button variant="outline" size="sm" className="px-2.5 sm:px-3" onClick={() => { sessionStorage.removeItem("veridica_input"); router.push("/search") }} title="New Analysis">
              <Plus className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">New Analysis</span>
            </Button>
            <Button size="sm" className="bg-primary hover:bg-primary/90 px-2.5 sm:px-3" onClick={handleExport} title="Export Report">
              <Download className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">Export Report</span>
            </Button>
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
              {loadingState === "retrieving" && "Executing Multiple AI searches, removing duplicates, and generating Evidence Snapshot..."}
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
                <p className="text-muted-foreground">Generated on {reportDate}</p>
              </div>

              {/* Hero Verdict */}
              <div className="border border-border/50 rounded-2xl p-4 md:p-6 bg-card shadow-sm space-y-4">
                <div className="flex items-center gap-3">
                  <span className={overallVerdictText === "TRUE" ? "text-emerald-500" : overallVerdictText === "FALSE" ? "text-red-500" : "text-amber-500"}>
                    {overallVerdictText === "TRUE" ? <CheckCircle2 className="w-10 h-10 md:w-12 md:h-12" /> : overallVerdictText === "FALSE" ? <XCircle className="w-10 h-10 md:w-12 md:h-12" /> : <AlertTriangle className="w-10 h-10 md:w-12 md:h-12" />}
                  </span>
                  <h1 className={`text-4xl md:text-5xl font-extrabold tracking-tight ${
                    overallVerdictText === "TRUE" ? "text-emerald-500" : overallVerdictText === "FALSE" ? "text-red-500" : "text-amber-500"
                  }`}>
                    {overallVerdictText}
                  </h1>
                </div>
                
                <p className="text-base font-semibold leading-relaxed text-foreground">
                  {overallVerdictText === "UNVERIFIABLE" 
                    ? analyzedClaims[0]?.modelResults?.[0]?.explanation 
                    : (misconception ? misconception : (analyzedClaims[0]?.explanation || "Analyzing claim evidence..."))}
                </p>
                
                <hr className="border-border/30" />
                
                <div className="flex flex-wrap items-center justify-between gap-4 text-xs font-semibold text-[#6B7280]">
                  <div className="flex items-center gap-4">
                    <span>Confidence <strong className="text-foreground font-bold">{Math.round(analyzedClaims.reduce((acc, c) => acc + c.aggregatedConfidence, 0) / (analyzedClaims.length || 1)) || 0}%</strong></span>
                    <span>•</span>
                    <span><strong className="text-foreground font-bold">{agreeingModelsCount}/{activeModels.length}</strong> AI Models Agree</span>
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
                      
                      {/* Multimodal Preview */}
                      {uploadedImage ? (
                        <div className="space-y-3">
                          <h3 className="text-xs font-bold text-[#6B7280] uppercase tracking-widest px-1">Attached Image</h3>
                          <div className="bg-card border border-border/30 shadow-sm p-2 rounded-2xl overflow-hidden flex justify-center bg-muted/20">
                            <img src={uploadedImage} alt="Uploaded source" className="max-h-[400px] object-contain rounded-xl" />
                          </div>
                        </div>
                      ) : (
                        <div className="border border-dashed border-border/30 rounded-2xl p-6 bg-muted/5 flex flex-col items-center justify-center gap-3 text-center">
                          <Image className="w-8 h-8 text-muted-foreground/40" />
                          <div>
                            <h4 className="text-sm font-semibold text-foreground/80">Multimodal Image Context</h4>
                            <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                              Veridica supports analyzing claims extracted from diagrams, screenshots, or receipts. Uploaded documents will preview here.
                            </p>
                          </div>
                        </div>
                      )}
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
                            let trueCount = 0; let falseCount = 0; let unvCount = 0; let totalConf = 0;
                            let explanations: string[] = [];
                            analyzedClaims.forEach(c => {
                              const res = c.modelResults.find(r => r.model === model);
                              if (res) {
                                totalConf += res.confidence;
                                explanations.push(res.explanation);
                                if (res.verdict.includes("True")) trueCount++;
                                else if (res.verdict.includes("False")) falseCount++;
                                else if (res.verdict.includes("Unverifiable")) unvCount++;
                              }
                            });
                            
                            let globalVerdict = "Mixed";
                            if (unvCount > trueCount && unvCount > falseCount) globalVerdict = "Unverifiable";
                            else if (trueCount > falseCount) globalVerdict = falseCount === 0 ? "True" : "Mostly True";
                            else if (falseCount > trueCount) globalVerdict = trueCount === 0 ? "False" : "Mostly False";
                            
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
                                      {isExpanded ? "Collapse ▲" : "Expand ▼"}
                                    </button>
                                  </td>
                                </tr>
                                {isExpanded && (
                                  <tr>
                                    <td colSpan={4} className="px-6 py-4 bg-muted/5 border-t border-b border-border/20">
                                      <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2 p-2">
                                        {explanations.map((exp, idx) => (
                                          <div key={idx} className="text-sm text-foreground/90 leading-relaxed bg-muted/40 p-4 rounded-lg border border-border/50 shadow-sm">
                                            <strong className="text-primary font-bold block mb-2 text-base">Claim {idx+1} Consensus:</strong>
                                            <p className="whitespace-pre-wrap">{exp}</p>
                                          </div>
                                        ))}
                                        {explanations.length === 0 && <div className="text-sm text-muted-foreground">No explanations loaded.</div>}
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

            {/* Mobile-only Sources Section */}
            {allSources.length > 0 && (
              <div className="md:hidden mt-8 space-y-4 w-full max-w-4xl mx-auto px-4">
                <h3 className="text-xl font-bold font-serif tracking-tight flex items-center gap-2">
                  <Search className="w-5 h-5 text-primary" />
                  Cited Sources
                </h3>
                <div className="space-y-3">
                  {allSources.map((source: any, idx: number) => (
                    <a 
                      key={idx} 
                      href={source.url} 
                      target="_blank" 
                      rel="noreferrer"
                      className="block p-3 rounded-xl border border-border/50 bg-card shadow-sm hover:bg-muted/20 transition-colors"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <img 
                          src={`https://www.google.com/s2/favicons?domain=${source.domain}&sz=64`} 
                          alt="" 
                          className="w-4 h-4 rounded-sm"
                          onError={(e) => { e.currentTarget.style.display = 'none' }}
                        />
                        <span className="text-xs font-semibold text-primary truncate">
                          {source.domain}
                        </span>
                      </div>
                      <h4 className="text-sm font-semibold text-foreground line-clamp-2 leading-snug mb-1.5">
                        {source.title}
                      </h4>
                      <p className="text-xs text-muted-foreground line-clamp-3 leading-relaxed">
                        "{source.snippet}"
                      </p>
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* Spacer block to guarantee scroll clearance for absolute chat input */}
            <div className="h-32 w-full shrink-0"></div>
          </div>

          {/* Ask Follow-up Input anchored at bottom */}
          <div className="absolute bottom-0 left-0 right-0 p-4 bg-background/80 backdrop-blur-md border-t shadow-[0_-10px_40px_-10px_rgba(0,0,0,0.1)] flex flex-col items-center">
            
            {/* Chat History Window */}
            {isChatOpen && (
              <div className="max-w-4xl w-full max-h-[50vh] overflow-y-auto mb-4 bg-card border border-border/50 rounded-xl p-4 flex flex-col gap-4 shadow-sm relative">
                <Button variant="ghost" size="icon" className="absolute top-2 right-2 h-6 w-6 rounded-full" onClick={() => setIsChatOpen(false)}>
                  <XCircle className="w-4 h-4 text-muted-foreground" />
                </Button>
                {chatMessages.length === 0 && <div className="text-center text-sm text-muted-foreground pt-4">Start a conversation...</div>}
                {chatMessages.map((msg, idx) => (
                  <div key={idx} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[85%] p-3 rounded-lg text-sm ${msg.role === "user" ? "bg-primary text-primary-foreground rounded-br-sm" : "bg-muted border border-border/30 text-foreground rounded-bl-sm"}`}>
                      {msg.content}
                    </div>
                  </div>
                ))}
                {isChatLoading && (
                  <div className="flex justify-start">
                    <div className="max-w-[85%] p-4 rounded-lg text-sm bg-muted border border-border/30 text-foreground rounded-bl-sm flex gap-1.5 items-center">
                      <div className="w-1.5 h-1.5 rounded-full bg-foreground/40 animate-pulse"></div>
                      <div className="w-1.5 h-1.5 rounded-full bg-foreground/40 animate-pulse" style={{ animationDelay: "150ms" }}></div>
                      <div className="w-1.5 h-1.5 rounded-full bg-foreground/40 animate-pulse" style={{ animationDelay: "300ms" }}></div>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="max-w-4xl w-full flex gap-2">
              <select 
                className="bg-card border border-input rounded-md px-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50 text-foreground font-semibold cursor-pointer"
                value={chatModel}
                onChange={(e) => setChatModel(e.target.value)}
              >
                {activeModels.map(m => <option key={m} value={m}>{getDisplayName(m)}</option>)}
              </select>
              <Input 
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleChatSubmit(); }}
                disabled={isChatLoading}
                placeholder="Ask a follow-up question about these claims..." 
                className="flex-1 bg-card shadow-sm" 
              />
              <Button 
                size="icon" 
                onClick={handleChatSubmit} 
                disabled={isChatLoading || !chatInput.trim()}
                className="shrink-0 bg-primary hover:bg-primary/90 shadow-sm"
              >
                <Send className="w-4 h-4" />
              </Button>
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
                  let trueCount = 0; let falseCount = 0; let unvCount = 0;
                  analyzedClaims.forEach(c => {
                    const res = c.modelResults.find(r => r.model === model);
                    if (res?.verdict.includes("True")) trueCount++;
                    else if (res?.verdict.includes("False")) falseCount++;
                    else if (res?.verdict.includes("Unverifiable")) unvCount++;
                  })
                  
                  let globalVerdict = "Mixed";
                  if (unvCount > trueCount && unvCount > falseCount) globalVerdict = "Unverifiable";
                  else if (trueCount > falseCount) globalVerdict = falseCount === 0 ? "True" : "Mostly True";
                  else if (falseCount > trueCount) globalVerdict = trueCount === 0 ? "False" : "Mostly False";
                  
                  const mStyle = getVerdictStyle(globalVerdict);
                  
                  return (
                    <div key={model} className="flex flex-col p-3 bg-background border rounded-lg shadow-sm">
                      <div className="flex justify-between items-center text-sm mb-1">
                        <span className="font-medium text-foreground">{getDisplayName(model)}</span>
                        <Badge variant="outline" className={`${mStyle.color} ${mStyle.border}`}>
                          {globalVerdict}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                         <span className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3 text-green-500"/> {trueCount} True</span>
                         <span className="flex items-center gap-1"><AlertTriangle className="w-3 h-3 text-yellow-500"/> {falseCount} False</span>
                         <span className="flex items-center gap-1"><XCircle className="w-3 h-3 text-gray-500"/> {unvCount} Unv</span>
                      </div>
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
        @media print {
          body, html, #report-container {
            background: white !important;
            color: black !important;
            height: auto !important;
            overflow: visible !important;
          }
          * {
            overflow: visible !important;
          }
          header, button, .hidden.lg\\:flex {
            display: none !important;
          }
          .print-header {
            display: block !important;
          }
          .bg-card {
            background: white !important;
            border-color: #e5e7eb !important;
          }
          mark {
            color: black !important;
          }
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
