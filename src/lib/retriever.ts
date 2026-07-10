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

async function searchWikipedia(query: string): Promise<any[]> {
  try {
    const res = await fetch(`https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&utf8=&format=json&origin=*`);
    const data = await res.json();
    return data.query?.search?.map((s: any) => ({
      title: s.title,
      url: `https://en.wikipedia.org/wiki/${encodeURIComponent(s.title.replace(/ /g, "_"))}`,
      snippet: s.snippet.replace(/<\/?[^>]+(>|$)/g, ""), // strip html tags
      domain: "wikipedia.org",
      source: "Wikipedia"
    })) || [];
  } catch (e) {
    console.error("Wikipedia search failed", e);
    return [];
  }
}

async function searchSerper(query: string, apiKey: string): Promise<any[]> {
  if (!apiKey) return [];
  try {
    const res = await fetch("https://google.serper.dev/search", {
      method: "POST",
      headers: {
        "X-API-KEY": apiKey,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ q: query, num: 5 })
    });
    const data = await res.json();
    return data.organic?.map((s: any) => {
      try {
        const domain = new URL(s.link).hostname.replace("www.", "");
        return {
          title: s.title,
          url: s.link,
          snippet: s.snippet,
          domain: domain,
          source: "Google Search"
        };
      } catch {
        return null;
      }
    }).filter(Boolean) || [];
  } catch (e) {
    console.error("Serper search failed", e);
    return [];
  }
}

async function performSearchWithLLM(claim: string, searchContext: string, model: string, agentName: string): Promise<RetrievedSource[]> {
  const client = getMeshClient();
  const response = await client.chat.completions.create({
    model: model,
    messages: [
      {
        role: "system",
        content: `You are ${agentName}, a web research agent. The current year is ${new Date().getFullYear()}. For the given claim, evaluate the provided raw search results from Wikipedia and Google. Select the 2-3 most relevant, factual sources that provide strong evidence (supporting or refuting). Return ONLY a JSON array of objects with keys: id (unique string), domain (string like 'example.com'), url (string absolute URL), title (string), snippet (string excerpt, fix any broken sentences), and reliabilityScore (number 1-100 based on the credibility of the domain and relevance). Do not use markdown blocks like \`\`\`json.`
      },
      {
        role: "user",
        content: `Claim to analyze: ${claim}\n\nRaw Search Results Context:\n${searchContext}`
      }
    ],
    temperature: 0.2,
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
    if (!source.snippet || !source.title || !source.url) continue;

    // Deduplication key based on domain + rough title match
    const dedupKey = `${source.domain}-${source.title.substring(0, 15).toLowerCase()}`;
    
    if (uniqueSources.has(dedupKey)) {
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
    // 1. Fetch Real Web Data
    const serperKey = typeof window !== 'undefined' ? localStorage.getItem("veridica_serper_api_key") : null;
    
    // Fetch Wikipedia & Serper in parallel
    const [wikiResults, serperResults] = await Promise.all([
      searchWikipedia(claim),
      searchSerper(claim, serperKey || "")
    ]);
    
    const combinedRawResults = [...wikiResults, ...serperResults];
    const searchContext = JSON.stringify(combinedRawResults, null, 2);

    // 2. Run Research Agents in parallel to evaluate and format the real data
    const searchPromises = extractorModels.map((model, index) => 
      performSearchWithLLM(claim, searchContext, model, `Agent ${index + 1} (${model.split('/').pop()})`)
    );
    
    const resultsArray = await Promise.all(searchPromises);
    const allRetrievedSources = resultsArray.flat();

    // 3. Source Validation & Deduplication
    const finalSources = mergeAndValidateSources(allRetrievedSources);

    // 4. Compile Evidence Snapshot
    const snapshot: EvidenceSnapshot = {
      claim_analyzed: claim,
      total_sources_found: finalSources.length,
      sources: finalSources,
      timestamp: new Date().toISOString()
    };

    return snapshot;
  } catch (error) {
    console.error("Error during evidence gathering:", error);
    return {
      claim_analyzed: claim,
      total_sources_found: 0,
      sources: [],
      timestamp: new Date().toISOString()
    };
  }
}
