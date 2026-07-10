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

export const trackUsage = (tokens: number, costPer1M: number = 0.50) => {
  if (typeof window === 'undefined') return;
  try {
    const saved = localStorage.getItem("veridica_api_usage");
    const current = saved ? JSON.parse(saved) : { requests: 0, tokens: 0, cost: 0 };
    current.requests += 1;
    current.tokens += tokens;
    current.cost += (tokens / 1000000) * costPer1M;
    localStorage.setItem("veridica_api_usage", JSON.stringify(current));
  } catch (e) {
    console.error("Failed to track usage", e);
  }
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

export type ExtractionResult = {
  claims: ExtractedClaim[];
  ridiculousnessScore: number;
  isHumorous: boolean;
};

export async function extractClaims(text: string, image: string | null, modelsToUse: string[]): Promise<ExtractionResult> {
  const client = getMeshClient();
  let lastError: any;

  for (const model of modelsToUse) {
    try {
      const response = await client.chat.completions.create({
          model: model,
          messages: [
            {
              role: "system",
              content: `You are an expert data extractor. The current year is ${new Date().getFullYear()}. Extract all verifiable factual claims, statistics, dates, names, and quotes from the text. IMPORTANT: Every extracted claim MUST be fully self-contained and retain the specific context of the original text. Do not extract generic statements (e.g., "Governments suppressed news") without their specific subject matter (e.g., "Governments suppressed news about CERN creating a black hole"). Return as a clean JSON object with three keys: 'claims' (an array of objects with 'text', 'verdict' (TRUE, FALSE, or UNVERIFIABLE), 'confidence' (0-100), and 'explanation'), 'ridiculousnessScore' (0-100 score indicating how absurd, novelty, or ridiculous the overall text is), and 'isHumorous' (boolean flag indicating if the input is obviously silly or a joke). Do not wrap the JSON in markdown blocks like \`\`\`json.`
            },
            {
              role: "user",
              content: image ? [
                { type: "text", text: text || "Extract claims from this image." },
                { type: "image_url", image_url: { url: image } }
              ] : text
            }
          ],
          temperature: 0.2,
        });

        if (response.usage?.total_tokens) {
          trackUsage(response.usage.total_tokens, 0.50);
        }

        const content = response.choices[0]?.message?.content;
        if (!content) throw new Error("Empty response from Mesh API");

        const cleanContent = content.replace(/^```json/m, "").replace(/^```/m, "").trim();
        const parsed = JSON.parse(cleanContent);
        const parsedClaims = Array.isArray(parsed) ? parsed : (parsed.claims || []);
        
        return {
          claims: parsedClaims.map((claim: any, index: number) => ({
            id: index + 1,
            text: claim.text,
            verdict: claim.verdict || "UNVERIFIABLE",
            confidence: claim.confidence || 0,
            explanation: claim.explanation || "No explanation provided.",
          })),
          ridiculousnessScore: parsed.ridiculousnessScore || 0,
          isHumorous: parsed.isHumorous || false
        };
    } catch (error: any) {
      console.warn(`extractClaims with model "${model}" failed, falling back to next...`, error?.message || error);
      lastError = error;
    }
  }

  throw new Error(`Extraction failed across all selected models. Last error: ${lastError?.message || lastError}`);
}


export async function analyzeClaim(claim: string, snapshot: EvidenceSnapshot, selectedModels: string[]): Promise<ModelAnalysisResult[]> {
  const client = getMeshClient();
  const promises = selectedModels.map(async (model): Promise<ModelAnalysisResult | null> => {
    try {
      const response = await client.chat.completions.create({
          model: model,
          messages: [
            {
              role: "system",
              content: `You are an expert fact-checking Reviewer. The current year is ${new Date().getFullYear()}. Analyze this claim primarily using the provided Structured Evidence Snapshot. If the snapshot lacks sufficient evidence, you MUST use your own expert internal knowledge to fact-check the claim. Return JSON with: verdict (Choose exactly one: True, Mostly True, Mixed, Mostly False, False, or Unverifiable), confidence (0-100), explanation, key_sources (array of objects with title, domain, credibility: High/Medium/Low).`
            },
            {
              role: "user",
              content: `Claim to analyze: ${claim}\n\nEvidence Snapshot:\n${JSON.stringify(snapshot, null, 2)}`
            }
          ],
          temperature: 0.1,
        });

        if (response.usage?.total_tokens) {
          trackUsage(response.usage.total_tokens, 1.00);
        }

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
    } catch (error: any) {
      console.warn(`Model "${model}" failed:`, error?.message || error);
      return null; // Skip this model gracefully
    }
  });

  const results = await Promise.all(promises);
  const successfulResults = results.filter((r): r is ModelAnalysisResult => r !== null);
  
  if (successfulResults.length === 0) {
    throw new Error(`All models failed. Please check your model IDs and API key.`);
  }
  
  return successfulResults;
}

export async function analyzeMisconception(text: string, snapshot: EvidenceSnapshot, model: string): Promise<string> {
  const client = getMeshClient();
  const response = await client.chat.completions.create({
    model: model,
    messages: [
      {
        role: "system",
        content: "You are an expert researcher. The user's input contains a claim or claims that have been determined to be partially or wholly false. Based on the provided evidence, concisely explain 'Why people believe this' (i.e. the origin of the misconception, a grain of truth that was distorted, or common confusion). Return ONLY 1 to 2 very short, punchy sentences of plain text explanation. Be extremely concise. Do not write long paragraphs."
      },
      {
        role: "user",
        content: `Original Input: ${text}\n\nEvidence Snapshot:\n${JSON.stringify(snapshot, null, 2)}`
      }
    ],
    temperature: 0.3,
  });

  return response.choices[0]?.message?.content?.trim() || "Unable to determine the origin of this misconception.";
}
