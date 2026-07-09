"use client"

import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { ShieldCheck, Link as LinkIcon, FileText, Mic, ArrowRight, Sparkles } from "lucide-react"
import Link from "next/link"
import { AboutModal } from "@/components/AboutModal"
import { useRouter } from "next/navigation"
import { useState, useEffect } from "react"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"
import { ThemeToggle } from "@/components/ThemeToggle"
import { Switch } from "@/components/ui/switch"

export default function Home() {
  const router = useRouter()
  const [claimText, setClaimText] = useState("")
  const [urlInput, setUrlInput] = useState("")
  const [fileParsing, setFileParsing] = useState(false)
  
  const MODELS = ["anthropic/claude-3-haiku", "openai/gpt-4o-mini", "google/gemini-3.1-flash-lite"]
  const MODEL_DISPLAY_NAMES: Record<string, string> = {
    "anthropic/claude-3-haiku": "Claude 3 Haiku",
    "openai/gpt-4o-mini": "GPT-4o Mini",
    "google/gemini-3.1-flash-lite": "Gemini 3.1 Flash Lite"
  }
  
  const [smartRouting, setSmartRouting] = useState(true)
  const [selectedModels, setSelectedModels] = useState<string[]>([MODELS[0]])

  useEffect(() => {
    const saved = localStorage.getItem("veridica_settings")
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        if (parsed.smartRouting !== undefined) setSmartRouting(parsed.smartRouting)
        if (parsed.defaultModel) setSelectedModels([parsed.defaultModel])
      } catch (e) {}
    }
  }, [])

  const handleAnalyze = (type: "text" | "url" | "file", content: string) => {
    if (!content.trim()) return;

    // Save to session storage
    sessionStorage.setItem("veridica_input", JSON.stringify({ 
      type, 
      content,
      smartRouting,
      selectedModels
    }))
    
    toast.success("Claim loaded. Route established to Mesh API.");
    // Navigate to analyze page
    router.push("/analyze")
  }

  const loadDemo = () => {
    const demoClaim = "India’s Chandrayaan-3 mission cost approximately $75 million, which is significantly cheaper than the budget of the Hollywood movie Interstellar. However, critics claim it generated massive amounts of space debris in lunar orbit.";
    setClaimText(demoClaim);
    toast.info("Demo claim loaded.");
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setFileParsing(true)
      // Mock parsing a file
      setTimeout(() => {
        setFileParsing(false)
        handleAnalyze("file", `[Parsed from ${file.name}]: Coffee stunts your growth and causes spikes in blood pressure.`)
      }, 1500)
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 relative">
      {/* Top Navbar */}
      <div className="absolute top-0 left-0 w-full p-6 flex justify-end items-center gap-2 md:gap-4">
        <ThemeToggle />
        <AboutModal />
        <Link href="https://github.com/chetangupta06/Veridica-The-AI-Evidence-Engine" target="_blank" rel="noreferrer">
          <Button variant="ghost" size="icon">
            <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current text-muted-foreground hover:text-foreground"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
          </Button>
        </Link>
      </div>

      {/* Hero Section */}
      <div className="w-full max-w-4xl text-center mb-12 mt-12">
        <div className="flex justify-center mb-6">
          <div className="inline-flex items-center justify-center p-3 bg-primary/10 rounded-full">
            <ShieldCheck className="h-10 w-10 text-primary" />
          </div>
        </div>
        <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-4">
          Veridica
        </h1>
        <p className="text-xl md:text-2xl text-muted-foreground font-medium">
          Paste any claim. Get evidence, not opinions.
        </p>
      </div>

      {/* Input Area */}
      <div className="w-full max-w-3xl bg-card rounded-xl border shadow-lg p-2 md:p-4">
        <Tabs defaultValue="text" className="w-full">
          <TabsList className="grid w-full grid-cols-4 mb-4 bg-muted/50">
            <TabsTrigger value="text" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              <span className="hidden sm:inline">Text</span>
            </TabsTrigger>
            <TabsTrigger value="url" className="flex items-center gap-2">
              <LinkIcon className="h-4 w-4" />
              <span className="hidden sm:inline">URL</span>
            </TabsTrigger>
            <TabsTrigger value="upload" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              <span className="hidden sm:inline">Upload</span>
            </TabsTrigger>
            <TabsTrigger value="voice" className="flex items-center gap-2">
              <Mic className="h-4 w-4" />
              <span className="hidden sm:inline">Voice</span>
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="text" className="mt-0 flex flex-col h-auto">
            <Textarea
              placeholder="E.g., 'Coffee stunts your growth' or 'Electric cars produce more emissions over their lifetime than gas cars...'"
              className="flex-1 min-h-[120px] text-lg resize-none border-0 focus-visible:ring-0 focus-visible:ring-offset-0 bg-transparent p-4"
              value={claimText}
              onChange={(e) => setClaimText(e.target.value)}
            />
            <div className="flex items-center justify-between border-t p-4 mt-2">
              <div className="text-sm text-muted-foreground">
                {claimText.length} characters
              </div>
              <Button 
                onClick={() => handleAnalyze("text", claimText)}
                disabled={!claimText.trim()}
                size="lg" 
                className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-8 h-12 rounded-full"
              >
                Analyze Claim
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </div>

            {/* Smart Routing & Model Selection */}
            <div className="border-t border-border/30 pt-4 pb-2 px-4 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-muted/5 rounded-b-xl">
              <div className="flex items-center gap-3">
                <Switch 
                  id="smart-routing-text" 
                  checked={smartRouting} 
                  onCheckedChange={(checked) => setSmartRouting(checked)} 
                />
                <label htmlFor="smart-routing-text" className="text-xs font-bold text-foreground/85 cursor-pointer uppercase tracking-wider select-none">
                  Smart Routing
                </label>
                <span className="text-[10px] text-muted-foreground/80 font-semibold">
                  {smartRouting ? "(Consensus Agreement Mode)" : "(Single model verification)"}
                </span>
              </div>

              {!smartRouting && (
                <div className="flex flex-wrap items-center gap-2 animate-in fade-in slide-in-from-right-1 duration-200">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mr-1">Select Model:</span>
                  {MODELS.map((m) => {
                    const active = selectedModels.includes(m);
                    return (
                      <button
                        key={m}
                        onClick={() => setSelectedModels([m])}
                        className={`text-[10px] px-3 py-1.5 rounded-full border font-extrabold tracking-wide transition-all uppercase ${
                          active
                            ? "bg-primary/10 border-primary text-primary shadow-sm"
                            : "bg-muted/10 border-border/50 text-muted-foreground hover:text-foreground hover:bg-muted/20"
                        }`}
                      >
                        {MODEL_DISPLAY_NAMES[m]}
                      </button>
                    );
                  })}
                </div>
              )}
              
              {smartRouting && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground/85 font-semibold animate-in fade-in slide-in-from-left-1 duration-200">
                  <Sparkles className="w-3.5 h-3.5 text-primary shrink-0" />
                  <span>Consensus on GPT, Claude & Gemini</span>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="url" className="mt-0 flex flex-col h-auto">
            <div className="flex-1 p-4 flex items-center justify-center min-h-[100px]">
              <Input 
                type="url" 
                placeholder="https://example.com/article" 
                className="text-lg py-6"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
              />
            </div>
            <div className="flex items-center justify-end border-t p-4 mt-2">
              <Button 
                onClick={() => handleAnalyze("url", urlInput)}
                disabled={!urlInput.trim()}
                size="lg" 
                className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-8 h-12 rounded-full"
              >
                Analyze URL
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </div>

            {/* Smart Routing & Model Selection */}
            <div className="border-t border-border/30 pt-4 pb-2 px-4 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-muted/5 rounded-b-xl">
              <div className="flex items-center gap-3">
                <Switch 
                  id="smart-routing-url" 
                  checked={smartRouting} 
                  onCheckedChange={(checked) => setSmartRouting(checked)} 
                />
                <label htmlFor="smart-routing-url" className="text-xs font-bold text-foreground/85 cursor-pointer uppercase tracking-wider select-none">
                  Smart Routing
                </label>
                <span className="text-[10px] text-muted-foreground/80 font-semibold">
                  {smartRouting ? "(Consensus Agreement Mode)" : "(Single model verification)"}
                </span>
              </div>

              {!smartRouting && (
                <div className="flex flex-wrap items-center gap-2 animate-in fade-in slide-in-from-right-1 duration-200">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mr-1">Select Model:</span>
                  {MODELS.map((m) => {
                    const active = selectedModels.includes(m);
                    return (
                      <button
                        key={m}
                        onClick={() => setSelectedModels([m])}
                        className={`text-[10px] px-3 py-1.5 rounded-full border font-extrabold tracking-wide transition-all uppercase ${
                          active
                            ? "bg-primary/10 border-primary text-primary shadow-sm"
                            : "bg-muted/10 border-border/50 text-muted-foreground hover:text-foreground hover:bg-muted/20"
                        }`}
                      >
                        {MODEL_DISPLAY_NAMES[m]}
                      </button>
                    );
                  })}
                </div>
              )}
              
              {smartRouting && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground/85 font-semibold animate-in fade-in slide-in-from-left-1 duration-200">
                  <Sparkles className="w-3.5 h-3.5 text-primary shrink-0" />
                  <span>Consensus on GPT, Claude & Gemini</span>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="upload" className="mt-0 flex flex-col h-[200px]">
            <div className="flex-1 p-4 flex items-center justify-center">
              <div className="relative flex flex-col items-center justify-center w-full h-full border-2 border-dashed rounded-lg border-muted hover:border-primary/50 transition-colors bg-muted/20">
                <input 
                  type="file" 
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  onChange={handleFileUpload}
                  disabled={fileParsing}
                  accept=".pdf,.png,.jpg,.jpeg,.txt"
                />
                <FileText className="w-8 h-8 text-muted-foreground mb-2" />
                <p className="text-muted-foreground font-medium">
                  {fileParsing ? "Extracting text via OCR..." : "Click or drag and drop a document here"}
                </p>
                <p className="text-xs text-muted-foreground mt-1">Supports PDF, TXT, Images</p>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="voice" className="mt-0 flex flex-col h-[200px]">
            <div className="flex-1 p-4 flex flex-col items-center justify-center gap-4">
              <Button variant="outline" size="icon" className="h-16 w-16 rounded-full border-primary/50 text-primary hover:bg-primary/10 hover:text-primary">
                <Mic className="h-8 w-8" />
              </Button>
              <p className="text-muted-foreground">Click to start speaking (Coming Soon)</p>
            </div>
          </TabsContent>
        </Tabs>
      </div>
      
      <div className="mt-8 flex items-center justify-center gap-4 animate-in slide-in-from-bottom-4 fade-in duration-700">
        <Button variant="outline" onClick={loadDemo} className="border-primary/50 text-primary hover:bg-primary/10">
          <Sparkles className="w-4 h-4 mr-2" />
          Load Demo Example
        </Button>
      </div>

      <div className="mt-16 text-center">
        <Button variant="link" onClick={() => router.push("/settings")} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
          Configure API & Models
        </Button>
      </div>
    </div>
  )
}
