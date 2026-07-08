export type RetrievedSource = {
  id: string;
  domain: string;
  title: string;
  url: string;
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

import { getMeshClient } from "./mesh";

async function performSearchWithLLM(claim: string, model: string, agentName: "Research Agent A" | "Research Agent B"): Promise<RetrievedSource[]> {
  const client = getMeshClient();
  const response = await client.chat.completions.create({
    model: model,
    messages: [
      {
        role: "system",
        content: `You are ${agentName}, a web research agent. For the given claim, search your knowledge base to retrieve 2-3 highly relevant, factual sources that provide evidence (supporting or refuting). Return ONLY a JSON array of objects with keys: id (unique string), domain (string like 'example.com'), url (string absolute URL), title (string), snippet (string excerpt), and reliabilityScore (number 1-100). Do not use markdown blocks like \`\`\`json.`
      },
      {
        role: "user",
        content: `Find evidence for this claim: ${claim}`
      }
    ],
    temperature: 0.3,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) return [];

  try {
    const cleanContent = content.replace(/^```json/m, "").replace(/^```/m, "").trim();
    const parsed = JSON.parse(cleanContent);
    return parsed.map((src: any) => ({
      ...src,
      retrievedBy: agentName
    }));
  } catch (e) {
    console.error("Failed to parse search results from LLM", e);
    return [];
  }
}

// Simulated Research Agent A (Gemini)
async function geminiSearch(claim: string): Promise<RetrievedSource[]> {
  return performSearchWithLLM(claim, "google/gemini-3.1-flash-lite", "Research Agent A");
}

// Simulated Research Agent B (Grok)
async function grokSearch(claim: string): Promise<RetrievedSource[]> {
  return performSearchWithLLM(claim, "x-ai/grok-4.3", "Research Agent B");
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
