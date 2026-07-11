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
  claimType?: string;
  color?: string;
  bg?: string;
  border?: string;
  isMock?: boolean;
};

export type ModelAnalysisResult = {
  model: string;
  verdict: "Mostly True" | "Partially True" | "Misleading" | "False" | "Unverifiable";
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
              content: `You are an expert data extractor. The current year is ${new Date().getFullYear()}. Extract all verifiable factual claims, statistics, dates, names, and quotes from the text. IMPORTANT: Every extracted claim MUST be fully self-contained and retain the specific context of the original text. Do not extract generic statements (e.g., "Governments suppressed news") without their specific subject matter (e.g., "Governments suppressed news about CERN creating a black hole"). 
Classify each claim into a 'claimType' which must be one of: "Scientific", "Historical", "Medical", "News", "Personal", "Opinion", "Prediction", or "Satire".
Return as a clean JSON object with three keys: 'claims' (an array of objects with 'text', 'verdict' ("TRUE", "FALSE", or "UNVERIFIABLE"), 'claimType' (string), 'confidence' (0-100), and 'explanation'), 'ridiculousnessScore' (0-100 score indicating how absurd, novelty, or ridiculous the overall text is), and 'isHumorous' (boolean flag indicating if the input is obviously silly or a joke). Do not wrap the JSON in markdown blocks like \`\`\`json.`
            },
            {
              role: "user",
              content: image ? [
                { type: "text", text: text || "Extract claims from this image." },
                { type: "image_url", image_url: { url: image } }
              ] : text
            }
          ],
          temperature: 0.0,
        });

        if (response.usage?.total_tokens) {
          trackUsage(response.usage.total_tokens, 0.50);
        }

        const content = response.choices[0]?.message?.content;
        if (!content) throw new Error("Empty response from Mesh API");

        const match = content.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
        const cleanContent = match ? match[0] : content.replace(/```json/gi, "").replace(/```/g, "").trim();
        const parsed = JSON.parse(cleanContent);
        const parsedClaims = Array.isArray(parsed) ? parsed : (parsed.claims || []);
        
        return {
          claims: parsedClaims.map((claim: any, index: number) => ({
            id: index + 1,
            text: claim.text,
            verdict: claim.verdict || "UNVERIFIABLE",
            claimType: claim.claimType || "News",
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
              content: `You are an expert fact-checking Reviewer. The current year is ${new Date().getFullYear()}. Analyze this claim primarily using the provided Structured Evidence Snapshot. 
CRITICAL RULES:
1. Beware of quote misattributions and urban legends! If the claim is a famous quote attributed to a historical figure, do NOT rely on general consensus, blogs, or motivational sites. You MUST look for primary source documentation (e.g., specific dates, letters, archives) or consensus from dedicated quote-investigation sites. If primary evidence is missing, the verdict should be False or Unverifiable.
2. If the snapshot lacks sufficient evidence, use your own expert internal knowledge to rigorously fact-check.
Return JSON with: verdict (Choose exactly one: True, Mostly True, Mixed, Mostly False, False, or Unverifiable), confidence (0-100), explanation, key_sources (array of objects with title, domain, credibility: High/Medium/Low).`
            },
            {
              role: "user",
              content: `Claim to analyze: ${claim}\n\nEvidence Snapshot:\n${JSON.stringify(snapshot, null, 2)}`
            }
          ],
          temperature: 0.0,
        });

        if (response.usage?.total_tokens) {
          trackUsage(response.usage.total_tokens, 1.00);
        }

        const content = response.choices[0]?.message?.content;
        if (!content) throw new Error("Empty response");

        const match = content.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
        const cleanContent = match ? match[0] : content.replace(/```json/gi, "").replace(/```/g, "").trim();
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

export async function analyzeMisconception(text: string, snapshot: EvidenceSnapshot, model: string, overallVerdictText: string): Promise<string> {
  const client = getMeshClient();
  const response = await client.chat.completions.create({
    model: model,
    messages: [
      {
        role: "system",
        content: `You are an expert researcher. The user's input has been analyzed and given an overall verdict of: ${overallVerdictText}.
If the verdict is FALSE or MOSTLY FALSE, concisely explain 'Why people believe this' (the origin of the misconception).
If the verdict is TRUE or MOSTLY TRUE, concisely explain 'Why this incredible fact is actually true' (the core evidence).
If the verdict is MIXED, explain 'Why this is partially true but misleading' (the nuance).
If the verdict is UNVERIFIABLE, explain 'Why this cannot be proven'.
Return ONLY 1 to 2 very short, punchy sentences of plain text explanation. Be extremely concise. Do NOT use any Markdown formatting like **bolding**.`
      },
      {
        role: "user",
        content: `Original Input: ${text}\n\nEvidence Snapshot:\n${JSON.stringify(snapshot, null, 2)}`
      }
    ],
    temperature: 0.0,
  });

  return response.choices[0]?.message?.content?.trim() || "Unable to determine the origin of this misconception.";
}
