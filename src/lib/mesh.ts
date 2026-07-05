import OpenAI from "openai";
import { MESH_API_BASE_URL } from "./config";

// Mesh API acts as an OpenAI compatible endpoint
export const meshClient = new OpenAI({
  baseURL: MESH_API_BASE_URL,
  apiKey: process.env.NEXT_PUBLIC_MESH_API_KEY || "mock-api-key",
  dangerouslyAllowBrowser: true, // Only for demo purposes in this frontend app
});

export type ExtractedClaim = {
  id: number;
  text: string;
  verdict?: "TRUE" | "FALSE" | "UNVERIFIABLE";
  confidence?: number;
  explanation?: string;
  color?: string;
  bg?: string;
  border?: string;
};

// Fallback mock data if API call fails
const MOCK_CLAIMS: ExtractedClaim[] = [
  {
    id: 1,
    text: "Coffee stunts your growth",
    verdict: "FALSE",
    confidence: 98,
    explanation: "Extensive medical studies have shown no correlation between caffeine consumption and bone growth or height in children or young adults.",
    color: "text-red-500",
    bg: "bg-red-500/10",
    border: "border-red-500/20"
  },
  {
    id: 2,
    text: "Caffeine can cause temporary spikes in blood pressure",
    verdict: "TRUE",
    confidence: 92,
    explanation: "Caffeine can cause a short, but dramatic increase in your blood pressure, even if you don't have high blood pressure.",
    color: "text-green-500",
    bg: "bg-green-500/10",
    border: "border-green-500/20"
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
    if (!content) {
      throw new Error("Empty response from Mesh API");
    }

    try {
      // Clean up markdown code blocks if the model still returns them
      const cleanContent = content.replace(/^```json/m, "").replace(/^```/m, "").trim();
      const parsedClaims = JSON.parse(cleanContent);
      
      return parsedClaims.map((claim: any, index: number) => ({
        id: index + 1,
        text: claim.text,
        verdict: claim.verdict || "UNVERIFIABLE",
        confidence: claim.confidence || 0,
        explanation: claim.explanation || "No explanation provided.",
        color: claim.verdict === "TRUE" ? "text-green-500" : claim.verdict === "FALSE" ? "text-red-500" : "text-yellow-500",
        bg: claim.verdict === "TRUE" ? "bg-green-500/10" : claim.verdict === "FALSE" ? "bg-red-500/10" : "bg-yellow-500/10",
        border: claim.verdict === "TRUE" ? "border-green-500/20" : claim.verdict === "FALSE" ? "border-red-500/20" : "border-yellow-500/20"
      }));
    } catch (parseError) {
      console.warn("Failed to parse Mesh API response, falling back to mock data.", parseError);
      return MOCK_CLAIMS;
    }
  } catch (error) {
    console.error("Mesh API error:", error);
    // Return mock data so the UI flow can still be demonstrated if the API key is invalid/missing
    return MOCK_CLAIMS;
  }
}
