export type RetrievedSource = {
  id: string;
  domain: string;
  title: string;
  url: string;
  snippet: string;
  retrievedBy: string;
  reliabilityScore: number;
};

export type EvidenceSnapshot = {
  claim_analyzed: string;
  total_sources_found: number;
  sources: RetrievedSource[];
  timestamp: string;
};

import { getMeshClient, trackUsage } from "./mesh";

async function performSearchWithLLM(claim: string, model: string, agentName: string, realResults: any[]): Promise<RetrievedSource[]> {
  const client = getMeshClient();
  const contextData = JSON.stringify(realResults, null, 2);
  
  const response = await client.chat.completions.create({
    model: model,
    messages: [
      {
        role: "system",
        content: `You are ${agentName}, a web research agent. For the given claim, evaluate the provided REAL web search results. Select the 2-3 most highly relevant, factual sources that provide evidence (supporting or refuting). Return ONLY a JSON array of objects with keys: id (unique string), domain (string like 'example.com'), url (string absolute URL), title (string), snippet (string excerpt), and reliabilityScore (number 1-100). Do not use markdown blocks like \`\`\`json.\n\nREAL SEARCH RESULTS:\n${contextData}`
      },
      {
        role: "user",
        content: `Find evidence for this claim: ${claim}`
      }
    ],
    temperature: 0.3,
  });

  if (response.usage?.total_tokens) {
    trackUsage(response.usage.total_tokens, 0.50);
  }

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



// Merge, Validate, and Deduplicate
function mergeAndValidateSources(allSources: RetrievedSource[]): RetrievedSource[] {
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
export async function gatherEvidence(claim: string, extractorModels: string[] = ["openai/gpt-4o-mini"]): Promise<EvidenceSnapshot> {
  try {
    // 1. Fetch REAL search results from our backend
    const searchRes = await fetch('/api/search', {
      method: 'POST',
      body: JSON.stringify({ query: claim }),
      headers: { 'Content-Type': 'application/json' }
    });
    const searchData = await searchRes.json();
    const realResults = searchData.results || [];

    // 2. Run Research Agents in parallel for EVERY selected model
    // To maintain the two-agent deduplication framework even if only 1 model is selected,
    // we will run 1 agent per model. If they want variety, they select multiple models!
    const searchPromises = extractorModels.map((model, index) => 
      performSearchWithLLM(claim, model, `Agent ${index + 1} (${model.split('/').pop()})`, realResults)
    );
    
    const resultsArray = await Promise.all(searchPromises);
    const allRetrievedSources = resultsArray.flat();

    // 2. Source Validation & Deduplication
    const finalSources = mergeAndValidateSources(allRetrievedSources);

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
