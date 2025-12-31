
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { UsageCallback, LogCallback } from "../../types";
import { handleGeminiError, getSafetySettings, trackUsage } from "./utils";

export const getClient = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

export async function runGeminiRequest<T>(params: {
  model: string;
  contents: any;
  config?: any;
  usageLabel: string;
  onUsage?: UsageCallback;
  logCallback: LogCallback;
  mapper: (response: GenerateContentResponse) => T;
}): Promise<T> {
  const ai = getClient();
  const { model, contents, config, usageLabel, onUsage, logCallback, mapper } = params;

  return await handleGeminiError(async () => {
    const response = await ai.models.generateContent({
      model,
      contents: Array.isArray(contents) ? contents : [{ role: 'user', parts: [{ text: contents }] }],
      config: {
        ...config,
        safetySettings: getSafetySettings()
      }
    });

    trackUsage(response, model, usageLabel, onUsage);
    
    if (response.candidates?.[0]?.finishReason === 'SAFETY') {
      const category = response.candidates[0].safetyRatings?.[0]?.category || "HARM_CATEGORY_UNKNOWN";
      // Custom error for safety block to be caught by UI
      throw new Error(`SAFETY_BLOCK:${category}`);
    }

    return mapper(response);
  }, usageLabel, logCallback);
}
