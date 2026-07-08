import OpenAI from "openai";
import { MESH_API_BASE_URL } from "./config";
import type { EvidenceSnapshot } from "./retriever";

// Function to get a dynamically configured client
export const getMeshClient = () => {
  const apiKey = typeof window !== 'undefined' ? localStorage.getItem("veridica_api_key") : null;
  if (!apiKey) throw new Error("API_KEY_MISSING");
  
  const baseURL = MESH_API_BASE_URL.startsWith("/") && typeof window !== "undefined"
    ? `${window.location.origin}${MESH_API_BASE_URL}`
    : MESH_API_BASE_URL;

  return new OpenAI({
    baseURL: baseURL,
    apiKey: apiKey,
    dangerouslyAllowBrowser: true, // Only for demo purposes in this frontend app
  });
};

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

export async function extractClaims(text: string, model: string): Promise<ExtractedClaim[]> {
  const client = getMeshClient();
  const response = await client.chat.completions.create({
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
}

export async function analyzeClaim(claim: string, snapshot: EvidenceSnapshot, selectedModels: string[]): Promise<ModelAnalysisResult[]> {
  const client = getMeshClient();
  const promises = selectedModels.map(async (model) => {
    const response = await client.chat.completions.create({
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
  });

  return await Promise.all(promises);
}
