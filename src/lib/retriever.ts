export type RetrievedSource = {
  id: string;
  domain: string;
  title: string;
  snippet: string;
  retrievedBy: "Research Agent A" | "Research Agent B" | "Merged";
  reliabilityScore: number;
};

export type EvidenceSnapshot = {
  claim_analyzed: string;
  total_sources_found: number;
  sources: RetrievedSource[];
  timestamp: string;
};

// Simulated Research Agent A (Gemini)
async function geminiSearch(claim: string): Promise<RetrievedSource[]> {
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 800));
  
  // Mock results based on claim content for demo purposes
  const sources: RetrievedSource[] = [];
  
  if (claim.includes("Chandrayaan-3") || claim.includes("75 million")) {
    sources.push({
      id: "gem-1",
      domain: "isro.gov.in",
      title: "Chandrayaan-3 Mission Details and Budget",
      snippet: "The approved cost of Chandrayaan-3 is Rs. 250 Crores (excluding Launch Vehicle Cost), bringing the total to roughly $74-75 million USD.",
      retrievedBy: "Research Agent A",
      reliabilityScore: 98
    });
    sources.push({
      id: "gem-2",
      domain: "space.com",
      title: "India's Moon Mission Cheaper than Interstellar",
      snippet: "Chandrayaan-3 was famously completed for around $75 million, which is indeed less than the $165 million budget of Christopher Nolan's Interstellar.",
      retrievedBy: "Research Agent A",
      reliabilityScore: 85
    });
  } else {
    // Generic fallback
    sources.push({
      id: "gem-gen-1",
      domain: "reuters.com",
      title: "Fact Check: Recent claims analyzed",
      snippet: `General consensus regarding: ${claim.substring(0, 30)}... indicates mixed historical context.`,
      retrievedBy: "Research Agent A",
      reliabilityScore: 80
    });
  }

  return sources;
}

// Simulated Research Agent B (Grok)
async function grokSearch(claim: string): Promise<RetrievedSource[]> {
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  const sources: RetrievedSource[] = [];
  
  if (claim.includes("Chandrayaan-3") || claim.includes("space debris")) {
    // Grok finds slightly different or more edgy sources, and maybe duplicates one
    sources.push({
      id: "grk-1",
      domain: "space.com",
      title: "Chandrayaan-3 vs Interstellar Budget",
      snippet: "Costing only 75 million USD, the mission was a fraction of a Hollywood blockbuster budget.",
      retrievedBy: "Research Agent B",
      reliabilityScore: 82
    }); // This is a duplicate domain/topic to Gemini's second source
    
    sources.push({
      id: "grk-2",
      domain: "esa.int",
      title: "Lunar Orbit Space Debris Tracking",
      snippet: "While lunar orbit debris is a growing concern, Chandrayaan-3's propulsion module was strategically moved to a high Earth orbit to avoid creating lunar debris, contrary to some online claims.",
      retrievedBy: "Research Agent B",
      reliabilityScore: 95
    });
  } else {
    sources.push({
      id: "grk-gen-1",
      domain: "apnews.com",
      title: "Breaking down viral claims",
      snippet: `Investigation into the claim shows conflicting data sources across major platforms.`,
      retrievedBy: "Research Agent B",
      reliabilityScore: 88
    });
  }

  return sources;
}

// Merge, Validate, and Deduplicate
function mergeAndValidateSources(geminiSources: RetrievedSource[], grokSources: RetrievedSource[]): RetrievedSource[] {
  const allSources = [...geminiSources, ...grokSources];
  const uniqueSources = new Map<string, RetrievedSource>();

  for (const source of allSources) {
    // Basic validation: must have a snippet and title
    if (!source.snippet || !source.title) continue;

    // Deduplication key based on domain + rough title match
    const dedupKey = `${source.domain}-${source.title.substring(0, 15).toLowerCase()}`;
    
    if (uniqueSources.has(dedupKey)) {
      // If it exists, we can merge or keep the one with higher reliability
      const existing = uniqueSources.get(dedupKey)!;
      if (source.reliabilityScore > existing.reliabilityScore) {
        uniqueSources.set(dedupKey, { ...source, retrievedBy: "Merged" });
      } else {
        uniqueSources.set(dedupKey, { ...existing, retrievedBy: "Merged" });
      }
    } else {
      uniqueSources.set(dedupKey, source);
    }
  }

  // Sort by reliability score descending
  return Array.from(uniqueSources.values()).sort((a, b) => b.reliabilityScore - a.reliabilityScore);
}

// Main Pipeline Entrypoint
export async function gatherEvidence(claim: string): Promise<EvidenceSnapshot> {
  try {
    // 1. Run Research Agents in parallel
    const [geminiResults, grokResults] = await Promise.all([
      geminiSearch(claim),
      grokSearch(claim)
    ]);

    // 2. Source Validation & Deduplication
    const finalSources = mergeAndValidateSources(geminiResults, grokResults);

    // 3. Compile Evidence Snapshot (Structured JSON format)
    const snapshot: EvidenceSnapshot = {
      claim_analyzed: claim,
      total_sources_found: finalSources.length,
      sources: finalSources,
      timestamp: new Date().toISOString()
    };

    return snapshot;
  } catch (error) {
    console.error("Error during evidence gathering:", error);
    // Fallback empty snapshot
    return {
      claim_analyzed: claim,
      total_sources_found: 0,
      sources: [],
      timestamp: new Date().toISOString()
    };
  }
}
