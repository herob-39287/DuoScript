
import { StoryProject } from "../../types";

export class DuoScriptError extends Error {
  constructor(message: string, public details?: string, public source?: string) {
    super(message);
    this.name = 'DuoScriptError';
  }
}

// 途切れたJSONを簡易的に修復する
export function repairTruncatedJson(text: string): string {
  let cleaned = text.trim();
  cleaned = cleaned.replace(/^```json\s*/i, "").replace(/\s*```$/, "");
  if (cleaned.startsWith('[') && !cleaned.endsWith(']')) {
    const lastObjectEnd = cleaned.lastIndexOf('}');
    if (lastObjectEnd !== -1) return cleaned.substring(0, lastObjectEnd + 1) + ']';
    return cleaned + ']';
  }
  if (cleaned.startsWith('{') && !cleaned.endsWith('}')) {
    const lastObjectEnd = cleaned.lastIndexOf('}');
    if (lastObjectEnd !== -1) return cleaned.substring(0, lastObjectEnd + 1) + '}';
    return cleaned + '}';
  }
  return cleaned;
}

export function safeJsonParse<T>(
  text: string | undefined, 
  defaultValue: T, 
  logCallback?: (type: string, source: string, msg: string, detail?: string) => void
): T {
  if (!text || text === "undefined" || text.trim() === "") return defaultValue;
  try {
    const cleanText = text.replace(/```json\n?|```/g, "").trim();
    return JSON.parse(cleanText) as T;
  } catch (e) {
    try {
      const repaired = repairTruncatedJson(text);
      return JSON.parse(repaired) as T;
    } catch (e2) {
      if (logCallback) logCallback('error', 'NeuralSync', "JSON解析に失敗しました。");
      return defaultValue;
    }
  }
}

export async function withRetry<T>(
  fn: () => Promise<T>, 
  source: string, 
  logCallback?: any, 
  retries = 2, 
  delay = 2000
): Promise<T> {
  try {
    return await fn();
  } catch (error: any) {
    if (retries > 0 && (error.message?.includes("429") || error.message?.includes("500"))) {
      if (logCallback) logCallback('info', 'System', `${source} 失敗。リトライ中...`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return withRetry(fn, source, logCallback, retries - 1, delay * 2);
    }
    throw error;
  }
}

export async function handleGeminiError<T>(fn: () => Promise<T>, source: string, logCallback?: any): Promise<T> {
  try {
    return await withRetry(fn, source, logCallback);
  } catch (error: any) {
    throw new DuoScriptError(error.message || "APIエラー", error.stack, source);
  }
}

export const trackUsage = (
  response: any, 
  model: string, 
  source: string, 
  callback?: (usage: { input: number; output: number; model: string; source: string }) => void
) => {
  if (response && response.usageMetadata && callback) {
    callback({
      input: response.usageMetadata.promptTokenCount || 0,
      output: response.usageMetadata.candidatesTokenCount || 0,
      model,
      source
    });
  }
};

export const getCompressedContext = (project: StoryProject) => {
  const bible = project.bible;
  return { 
    chars: (bible.characters || []).map(c => `- ${c.name} (場所: ${c.status?.location}, 状態: ${c.status?.internalState})`).join('\n'), 
    setting: (bible.setting || '').slice(0, 500),
    grandArc: (bible.grandArc || '').slice(0, 500)
  };
};
