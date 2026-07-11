export function determineOptimalModels(
  prompt: string,
  hasImage: boolean,
  availableModels: string[]
): string[] {
  if (!availableModels || availableModels.length === 0) {
    return ["openai/gpt-4o-mini"];
  }

  const promptLower = prompt.toLowerCase();
  
  // 1. Modality-based routing
  const visionModels = [
    "openai/gpt-4o",
    "anthropic/claude-3.5-sonnet",
    "google/gemini-2.5-pro",
    "google/gemini-2.5-flash-image",
    "x-ai/grok-2-vision-1212",
    "openai/gpt-4o-mini"
  ];

  // 2. Domain-based routing (Coding/Tech)
  const codingKeywords = ["code", "python", "react", "typescript", "javascript", "bug", "debug", "html", "css", "sql", "api", "function", "error", "script"];
  const isCoding = codingKeywords.some(kw => promptLower.includes(kw));
  const codingModels = [
    "deepseek/deepseek-coder",
    "anthropic/claude-3.5-sonnet",
    "openai/gpt-4o",
    "qwen/qwen-2.5-coder-32b-instruct",
    "meta-llama/llama-3.1-70b-instruct"
  ];

  // 3. Complexity-based routing
  const complexKeywords = ["analyze", "compare", "calculate", "solve", "evaluate", "synthesize", "reasoning", "logic", "architecture", "explain why", "difference between"];
  const isComplex = prompt.length > 500 || complexKeywords.some(kw => promptLower.includes(kw));
  
  const heavyModels = [
    "openai/o1-preview",
    "openai/o1-mini",
    "deepseek/deepseek-reasoner",
    "anthropic/claude-3-opus",
    "anthropic/claude-3.5-sonnet",
    "openai/gpt-4o",
    "deepseek/deepseek-chat",
    "x-ai/grok-2-1212",
    "google/gemini-2.5-pro"
  ];

  const fastModels = [
    "openai/gpt-4o-mini",
    "google/gemini-2.5-flash",
    "google/gemini-3.1-flash-lite",
    "anthropic/claude-3-haiku",
    "anthropic/claude-3-5-haiku-20241022",
    "meta-llama/llama-3.1-8b-instruct"
  ];

  let selectedSet: string[] = [];

  const getAvailable = (priorities: string[]) => {
    return priorities.filter(m => availableModels.some(avail => {
      const availId = (typeof avail === 'string' ? avail : (avail as any).id || "").toLowerCase();
      return availId === m || availId.endsWith(m.split('/')[1]);
    }));
  };

  if (hasImage) {
    const availableVision = getAvailable(visionModels);
    selectedSet = availableVision.length > 0 ? availableVision : availableModels;
  } else if (isCoding) {
    const availableCoding = getAvailable(codingModels);
    const availableHeavy = getAvailable(heavyModels);
    selectedSet = Array.from(new Set([...availableCoding, ...availableHeavy]));
  } else if (isComplex) {
    const availableHeavy = getAvailable(heavyModels);
    selectedSet = availableHeavy.length > 0 ? availableHeavy : availableModels;
  } else {
    const availableFast = getAvailable(fastModels);
    selectedSet = availableFast.length > 0 ? availableFast : availableModels;
  }

  if (selectedSet.length === 0) {
    selectedSet = availableModels;
  }

  // Get raw IDs for the final selection
  const rawSelection = selectedSet.slice(0, 3).map(m => {
    const match = availableModels.find(avail => {
      const availId = typeof avail === 'string' ? avail : (avail as any).id || "";
      return availId.toLowerCase() === m || availId.toLowerCase().endsWith(m.split('/')[1]);
    });
    return typeof match === 'string' ? match : (match as any)?.id || m;
  });

  return Array.from(new Set(rawSelection)).slice(0, 3);
}

export function determineOptimalExtractors(
  prompt: string,
  availableModels: string[]
): string[] {
  if (!availableModels || availableModels.length === 0) {
    return ["openai/gpt-4o-mini"];
  }

  const promptLower = prompt.toLowerCase();
  
  // High context, heavy text processing extractors
  const heavyExtractors = [
    "google/gemini-2.5-pro",
    "anthropic/claude-3.5-sonnet",
    "openai/gpt-4o"
  ];

  // Blazing fast extractors
  const fastExtractors = [
    "anthropic/claude-3-haiku",
    "anthropic/claude-3-5-haiku-20241022",
    "openai/gpt-4o-mini",
    "google/gemini-2.5-flash",
    "google/gemini-3.1-flash-lite",
    "meta-llama/llama-3.1-8b-instruct"
  ];

  const isHeavy = prompt.length > 2000 || ["report", "document", "pdf", "transcript", "book", "article", "paper"].some(kw => promptLower.includes(kw));

  const getAvailable = (priorities: string[]) => {
    return priorities.filter(m => availableModels.some(avail => {
      const availId = (typeof avail === 'string' ? avail : (avail as any).id || "").toLowerCase();
      return availId === m || availId.endsWith(m.split('/')[1]);
    }));
  };

  let selectedSet: string[] = [];

  if (isHeavy) {
    const availableHeavy = getAvailable(heavyExtractors);
    const availableFast = getAvailable(fastExtractors);
    // Combine heavy and fast for balance
    selectedSet = Array.from(new Set([...availableHeavy, ...availableFast]));
  } else {
    const availableFast = getAvailable(fastExtractors);
    selectedSet = availableFast.length > 0 ? availableFast : availableModels;
  }

  if (selectedSet.length === 0) {
    selectedSet = availableModels;
  }

  // Get raw IDs for the final selection (max 2 for extraction is usually enough to avoid API rate limits, but we return up to 3)
  const rawSelection = selectedSet.slice(0, 3).map(m => {
    const match = availableModels.find(avail => {
      const availId = typeof avail === 'string' ? avail : (avail as any).id || "";
      return availId.toLowerCase() === m || availId.toLowerCase().endsWith(m.split('/')[1]);
    });
    return typeof match === 'string' ? match : (match as any)?.id || m;
  });

  return Array.from(new Set(rawSelection)).slice(0, 3);
}
