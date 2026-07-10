"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { ArrowLeft, Save, Activity, Settings2, Cpu, Palette, Key, ChevronDown, Check } from "lucide-react"
import Link from "next/link"
import { useTheme } from "next-themes"
import { ThemeToggle } from "@/components/ThemeToggle"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import { ModelSelector } from "@/components/ModelSelector"

export default function SettingsPage() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  
  const [apiKey, setApiKey] = useState("")
  const [serperApiKey, setSerperApiKey] = useState("")
  const [smartRouting, setSmartRouting] = useState(true)
  const [smartExtractorRouting, setSmartExtractorRouting] = useState(true)
  const [enableSourceExtractor, setEnableSourceExtractor] = useState(true)
  const [reasoningDepth, setReasoningDepth] = useState("deep")
  const [sourceExtractorModels, setSourceExtractorModels] = useState<string[]>(["openai/gpt-4o-mini"])
  const [apiUsage, setApiUsage] = useState({ requests: 0, tokens: 0, cost: 0 })
  
  const DEFAULT_MODELS = ["anthropic/claude-3-haiku", "openai/gpt-4o-mini", "google/gemini-3.1-flash-lite", "x-ai/grok-4.3"]
  const DEFAULT_DISPLAY_NAMES: Record<string, string> = {
    "anthropic/claude-3-haiku": "Claude 3 Haiku",
    "openai/gpt-4o-mini": "GPT-4o Mini",
    "google/gemini-3.1-flash-lite": "Gemini 3.1 Flash Lite",
    "x-ai/grok-4.3": "Grok"
  }
  const DEPTH_LABELS: Record<string, string> = {
    "fast": "Fast (Lower latency, surface level)",
    "balanced": "Balanced",
    "deep": "Deep (Multi-step verification)"
  }

  // Avoid hydration mismatch
  useEffect(() => {
    setMounted(true)
    const saved = localStorage.getItem("veridica_settings")
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        if (parsed.smartRouting !== undefined) setSmartRouting(parsed.smartRouting)
        if (parsed.smartExtractorRouting !== undefined) setSmartExtractorRouting(parsed.smartExtractorRouting)
        if (parsed.reasoningDepth) setReasoningDepth(parsed.reasoningDepth)
        if (parsed.enableSourceExtractor !== undefined) setEnableSourceExtractor(parsed.enableSourceExtractor)
        if (parsed.sourceExtractorModels) {
          setSourceExtractorModels(parsed.sourceExtractorModels)
        } else if (parsed.sourceExtractorModel) {
          setSourceExtractorModels([parsed.sourceExtractorModel]) // migrate old single string
        }
      } catch(e) {
        console.error(e)
      }
    }
    const savedKey = localStorage.getItem("veridica_api_key")
    if (savedKey) {
      setApiKey(savedKey)
    }

    const savedSerperKey = localStorage.getItem("veridica_serper_api_key")
    if (savedSerperKey) {
      setSerperApiKey(savedSerperKey)
    }
    
    const savedUsage = localStorage.getItem("veridica_api_usage")
    if (savedUsage) {
      try { setApiUsage(JSON.parse(savedUsage)) } catch (e) {}
    }
  }, [])

  const handleSave = () => {
    localStorage.setItem("veridica_settings", JSON.stringify({
      smartRouting,
      smartExtractorRouting,
      reasoningDepth,
      enableSourceExtractor,
      sourceExtractorModels
    }))
    if (apiKey) {
      localStorage.setItem("veridica_api_key", apiKey)
    } else {
      localStorage.removeItem("veridica_api_key")
    }

    if (serperApiKey) {
      localStorage.setItem("veridica_serper_api_key", serperApiKey)
    } else {
      localStorage.removeItem("veridica_serper_api_key")
    }

    toast.success("Settings saved successfully!")
  }

  if (!mounted) return null

  return (
    <div className="min-h-screen bg-background pb-12">
      <header className="border-b bg-card sticky top-0 z-10 animate-in fade-in slide-in-from-top-2 duration-500">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/">
              <Button variant="ghost" size="icon" className="rounded-full">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <h1 className="font-semibold text-xl">Settings</h1>
          </div>
          <div className="flex items-center gap-2 md:gap-4">
            <ThemeToggle />
            <Button onClick={handleSave} className="gap-2 bg-primary hover:bg-primary/90 transition-transform active:scale-95">
              <Save className="w-4 h-4" />
              Save Changes
            </Button>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-6 mt-8 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-100 fill-mode-both">
        
        {/* API Configuration */}
        <Card className="border-primary/20 shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-primary">
              <Key className="h-5 w-5" />
              API Configuration
            </CardTitle>
            <CardDescription>Configure your Mesh API key to run real analysis without fallbacks.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Mesh API Key</label>
              <Input 
                type="password" 
                placeholder="sk-mesh-..." 
                value={apiKey} 
                onChange={(e) => setApiKey(e.target.value)} 
                className="font-mono"
              />
              <p className="text-xs text-muted-foreground">Your API key is stored securely in your browser's local storage and is never sent to our servers.</p>
            </div>
            <div className="space-y-2 mt-4">
              <label className="text-sm font-medium">Serper API Key (Optional)</label>
              <Input 
                type="password" 
                placeholder="Required for Real Web Search (serper.dev)..." 
                value={serperApiKey} 
                onChange={(e) => setSerperApiKey(e.target.value)} 
                className="font-mono"
              />
              <p className="text-xs text-muted-foreground">Provide a Serper.dev API key to enable live Google Search results alongside Wikipedia.</p>
            </div>
          </CardContent>
        </Card>

        {/* AI Models Section */}
        <Card className="border-primary/10 shadow-sm hover:shadow-md transition-shadow">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Cpu className="h-5 w-5 text-primary" />
              AI Models & Reasoning
            </CardTitle>
            <CardDescription>Configure which AI models to use for evidence extraction and analysis.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">Reasoning Depth</label>
                <Select value={reasoningDepth} onValueChange={(val) => { if(val) setReasoningDepth(val) }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select depth">
                      {DEPTH_LABELS[reasoningDepth] || reasoningDepth}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fast">Fast (Lower latency, surface level)</SelectItem>
                    <SelectItem value="balanced">Balanced</SelectItem>
                    <SelectItem value="deep">Deep (Multi-step verification)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">Deep reasoning takes longer but provides better accuracy.</p>
              </div>
            </div>

            <div className="space-y-2 pt-2">
              <div className="flex items-center justify-between md:w-1/2">
                <label className="text-sm font-medium flex items-center gap-2">
                  Source Extractor AI
                </label>
                <Switch checked={enableSourceExtractor} onCheckedChange={setEnableSourceExtractor} />
              </div>
              
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <label className="text-sm font-medium">Smart Extractor Routing</label>
                  <p className="text-xs text-muted-foreground">Automatically pick the best models for extracting sources.</p>
                </div>
                <Switch 
                  checked={smartExtractorRouting} 
                  onCheckedChange={setSmartExtractorRouting} 
                  disabled={!enableSourceExtractor}
                />
              </div>

              <div className="pt-2">
                {!smartExtractorRouting && (
                  <ModelSelector 
                    selectedModels={sourceExtractorModels}
                    onSelectedModelsChange={(models) => {
                      const toSet = models.length > 0 ? models : ["openai/gpt-4o-mini"];
                      setSourceExtractorModels(toSet);
                    }}
                    triggerDisabled={!enableSourceExtractor}
                    triggerClassName="w-full md:w-1/2 flex items-center justify-between border rounded-md px-3 py-2 text-sm text-muted-foreground bg-background hover:bg-muted/50 transition-colors cursor-pointer text-left h-10 disabled:opacity-50 disabled:cursor-not-allowed"
                    triggerContent={
                      <>
                        <span className="truncate">
                          {!enableSourceExtractor ? "no source extracted" : `${sourceExtractorModels.length} model${sourceExtractorModels.length !== 1 ? 's' : ''} selected`}
                        </span>
                        <ChevronDown className="h-4 w-4 opacity-50" />
                      </>
                    }
                  />
                )}
              </div>

              <p className="text-xs text-muted-foreground">The AI models used by the Research Agents to fetch and deduplicate initial sources. Selecting multiple runs them in parallel.</p>
            </div>

            <div className="flex items-center justify-between p-4 bg-muted/40 rounded-lg border">
              <div>
                <h4 className="font-medium">Enable Smart Routing</h4>
                <p className="text-sm text-muted-foreground">Automatically pick the best model for each specific claim.</p>
              </div>
              <Switch checked={smartRouting} onCheckedChange={setSmartRouting} />
            </div>
          </CardContent>
        </Card>

        {/* Analysis Preferences */}
        <Card className="border-primary/10 shadow-sm hover:shadow-md transition-shadow">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings2 className="h-5 w-5 text-primary" />
              Analysis Preferences
            </CardTitle>
            <CardDescription>Adjust how evidence is presented and scored.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium">Strict Fact-Checking</h4>
                <p className="text-sm text-muted-foreground">Require multiple highly-credible sources to verify a claim.</p>
              </div>
              <Switch defaultChecked />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium">Show Political Bias Warning</h4>
                <p className="text-sm text-muted-foreground">Flag claims that heavily rely on partisan sources.</p>
              </div>
              <Switch defaultChecked />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium">Auto-Extract URLs</h4>
                <p className="text-sm text-muted-foreground">Automatically fetch and read linked content within text.</p>
              </div>
              <Switch defaultChecked />
            </div>
          </CardContent>
        </Card>

        {/* Appearance */}
        <Card className="border-primary/10 shadow-sm hover:shadow-md transition-shadow">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Palette className="h-5 w-5 text-primary" />
              Appearance
            </CardTitle>
            <CardDescription>Customize the look and feel of Veridica.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium">Theme Preference</h4>
                <p className="text-sm text-muted-foreground">Choose between light, dark, or system default.</p>
              </div>
              <Select value={theme} onValueChange={(v) => { if (v) setTheme(v) }}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Select theme" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="light">Light</SelectItem>
                  <SelectItem value="dark">Dark</SelectItem>
                  <SelectItem value="system">System</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* API Usage Stats */}
        <Card className="border-primary/10 shadow-sm hover:shadow-md transition-shadow">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" />
              Mesh API Usage
            </CardTitle>
            <CardDescription>Your current API consumption and limits.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 border rounded-lg bg-card text-center hover:bg-muted/10 transition-colors">
                <div className="text-2xl font-bold text-primary">{apiUsage.requests.toLocaleString()}</div>
                <div className="text-sm text-muted-foreground mt-1">Requests this month</div>
              </div>
              <div className="p-4 border rounded-lg bg-card text-center hover:bg-muted/10 transition-colors">
                <div className="text-2xl font-bold text-primary">
                  {apiUsage.tokens > 1000000 
                    ? (apiUsage.tokens / 1000000).toFixed(1) + 'M' 
                    : apiUsage.tokens > 1000 
                      ? (apiUsage.tokens / 1000).toFixed(1) + 'K' 
                      : apiUsage.tokens.toLocaleString()}
                </div>
                <div className="text-sm text-muted-foreground mt-1">Tokens processed</div>
              </div>
              <div className="p-4 border rounded-lg bg-card text-center hover:bg-muted/10 transition-colors">
                <div className="text-2xl font-bold text-primary">${apiUsage.cost.toFixed(4)}</div>
                <div className="text-sm text-muted-foreground mt-1">Estimated Cost</div>
              </div>
            </div>
          </CardContent>
        </Card>

      </div>
    </div>
  )
}
