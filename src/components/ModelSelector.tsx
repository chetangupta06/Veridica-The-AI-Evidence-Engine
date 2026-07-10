import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Check, ChevronDown, Cpu, Loader2, Search, X } from "lucide-react";
import { useMeshModels } from "@/lib/useMeshModels";

interface ModelSelectorProps {
  selectedModels: string[];
  onSelectedModelsChange: (models: string[]) => void;
  triggerContent: React.ReactNode;
  triggerClassName?: string;
  triggerDisabled?: boolean;
}

export function ModelSelector({ selectedModels, onSelectedModelsChange, triggerContent, triggerClassName, triggerDisabled }: ModelSelectorProps) {
  const [open, setOpen] = useState(false);
  const [tempSelected, setTempSelected] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [apiKey, setApiKey] = useState("");

  useEffect(() => {
    setApiKey(localStorage.getItem("veridica_api_key") || "");
  }, []);

  const { models, isLoading } = useMeshModels(apiKey);

  useEffect(() => {
    if (open) {
      setTempSelected([...selectedModels]);
      setSearch("");
    }
  }, [open, selectedModels]);

  const toggleModel = (modelId: string) => {
    if (tempSelected.includes(modelId)) {
      if (tempSelected.length > 1) {
        setTempSelected(prev => prev.filter(id => id !== modelId));
      }
    } else {
      setTempSelected(prev => [...prev, modelId]);
    }
  };

  const filteredModels = useMemo(() => {
    if (!models || models.length === 0) return [];
    if (!search) return models;
    const lowerSearch = search.toLowerCase();
    return models.filter((m: any) => {
      const id = m.id || m.name || m.model || "";
      return id.toLowerCase().includes(lowerSearch);
    });
  }, [models, search]);

  const confirmSelection = () => {
    onSelectedModelsChange([...tempSelected]);
    setOpen(false);
  };

  const getModelId = (m: any) => m.id || m.name || m.model || "";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className={triggerClassName} disabled={triggerDisabled}>
        {triggerContent}
      </DialogTrigger>
      <DialogContent className="max-w-md p-0 overflow-hidden flex flex-col max-h-[85vh] bg-popover border-border text-popover-foreground shadow-lg">
        <DialogHeader className="shrink-0 px-4 py-3 border-b border-border/50">
          <DialogTitle className="text-sm font-semibold flex items-center gap-2">
            <Cpu className="w-4 h-4" />
            Select Models
          </DialogTitle>
        </DialogHeader>

        {/* Search Input */}
        <div className="shrink-0 px-3 pt-3">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search models..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-background/50 border-border/50 focus-visible:ring-1 focus-visible:ring-primary/30 h-10"
            />
          </div>
        </div>

        {/* List of Models */}
        <div className="flex-1 overflow-y-auto min-h-[100px] p-2 space-y-0.5">
          {!apiKey && (
            <div className="p-8 text-center text-sm text-muted-foreground flex flex-col items-center gap-2">
              <Cpu className="w-8 h-8 opacity-50 mb-2" />
              <p>Missing API Key</p>
              <p className="text-xs">Configure your Mesh API Key in Settings to load models.</p>
            </div>
          )}
          
          {apiKey && isLoading && (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="w-6 h-6 animate-spin mr-2" />
              Loading models...
            </div>
          )}

          {apiKey && !isLoading && filteredModels.length === 0 && (
            <div className="text-center py-12 text-sm text-muted-foreground">
              No models found.
            </div>
          )}

          {apiKey && !isLoading && filteredModels.map((m: any) => {
            const id = getModelId(m);
            const isSelected = tempSelected.includes(id);
            return (
              <button
                key={id}
                onClick={() => toggleModel(id)}
                className={`w-full flex items-center px-3 py-2.5 rounded-md transition-colors text-left group ${
                  isSelected ? 'bg-primary/5 hover:bg-primary/10' : 'hover:bg-muted/50'
                }`}
              >
                <div className="w-6 flex items-center justify-start shrink-0">
                  {isSelected ? (
                    <Check className="w-4 h-4 text-primary" />
                  ) : (
                    <div className="w-4 h-4 border border-border/50 rounded-full opacity-50 group-hover:border-foreground/30 transition-colors" />
                  )}
                </div>
                <span className={`text-sm font-mono truncate ${isSelected ? 'text-foreground font-medium' : 'text-foreground/80'}`}>{id}</span>
              </button>
            );
          })}
        </div>

        {/* Selected Models Footer */}
        <div className="shrink-0 border-t border-border bg-muted/20 p-4 flex flex-col gap-3 max-h-[40vh]">
          <div className="shrink-0 flex items-center justify-between">
            <span className="text-sm text-muted-foreground font-medium">
              {tempSelected.length} {tempSelected.length === 1 ? 'model' : 'models'} selected
            </span>
            <Button 
              size="sm" 
              onClick={confirmSelection}
              className="h-8 text-xs font-semibold px-4"
            >
              Confirm
            </Button>
          </div>
          
          <div className="flex-1 overflow-y-auto pb-1 pr-1">
            <div className="flex flex-wrap gap-2">
              {tempSelected.map(id => (
                <div 
                  key={id} 
                  className="flex items-center gap-1.5 bg-background border border-border rounded-md px-2.5 py-1.5 text-xs text-foreground/80 font-mono shadow-sm"
                >
                  <span className="truncate max-w-[220px]">{id}</span>
                  <button 
                    onClick={(e) => { e.stopPropagation(); toggleModel(id); }}
                    className="text-muted-foreground hover:text-foreground hover:bg-muted rounded-sm p-0.5 transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
