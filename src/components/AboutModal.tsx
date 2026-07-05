import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Info, Network } from "lucide-react"

export function AboutModal() {
  return (
    <Dialog>
      <DialogTrigger render={<Button variant="ghost" size="sm" className="gap-2" />}>
        <Info className="w-4 h-4" />
        <span className="hidden sm:inline">About</span>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl">
            <Network className="w-6 h-6 text-primary" />
            About Veridica
          </DialogTitle>
          <DialogDescription className="text-base mt-2">
            Veridica is the AI Evidence Engine built on top of the <strong>Mesh API</strong>.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4 mt-4">
          <p className="text-sm text-muted-foreground leading-relaxed">
            By leveraging Mesh API's unified interface, Veridica routes complex claims to multiple frontier models simultaneously (like Claude 3.5, GPT-4o, and Gemini 1.5). 
          </p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Instead of relying on a single AI's potential hallucinations, Veridica builds a consensus-based <strong>Evidence Score</strong>—giving you an aggregated verdict backed by multiple intelligent agents.
          </p>
          <div className="bg-muted/50 p-4 rounded-lg mt-2 border">
            <h4 className="font-semibold text-sm mb-2">Features</h4>
            <ul className="text-sm space-y-1 text-muted-foreground list-disc pl-4">
              <li>Multi-model routing via Mesh API</li>
              <li>Semantic claim extraction</li>
              <li>Automated credibility scoring</li>
              <li>Consensus heatmap & PDF reports</li>
            </ul>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
