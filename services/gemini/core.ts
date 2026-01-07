
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { UsageCallback, LogCallback } from "../../types";
import { handleGeminiError, trackUsage, safeJsonParse } from "./utils";

const MAX_RETRIES = 3;

export const getClient = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * テキストの埋め込みベクトルを取得する
 */
export async function embedText(text: string): Promise<number[]> {
  const ai = getClient();
  try {
    const response = await ai.models.embedContent({
      model: 'text-embedding-004',
      contents: [{ parts: [{ text }] }]
    });
    return response.embedding?.values || [];
  } catch (e) {
    console.error("Embedding API error:", e);
    throw e;
  }
}

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
      
      // Thinking Config有効時、出力トークン上限を確保する
      if (finalConfig.thinkingConfig?.thinkingBudget > 0) {
        // ユーザー指定がない、または32768未満の場合は32768に設定して思考後の出力枠を確保
        if (!finalConfig.maxOutputTokens || finalConfig.maxOutputTokens < 32768) {
          finalConfig.maxOutputTokens = 32768;
        }
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

      // トークン上限による途中終了の検知
      if (response.candidates?.[0]?.finishReason === 'MAX_TOKENS') {
        logCallback('info', usageLabel as any, '警告: トークン上限により応答が途切れました。思考予算または出力長を調整してください。');
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
      
      // Retry on 429 (Too Many Requests), 5xx (Server Errors), or Network/XHR errors
      const isRetryable = 
        error.status === 429 || 
        (error.status >= 500 && error.status < 600) ||
        error.message?.includes('xhr error') || 
        error.message?.includes('Rpc failed') ||
        error.message?.includes('fetch failed') ||
        error.message?.includes('network error');

      if (isRetryable) {
        console.warn(`Retrying Gemini request (${attempts}/${MAX_RETRIES}) due to error:`, error.message);
        await new Promise(r => setTimeout(r, Math.pow(2, attempts) * 1000));
        continue;
      }

      if (attempts < MAX_RETRIES) {
        // Fallback retry for other potentially transient errors
        continue;
      }
      break;
    }
  }

  logCallback('error', usageLabel as any, `AIの応答を処理できませんでした: ${lastError?.message}`);
  throw lastError;
}
