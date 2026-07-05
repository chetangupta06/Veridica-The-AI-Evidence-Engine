"use client"

import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { ShieldCheck, Link as LinkIcon, FileText, Mic, ArrowRight } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { Input } from "@/components/ui/input"

export default function Home() {
  const router = useRouter()
  const [claimText, setClaimText] = useState("")
  const [urlInput, setUrlInput] = useState("")
  const [fileParsing, setFileParsing] = useState(false)

  const handleAnalyze = (type: "text" | "url" | "file", content: string) => {
    if (!content.trim()) return;

    // Save to session storage
    sessionStorage.setItem("veridica_input", JSON.stringify({ type, content }))
    
    // Navigate to analyze page
    router.push("/analyze")
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
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      {/* Hero Section */}
      <div className="w-full max-w-4xl text-center mb-12">
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
          
          <TabsContent value="text" className="mt-0 flex flex-col h-[200px]">
            <Textarea
              placeholder="E.g., 'Coffee stunts your growth' or 'Electric cars produce more emissions over their lifetime than gas cars...'"
              className="flex-1 text-lg resize-none border-0 focus-visible:ring-0 focus-visible:ring-offset-0 bg-transparent p-4"
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
          </TabsContent>

          <TabsContent value="url" className="mt-0 flex flex-col h-[200px]">
            <div className="flex-1 p-4 flex items-center justify-center">
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
      
      <div className="mt-16 text-center">
        <Button variant="link" onClick={() => router.push("/settings")} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
          Configure API & Models
        </Button>
      </div>
    </div>
  )
}
