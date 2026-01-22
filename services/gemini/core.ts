
import { GoogleGenAI } from "@google/genai";
import { UsageCallback, LogCallback } from "../../types";
import { trackUsage } from "./utils";
import { AI_MODELS, TOKEN_LIMITS } from "../../constants";
import { executeWithFallback } from "./geminiExecution";

export interface RequestConfig {
  model: string;
  contents: any;
  config?: any;
  usageLabel: string;
  onUsage?: UsageCallback;
  logCallback: LogCallback;
  mapper: (response: { text: string; candidates?: any }) => any;
}

export interface StreamConfig {
  model: string;
  contents: any;
  config?: any;
  usageLabel: string;
  onUsage?: UsageCallback;
  logCallback: LogCallback;
}

/**
 * Gemini Client Abstraction
 * Wraps GoogleGenAI SDK to provide unified error handling, retry logic, and usage tracking.
 */
export class GeminiClient {
  private genAI: GoogleGenAI;

  constructor(apiKey: string) {
    if (!apiKey) throw new Error("API Key is required for GeminiClient.");
    this.genAI = new GoogleGenAI({ apiKey });
  }

  async embedText(text: string): Promise<number[]> {
    try {
      const response = await this.genAI.models.embedContent({
        model: AI_MODELS.EMBEDDING,
        contents: [{ parts: [{ text }] }]
      });
      return response.embedding?.values || [];
    } catch (e) {
      console.error("Embedding API error:", e);
      return [];
    }
  }

  async request<T>(params: RequestConfig): Promise<T> {
    const { model, contents, config, usageLabel, onUsage, logCallback, mapper } = params;
    const normalizedContents = this.normalizeContents(contents);

    const primaryOp = async (attempt: number) => {
      const currentContents = [...normalizedContents];
      if (attempt > 1) {
        currentContents.push({ role: 'user', parts: [{ text: "Previous response was invalid JSON. Please correct the format to match the schema exactly." }] });
      }

      const res = await this.genAI.models.generateContent({
        model: model,
        contents: currentContents,
        config: this.normalizeConfig(model, config)
      });

      trackUsage(res, model, usageLabel, onUsage);
      
      if (res.candidates?.[0]?.finishReason === 'SAFETY') {
        throw new Error(`SAFETY_BLOCK:${res.candidates[0].safetyRatings?.[0]?.category || 'UNKNOWN'}`);
      }

      return mapper({ text: res.text || "", candidates: res.candidates });
    };

    const fallbackOp = async () => {
      const flashModel = AI_MODELS.FAST;
      const flashConfig = { ...config };
      const res = await this.genAI.models.generateContent({
        model: flashModel,
        contents: normalizedContents,
        config: this.normalizeConfig(flashModel, flashConfig)
      });

      trackUsage(res, flashModel, `${usageLabel}(Fallback)`, onUsage);
      return mapper({ text: res.text || "", candidates: res.candidates });
    };

    try {
      return await executeWithFallback(primaryOp, fallbackOp, {
        source: usageLabel,
        logCallback: logCallback
      });
    } catch (error: any) {
      logCallback('error', usageLabel as any, `AIエラー: ${error?.message || 'Unknown Error'}`);
      throw error;
    }
  }

  async *stream(params: StreamConfig) {
    const { model, contents, config, usageLabel, onUsage, logCallback } = params;
    const normalizedContents = this.normalizeContents(contents);

    const createStream = async (targetModel: string) => {
      return await this.genAI.models.generateContentStream({
        model: targetModel,
        contents: normalizedContents,
        config: this.normalizeConfig(targetModel, config)
      });
    };

    let stream: any;
    let currentModel = model;
    let finalUsageMetadata: any = null;

    try {
      try {
        stream = await createStream(model);
      } catch (e: any) {
        const msg = e.message || "";
        const status = e.status || e.error?.code;
        const isAuthError = status === 403 || status === 404 || msg.includes('403') || msg.includes('404');
        
        if (isAuthError && model !== AI_MODELS.FAST) {
          logCallback('info', usageLabel as any, `ストリーム接続エラー(${status})。高速モデルへ切り替えます。`);
          currentModel = AI_MODELS.FAST;
          stream = await createStream(currentModel);
        } else {
          throw e;
        }
      }

      for await (const chunk of stream) {
        if (chunk.usageMetadata) finalUsageMetadata = chunk.usageMetadata;
        
        if (chunk.candidates?.[0]?.finishReason === 'SAFETY') {
          throw new Error(`SAFETY_BLOCK:${chunk.candidates[0].safetyRatings?.[0]?.category || 'UNKNOWN'}`);
        }

        yield {
          text: chunk.text || "",
          sources: chunk.candidates?.[0]?.groundingMetadata?.groundingChunks?.map((c: any) => ({ 
            title: c.web?.title || "Ref", 
            uri: c.web?.uri || "" 
          })) || []
        };
      }

    } catch (error: any) {
      logCallback('error', usageLabel as any, `ストリームエラー: ${error?.message || '中断されました'}`);
      throw error;
    } finally {
      if (finalUsageMetadata && onUsage) {
        trackUsage(
          { usageMetadata: finalUsageMetadata } as any, 
          currentModel, 
          usageLabel, 
          onUsage
        );
      }
    }
  }

  // --- Internal Helpers ---

  private normalizeContents(contents: any): any[] {
    if (Array.isArray(contents)) return contents;
    if (typeof contents === 'string') return [{ role: 'user', parts: [{ text: contents }] }];
    if (contents && contents.parts) return [contents];
    return [{ role: 'user', parts: [{ text: JSON.stringify(contents) }] }];
  }

  private normalizeConfig(model: string, config: any = {}) {
    const finalConfig = { ...config };
    if (finalConfig.thinkingConfig?.thinkingBudget > 0) {
      if (!finalConfig.maxOutputTokens || finalConfig.maxOutputTokens < TOKEN_LIMITS.DEFAULT_OUTPUT) {
        finalConfig.maxOutputTokens = TOKEN_LIMITS.DEFAULT_OUTPUT;
      }
    }
    if (model.includes('flash') && finalConfig.thinkingConfig) {
       if (finalConfig.thinkingConfig.thinkingBudget > TOKEN_LIMITS.THINKING_FLASH_LIMIT) {
           finalConfig.thinkingConfig.thinkingBudget = TOKEN_LIMITS.THINKING_FLASH_LIMIT;
       }
    }
    return finalConfig;
  }
}

// Deprecated: For backward compatibility with workers/hooks if they use this direct export
// Prefer dependency injection where possible.
let defaultClient: GeminiClient | null = null;
export const getClient = () => {
  if (!defaultClient) {
    defaultClient = new GeminiClient(process.env.API_KEY || "");
  }
  // Allow access to underlying genAI for specialized calls (like caching)
  return (defaultClient as any).genAI; 
};

// Re-export for compatibility
export const runGeminiRequest = async <T>(params: RequestConfig): Promise<T> => {
  if (!defaultClient) defaultClient = new GeminiClient(process.env.API_KEY || "");
  return defaultClient.request<T>(params);
}

export const runGeminiStream = async function* (params: StreamConfig) {
  if (!defaultClient) defaultClient = new GeminiClient(process.env.API_KEY || "");
  const stream = defaultClient.stream(params);
  for await (const chunk of stream) yield chunk;
}
