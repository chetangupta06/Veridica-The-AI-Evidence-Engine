import OpenAI from "openai";
import { MESH_API_BASE_URL } from "./config";

// Mesh API acts as an OpenAI compatible endpoint
export const meshClient = new OpenAI({
  baseURL: MESH_API_BASE_URL,
  apiKey: process.env.MESH_API_KEY || "mock-api-key",
  // Mesh API may not require some of the default headers
  dangerouslyAllowBrowser: true, // Only for demo purposes in this frontend app
});
