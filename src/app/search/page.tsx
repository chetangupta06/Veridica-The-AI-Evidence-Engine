"use client"

import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { ShieldCheck, Link as LinkIcon, FileText, Mic, ArrowRight, Sparkles, ChevronDown, Check, Plus, X, Trash2, History, PanelLeftClose, PanelLeftOpen, Loader2, Settings } from "lucide-react"
import Link from "next/link"
import { AboutModal } from "@/components/AboutModal"
import { useRouter } from "next/navigation"
import { useState, useEffect, useRef } from "react"
import { toast } from "sonner"
import { ThemeToggle } from "@/components/ThemeToggle"
import { Switch } from "@/components/ui/switch"
import { ModelSelector } from "@/components/ModelSelector"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { useMeshModels } from "@/lib/useMeshModels"
import { determineOptimalModels } from "@/lib/smartRouter"

type HistoryItem = {
  id: string;
  type: "text" | "url" | "file";
  content: string;
  date: number;
}

export default function Home() {
  const router = useRouter()
  const [claimText, setClaimText] = useState("")
  const [isRecording, setIsRecording] = useState(false)
  const recognitionRef = useRef<any>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [urlInput, setUrlInput] = useState("")
  const [fileParsing, setFileParsing] = useState(false)
  
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [isHistoryDialogOpen, setIsHistoryDialogOpen] = useState(false)
  const [uploadedImage, setUploadedImage] = useState<string | null>(null)
  
  const DEFAULT_MODELS = ["anthropic/claude-3-haiku", "openai/gpt-4o-mini", "google/gemini-3.1-flash-lite"]
  const DEFAULT_DISPLAY_NAMES: Record<string, string> = {
    "anthropic/claude-3-haiku": "Claude 3 Haiku",
    "openai/gpt-4o-mini": "GPT-4o Mini",
    "google/gemini-3.1-flash-lite": "Gemini 3.1 Flash Lite"
  }
  
  const getDisplayName = (modelId: string) => {
    if (DEFAULT_DISPLAY_NAMES[modelId]) return DEFAULT_DISPLAY_NAMES[modelId];
    return modelId.split('/').pop() || modelId;
  }
  
  const [smartRouting, setSmartRouting] = useState(true)
  const [selectedModels, setSelectedModels] = useState<string[]>([DEFAULT_MODELS[0]])

  const [apiKey, setApiKey] = useState("")
  useEffect(() => {
    const savedApiKey = localStorage.getItem("veridica_api_key")
    if (savedApiKey) setApiKey(savedApiKey)
  }, [])

  const { models: availableModels } = useMeshModels(apiKey)

  useEffect(() => {
    if (typeof window !== "undefined") {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recog = new SpeechRecognition();
        recog.continuous = false;
        recog.interimResults = false;
        recognitionRef.current = recog;
      }
    }

    const savedSettings = localStorage.getItem("veridica_settings")
    if (savedSettings) {
      try {
        const parsed = JSON.parse(savedSettings)
        if (parsed.smartRouting !== undefined) setSmartRouting(parsed.smartRouting)
        if (parsed.selectedModels && Array.isArray(parsed.selectedModels)) {
          setSelectedModels(parsed.selectedModels)
        }
      } catch (e) {}
    }

    const savedHistory = localStorage.getItem("veridica_history")
    if (savedHistory) {
      try {
        setHistory(JSON.parse(savedHistory))
      } catch (e) {}
    }
  }, []);

  const toggleRecording = () => {
    if (!recognitionRef.current) {
      toast.error("Speech recognition not supported in this browser.");
      return;
    }
    
    if (isRecording) {
      recognitionRef.current.stop();
      setIsRecording(false);
    } else {
      const recog = recognitionRef.current;
      const initialText = claimText ? claimText + " " : "";
      
      recog.onresult = (event: any) => {
        let transcript = '';
        for (let i = 0; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }
        setClaimText(initialText + transcript);
      };

      recog.onerror = (event: any) => {
        setIsRecording(false);
        if (event.error !== 'no-speech') {
          let errorMsg = event.error;
          if (event.error === 'network') {
            errorMsg = "Network error. This often happens in browsers (like Brave) that block speech recognition, or when offline.";
          } else if (event.error === 'not-allowed') {
            errorMsg = "Microphone access denied. Please allow microphone permissions in your browser.";
          }
          toast.error("Microphone error", { description: errorMsg });
        }
      };
      
      recog.onend = () => {
        setIsRecording(false);
      };

      recog.start();
      setIsRecording(true);
    }
  }

  useEffect(() => {
    const saved = localStorage.getItem("veridica_settings")
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        if (parsed.smartRouting !== undefined) setSmartRouting(parsed.smartRouting)
        if (parsed.selectedModels && Array.isArray(parsed.selectedModels)) {
          setSelectedModels(parsed.selectedModels)
        }
      } catch (e) {}
    }

    const savedHistory = localStorage.getItem("veridica_history")
    if (savedHistory) {
      try {
        setHistory(JSON.parse(savedHistory))
      } catch (e) {}
    }
  }, [])

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      toast.error("Only images are supported")
      return
    }

    const reader = new FileReader()
    reader.onload = (event) => {
      if (typeof event.target?.result === 'string') {
        setUploadedImage(event.target.result)
      }
    }
    reader.readAsDataURL(file)
  }
  
  const handleAnalyze = (type: "text" | "url" | "file", content: string, skipHistory = false) => {
    if (!content.trim() && !uploadedImage) return;

    if (!skipHistory) {
      const newItem: HistoryItem = {
        id: Date.now().toString(),
        type,
        content,
        date: Date.now()
      }
      const updatedHistory = [newItem, ...history].slice(0, 50)
      setHistory(updatedHistory)
      localStorage.setItem("veridica_history", JSON.stringify(updatedHistory))
    }

    let finalModels = selectedModels;
    if (smartRouting) {
      const hasImage = !!uploadedImage || type === "file";
      const availableModelsList = availableModels.map(m => typeof m === 'string' ? m : (m as any).id || "");
      finalModels = determineOptimalModels(content, hasImage, availableModelsList);
    }

    sessionStorage.setItem("veridica_input", JSON.stringify({ 
      type: uploadedImage ? "file" : type, 
      content,
      image: uploadedImage,
      smartRouting,
      selectedModels: finalModels
    }))
    
    toast.success("Claim loaded. Route established to Mesh API.");
    router.push("/analyze")
  }

  const loadDemo = () => {
    const demoClaim = "India’s Chandrayaan-3 mission cost approximately $75 million, which is significantly cheaper than the budget of the Hollywood movie Interstellar. However, critics claim it generated massive amounts of space debris in lunar orbit.";
    setClaimText(demoClaim);
    toast.info("Demo claim loaded.");
  }

  return (
    <div className="flex min-h-screen bg-background w-full">


      {/* Main Content Area */}
      <div className="flex-1 flex flex-col bg-background relative">
        {/* Top Navbar */}
        <div className="w-full p-4 border-b flex justify-between items-center gap-2 md:gap-4 shrink-0 h-[73px] sticky top-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="flex items-center">
            <Link href="/" className="text-xl font-bold font-serif tracking-tight ml-2 md:ml-4 flex items-center gap-2">
              <div className="relative w-8 h-8 flex items-center justify-center">
                <img src="/logo.png" alt="Veridica Logo" className="object-contain w-full h-full drop-shadow-sm scale-125" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
              </div>
              Veridica
            </Link>
          </div>
          <div className="flex items-center gap-2 md:gap-4">
            <Button variant="ghost" onClick={() => router.push("/settings")} className="hidden md:flex text-sm text-muted-foreground hover:text-foreground transition-colors md:mr-2">
              Configure API & Models
            </Button>
            <Button variant="ghost" size="icon" onClick={() => router.push("/settings")} className="md:hidden text-muted-foreground hover:text-foreground transition-colors">
              <Settings className="w-5 h-5" />
            </Button>
            <ThemeToggle />
            <AboutModal />
            <Link href="https://github.com/chetangupta06/Veridica-The-AI-Evidence-Engine" target="_blank" rel="noreferrer">
              <Button variant="ghost" size="icon">
                <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current text-muted-foreground hover:text-foreground"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
              </Button>
            </Link>
          </div>
        </div>

        {/* Centered Content */}
        <div className="flex-1 flex flex-col items-center justify-center px-4 pb-12 w-full">

      {/* Hero Section */}
      <div className="w-full max-w-4xl text-center mb-12 mt-12">
        <div className="flex justify-center -mb-2 md:-mb-4">
          <div className="relative w-24 h-24 md:w-32 md:h-32">
            <div className="w-full h-full flex items-center justify-center p-2">
              <img src="/logo.png" alt="Veridica Logo" className="w-full h-full object-contain drop-shadow-2xl scale-110" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
            </div>
            <div className="absolute inset-0 -z-10 bg-primary/20 blur-3xl rounded-full"></div>
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
      <div className="w-full max-w-3xl bg-card rounded-xl border shadow-lg flex flex-col p-2 md:p-4">
        <div className="relative w-full">
          <Textarea
            placeholder="E.g., 'Coffee stunts your growth' or 'Electric cars produce more emissions over their lifetime than gas cars...'"
            className="flex-1 min-h-[120px] text-lg resize-none border-0 focus-visible:ring-0 focus-visible:ring-offset-0 bg-transparent p-4 pr-12 pb-12 w-full"
            value={claimText}
            onChange={(e) => setClaimText(e.target.value)}
          />
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={toggleRecording}
            className={`absolute top-2 right-2 rounded-full h-9 w-9 transition-colors ${isRecording ? 'text-red-500 bg-red-500/10 hover:bg-red-500/20' : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'}`}
            title="Voice Input"
          >
            <Mic className={`h-5 w-5 ${isRecording ? 'animate-pulse' : ''}`} />
          </Button>
        </div>
        <div className="flex items-center justify-between border-t border-border/50 p-3 mt-2">
          <div className="flex items-center gap-2">
            <input 
              type="file" 
              accept="image/*"
              className="hidden" 
              ref={fileInputRef} 
              onChange={handleImageUpload} 
            />
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-foreground rounded-full"
              onClick={() => fileInputRef.current?.click()}
            >
              <Plus className="h-4 w-4" />
            </Button>
            {uploadedImage && (
              <div className="relative w-8 h-8 rounded overflow-hidden border">
                <img src={uploadedImage} alt="Uploaded" className="w-full h-full object-cover" />
                <button 
                  onClick={() => setUploadedImage(null)}
                  className="absolute -top-1 -right-1 bg-background rounded-full border shadow-sm w-4 h-4 flex items-center justify-center text-muted-foreground hover:text-foreground"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}
            <div className="text-xs text-muted-foreground font-medium hidden sm:block ml-2">
              {claimText.length} characters
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 mr-1.5 sm:mr-2">
                <Switch 
                  id="smart-routing-inline" 
                  checked={smartRouting} 
                  onCheckedChange={(checked) => {
                    setSmartRouting(checked)
                    localStorage.setItem("veridica_settings", JSON.stringify({ smartRouting: checked, selectedModels }))
                  }} 
                  className="scale-75 data-[state=checked]:bg-primary"
                />
                <label htmlFor="smart-routing-inline" className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider cursor-pointer select-none">
                  Smart Routing
                </label>
              </div>

              {!smartRouting && (
                <ModelSelector 
                  selectedModels={selectedModels}
                  onSelectedModelsChange={(models) => {
                    const toSet = models.length > 0 ? models : [DEFAULT_MODELS[0]];
                    setSelectedModels(toSet);
                    localStorage.setItem("veridica_settings", JSON.stringify({ smartRouting, selectedModels: toSet }));
                  }}
                  triggerClassName="text-xs font-semibold text-foreground/80 hover:text-foreground flex items-center gap-1 transition-colors bg-muted/30 px-3 py-1.5 rounded-full hover:bg-muted/50 border border-transparent hover:border-border"
                  triggerContent={
                    <>
                      {selectedModels.length === 1 ? getDisplayName(selectedModels[0]) : `${selectedModels.length} Models`}
                      <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                    </>
                  }
                />
              )}
            </div>

            <Button 
              onClick={() => handleAnalyze("text", claimText)}
              disabled={!claimText.trim()}
              size="sm" 
              className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold px-5 h-9 rounded-full text-xs transition-transform hover:scale-105"
            >
              Analyze
              <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>
      
      <div className="mt-8 flex items-center justify-center gap-4 animate-in slide-in-from-bottom-4 fade-in duration-700">
        <Button variant="outline" onClick={loadDemo} className="border-primary/50 text-primary hover:bg-primary/10">
          <Sparkles className="w-4 h-4 mr-2" />
          Load Demo Example
        </Button>
      </div>

      {/* Session History FAB & Dialog */}
      <Dialog open={isHistoryDialogOpen} onOpenChange={setIsHistoryDialogOpen}>
        <DialogTrigger className="fixed bottom-6 right-6 md:bottom-8 md:right-8 z-50 h-14 px-6 rounded-full shadow-lg border border-primary/30 bg-background/95 backdrop-blur hover:bg-muted/50 transition-all group flex items-center justify-center cursor-pointer text-sm">
          <History className="w-5 h-5 mr-2 text-primary group-hover:scale-110 transition-transform" />
          <span className="font-semibold text-foreground/90">Session History</span>
        </DialogTrigger>
        <DialogContent className="max-w-md max-h-[85vh] flex flex-col p-0 gap-0 border-primary/20">
          <DialogHeader className="p-4 border-b">
            <DialogTitle className="flex items-center gap-2">
              <History className="w-4 h-4 text-primary" />
              Session History
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {history.length === 0 ? (
              <div className="text-sm text-muted-foreground text-center mt-10">No history yet</div>
            ) : (
              history.map(item => (
                <div 
                  key={item.id} 
                  onClick={() => {
                    setIsHistoryDialogOpen(false);
                    if (item.type === 'text') setClaimText(item.content);
                    else if (item.type === 'url') setUrlInput(item.content);
                    handleAnalyze(item.type, item.content, true);
                  }}
                  className="p-3 rounded-lg border bg-background hover:border-primary/50 cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-2 mb-2">
                    {item.type === 'text' && <FileText className="w-3.5 h-3.5 text-primary" />}
                    {item.type === 'url' && <LinkIcon className="w-3.5 h-3.5 text-primary" />}
                    {item.type === 'file' && <FileText className="w-3.5 h-3.5 text-primary" />}
                    <span className="text-xs font-medium text-muted-foreground capitalize">{item.type}</span>
                    <span className="text-[10px] text-muted-foreground/60 ml-auto">{new Date(item.date).toLocaleDateString()}</span>
                  </div>
                  <p className="text-sm text-foreground/90 font-medium line-clamp-3 leading-snug">
                    {item.content}
                  </p>
                </div>
              ))
            )}
          </div>
          {history.length > 0 && (
            <div className="p-4 border-t bg-muted/10">
              <Button 
                variant="outline" 
                size="sm" 
                className="w-full text-muted-foreground hover:text-destructive hover:border-destructive/50 transition-colors"
                onClick={() => {
                  setHistory([]);
                  localStorage.removeItem("veridica_history");
                }}
              >
                Clear History
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  </div>
</div>
  )
}
