"use client"

import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { ShieldCheck, Link as LinkIcon, FileText, Mic, ArrowRight } from "lucide-react"
import Link from "next/link"
import { useState } from "react"

export default function Home() {
  const [claim, setClaim] = useState("")

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
          
          <TabsContent value="text" className="mt-0">
            <Textarea
              placeholder="E.g., 'Coffee stunts your growth' or 'Electric cars produce more emissions over their lifetime than gas cars...'"
              className="min-h-[160px] text-lg resize-none border-0 focus-visible:ring-0 focus-visible:ring-offset-0 bg-transparent p-4"
              value={claim}
              onChange={(e) => setClaim(e.target.value)}
            />
          </TabsContent>
          <TabsContent value="url" className="mt-0">
            <div className="flex items-center p-4 min-h-[160px] text-muted-foreground">
              Enter a URL to a news article or blog post to analyze its claims.
            </div>
          </TabsContent>
          <TabsContent value="upload" className="mt-0">
            <div className="flex items-center justify-center p-4 min-h-[160px] border-2 border-dashed rounded-lg border-muted">
              <p className="text-muted-foreground">Drag and drop a PDF or Document here</p>
            </div>
          </TabsContent>
          <TabsContent value="voice" className="mt-0">
            <div className="flex flex-col items-center justify-center p-4 min-h-[160px] gap-4">
              <Button variant="outline" size="icon" className="h-16 w-16 rounded-full border-primary/50 text-primary hover:bg-primary/10 hover:text-primary">
                <Mic className="h-8 w-8" />
              </Button>
              <p className="text-muted-foreground">Click to start speaking</p>
            </div>
          </TabsContent>
        </Tabs>

        {/* Action Bar */}
        <div className="flex items-center justify-between border-t p-4 pt-6 mt-2">
          <div className="text-sm text-muted-foreground">
            {claim.length} characters
          </div>
          <Link href={`/analyze?q=${encodeURIComponent(claim)}`}>
            <Button size="lg" className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-8 h-12 rounded-full">
              Analyze Claim
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </Link>
        </div>
      </div>
      
      <div className="mt-16 text-center">
        <Link href="/settings" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
          Configure API & Models
        </Link>
      </div>
    </div>
  )
}
