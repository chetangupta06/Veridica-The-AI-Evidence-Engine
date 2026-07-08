import OpenAI from "openai";
import { MESH_API_BASE_URL } from "./config";
import type { EvidenceSnapshot } from "./retriever";

// Mesh API acts as an OpenAI compatible endpoint
export const meshClient = new OpenAI({
  baseURL: MESH_API_BASE_URL,
  apiKey: process.env.NEXT_PUBLIC_MESH_API_KEY || "mock-api-key",
  dangerouslyAllowBrowser: true, // Only for demo purposes in this frontend app
});

export type ExtractedClaim = {
  id: number;
  text: string;
  verdict?: "TRUE" | "FALSE" | "UNVERIFIABLE"; // Simple extraction verdict
  confidence?: number;
  explanation?: string;
  color?: string;
  bg?: string;
  border?: string;
  isMock?: boolean;
};

export type ModelAnalysisResult = {
  model: string;
  verdict: "Mostly True" | "Partially True" | "Misleading" | "False" | "Insufficient Evidence";
  confidence: number;
  explanation: string;
  key_sources: { title: string; domain: string; credibility: "High" | "Medium" | "Low" }[];
  isMock?: boolean;
};

export type ClaimAnalysis = ExtractedClaim & {
  modelResults: ModelAnalysisResult[];
  aggregatedVerdict: string;
  aggregatedConfidence: number;
};

// Mock data for extraction fallback
const MOCK_EXTRACTED_CLAIMS: ExtractedClaim[] = [
  {
    id: 1,
    text: "Coffee stunts your growth and decreases bone density.",
    verdict: "FALSE",
    isMock: true,
  },
  {
    id: 2,
    text: "Caffeine can cause temporary spikes in blood pressure.",
    verdict: "TRUE",
    isMock: true,
  },
  {
    id: 3,
    text: "Electric cars produce 0 emissions over their entire lifecycle.",
    verdict: "FALSE",
    isMock: true,
  }
];

export async function extractClaims(text: string, model: string): Promise<ExtractedClaim[]> {
  try {
    const response = await meshClient.chat.completions.create({
      model: model,
      messages: [
        {
          role: "system",
          content: "Extract all verifiable factual claims, statistics, dates, names, and quotes from the text. Return as a clean JSON array of objects with the keys 'text', 'verdict' (TRUE, FALSE, or UNVERIFIABLE), 'confidence' (0-100), and 'explanation'. Do not wrap the JSON in markdown blocks like ```json."
        },
        {
          role: "user",
          content: text
        }
      ],
      temperature: 0.2,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) throw new Error("Empty response from Mesh API");

    const cleanContent = content.replace(/^```json/m, "").replace(/^```/m, "").trim();
    const parsedClaims = JSON.parse(cleanContent);
    
    return parsedClaims.map((claim: any, index: number) => ({
      id: index + 1,
      text: claim.text,
      verdict: claim.verdict || "UNVERIFIABLE",
      confidence: claim.confidence || 0,
      explanation: claim.explanation || "No explanation provided.",
    }));
  } catch (error) {
    console.warn("Mesh API extraction error or fallback triggered:", error);
    if (text.includes("Chandrayaan-3") || text.includes("Interstellar")) {
      return [
        { id: 1, text: "India's Chandrayaan-3 mission cost approximately $75 million", verdict: "TRUE", isMock: true },
        { id: 2, text: "significantly cheaper than the budget of the Hollywood movie Interstellar.", verdict: "TRUE", isMock: true },
        { id: 3, text: "critics claim it generated massive amounts of space debris in lunar orbit.", verdict: "FALSE", isMock: true }
      ];
    }
    return MOCK_EXTRACTED_CLAIMS;
  }
}

// Mock generator for varied responses
const getMockAnalysis = (claimText: string, model: string): ModelAnalysisResult => {
  // We'll vary responses based on model name length + claim length to keep them somewhat deterministic but varied.
  const hash = claimText.length + model.length;
  
  if (claimText.includes("Coffee stunts")) {
    if (hash % 3 === 0) {
      return {
        model,
        verdict: "Misleading",
        confidence: 85,
        explanation: `${model} found that while caffeine doesn't stunt growth, high intake can interfere with calcium absorption in rare cases, making the absolute claim misleading.`,
        key_sources: [{ title: "Nutrition Research", domain: "nutrition.org", credibility: "Medium" }],
        isMock: true,
      }
    } else {
      return {
        model,
        verdict: "False",
        confidence: 95,
        explanation: `${model} analyzed extensive pediatric studies which show zero correlation between coffee and bone growth.`,
        key_sources: [{ title: "Harvard Health", domain: "health.harvard.edu", credibility: "High" }],
        isMock: true,
      }
    }
  } else if (claimText.includes("blood pressure")) {
    return {
      model,
      verdict: hash % 2 === 0 ? "Partially True" : "Mostly True",
      confidence: 80 + (hash % 15),
      explanation: `${model} confirms temporary spikes happen, though tolerance develops rapidly in habitual drinkers.`,
      key_sources: [{ title: "Mayo Clinic", domain: "mayoclinic.org", credibility: "High" }],
      isMock: true,
    }
  } else {
    // Default varied
    const verdicts: ModelAnalysisResult["verdict"][] = ["Mostly True", "Partially True", "Misleading", "False", "Insufficient Evidence"];
    const verdict = verdicts[hash % verdicts.length];
    return {
      model,
      verdict,
      confidence: 60 + (hash % 30),
      explanation: `${model} concluded the claim is ${verdict.toLowerCase()} based on current web corpus data.`,
      key_sources: [{ title: "General Source", domain: "example.com", credibility: "Medium" }],
      isMock: true,
    }
  }
}

export async function analyzeClaim(claim: string, snapshot: EvidenceSnapshot, selectedModels: string[]): Promise<ModelAnalysisResult[]> {
  const promises = selectedModels.map(async (model) => {
    try {
      const response = await meshClient.chat.completions.create({
        model: model,
        messages: [
          {
            role: "system",
            content: "You are an expert fact-checking Reviewer. Analyze this claim using ONLY the provided Structured Evidence Snapshot (which has been gathered by Research Agents, validated, and deduplicated). Return JSON with: verdict (Mostly True / Partially True / Misleading / False / Insufficient Evidence), confidence (0-100), explanation, key_sources (array of objects with title, domain, credibility: High/Medium/Low)."
          },
          {
            role: "user",
            content: `Claim to analyze: ${claim}\n\nEvidence Snapshot:\n${JSON.stringify(snapshot, null, 2)}`
          }
        ],
        temperature: 0.1,
      });

      const content = response.choices[0]?.message?.content;
      if (!content) throw new Error("Empty response");

      const cleanContent = content.replace(/^```json/m, "").replace(/^```/m, "").trim();
      const parsed = JSON.parse(cleanContent);
      
      return {
        model,
        verdict: parsed.verdict,
        confidence: parsed.confidence,
        explanation: parsed.explanation,
        key_sources: parsed.key_sources || [],
      };
    } catch (error) {
      console.warn(`Mesh API analysis error for model ${model}, falling back to mock:`, error);
      return getMockAnalysis(claim, model);
    }
  });

  return Promise.all(promises);
}
