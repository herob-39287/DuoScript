
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { UsageCallback, LogCallback } from "../../types";
import { handleGeminiError, trackUsage, safeJsonParse } from "./utils";

const MAX_RETRIES = 3;

export const getClient = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * 堅牢なGeminiリクエスト実行
 */
export async function runGeminiRequest<T>(params: {
  model: string;
  contents: any;
  config?: any;
  usageLabel: string;
  onUsage?: UsageCallback;
  logCallback: LogCallback;
  mapper: (response: { text: string; candidates?: any }) => T;
}): Promise<T> {
  const { model, contents, config, usageLabel, onUsage, logCallback, mapper } = params;
  let attempts = 0;
  let lastError: any = null;
  
  // 入力の正規化
  let currentContents: any[] = [];
  if (Array.isArray(contents)) {
    currentContents = contents;
  } else if (typeof contents === 'string') {
    currentContents = [{ role: 'user', parts: [{ text: contents }] }];
  } else if (contents && contents.parts) {
    currentContents = [contents];
  } else {
    currentContents = [{ role: 'user', parts: [{ text: JSON.stringify(contents) }] }];
  }

  while (attempts < MAX_RETRIES) {
    attempts++;
    const ai = getClient();

    try {
      const finalConfig = { ...config };
      if (finalConfig.thinkingConfig?.thinkingBudget > 0 && !finalConfig.maxOutputTokens) {
        finalConfig.maxOutputTokens = Math.max(finalConfig.thinkingConfig.thinkingBudget + 4096, 16384);
      }

      const response = await ai.models.generateContent({
        model,
        contents: currentContents,
        config: finalConfig
      });

      trackUsage(response, model, usageLabel, onUsage);
      
      if (response.candidates?.[0]?.finishReason === 'SAFETY') {
        throw new Error(`SAFETY_BLOCK:${response.candidates[0].safetyRatings?.[0]?.category || 'UNKNOWN'}`);
      }

      const responseText = response.text || "";

      // JSONモードのバリデーション
      if (finalConfig?.responseMimeType === "application/json") {
        const { value, error } = safeJsonParse(responseText, usageLabel);
        
        if (error || !value) {
          if (attempts < MAX_RETRIES) {
            logCallback('info', usageLabel as any, `JSON修復試行中...`);
            currentContents.push({ role: 'model', parts: [{ text: responseText }] });
            currentContents.push({ 
              role: 'user', 
              parts: [{ text: `Invalid JSON returned. Please provide only valid JSON according to the schema.` }] 
            });
            continue;
          }
          lastError = new Error(`JSON_PARSE_FAILED: ${error}`);
          break;
        }
      }

      return mapper({ text: responseText, candidates: response.candidates });

    } catch (error: any) {
      lastError = error;
      if (error.message?.includes('SAFETY_BLOCK')) throw error;
      
      if (error.status === 429) {
        await new Promise(r => setTimeout(r, Math.pow(2, attempts) * 1000));
        continue;
      }

      if (attempts < MAX_RETRIES) {
        continue;
      }
      break;
    }
  }

  logCallback('error', usageLabel as any, `AIの応答を処理できませんでした: ${lastError?.message}`);
  throw lastError;
}
