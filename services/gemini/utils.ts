
import { StoryProject, AiModel, UsageCallback, LogCallback, TaskComplexity, ModelRequestConfig } from "../../types";
import { GenerateContentResponse } from "@google/genai";

export class DuoScriptError extends Error {
  constructor(
    message: string, 
    public details?: string, 
    public source?: string,
    public status?: number
  ) {
    super(message);
    this.name = 'DuoScriptError';
  }
}

/**
 * Gemini APIのエラーメッセージをユーザーフレンドリーな日本語に変換します
 */
export function getFriendlyErrorMessage(error: any): string {
  const msg = error.message || "";
  const status = error.status || 0;

  if (msg.includes("API key not valid") || status === 401) {
    return "APIキーが無効です。設定を確認してください。";
  }
  if (msg.includes("429") || msg.includes("Too Many Requests")) {
    return "APIの利用制限（リクエスト過多）に達しました。少し待ってから再試行してください。";
  }
  if (msg.includes("500") || msg.includes("Internal Server Error")) {
    return "Googleのサーバー側で一時的なエラーが発生しました。";
  }
  if (msg.includes("503") || msg.includes("Service Unavailable")) {
    return "サービスが現在過負荷状態です。時間を置いてからお試しください。";
  }
  if (msg.includes("SAFETY")) {
    return "生成内容が安全ポリシーに抵触したため、中断されました。表現を調整してください。";
  }
  if (msg.includes("Quota exceeded") || msg.includes("billing")) {
    return "APIのクォータ制限を超過しました。請求設定を確認してください。";
  }
  if (msg.includes("Requested entity was not found")) {
    return "リソースが見つかりませんでした。APIキーのプロジェクト設定を確認してください。";
  }

  return "AIとの通信中に予期せぬエラーが発生しました。";
}

export function repairTruncatedJson(text: string): string {
  let cleaned = text.trim();
  // Markdownコードブロックの除去
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
  logCallback?: LogCallback
): T {
  if (!text || text === "undefined" || text.trim() === "") return defaultValue;
  
  const cleanAndParse = (str: string) => {
    const jsonStr = str.replace(/```json\n?|```/g, "").trim();
    return JSON.parse(jsonStr) as T;
  };

  try {
    return cleanAndParse(text);
  } catch (e) {
    try {
      const repaired = repairTruncatedJson(text);
      return cleanAndParse(repaired);
    } catch (e2) {
      if (logCallback) {
        logCallback('error', 'NeuralSync', "構造化データの解析に失敗しました。デフォルトの安全な値を返します。", (e2 as Error).message);
      }
      return defaultValue;
    }
  }
}

/**
 * 指数バックオフによるリトライロジック
 */
export async function withRetry<T>(
  fn: () => Promise<T>, 
  source: string, 
  logCallback?: LogCallback, 
  retries = 3, 
  baseDelay = 2000
): Promise<T> {
  let attempt = 0;
  
  while (attempt <= retries) {
    try {
      return await fn();
    } catch (error: any) {
      const isRetryable = error.message?.includes("429") || 
                          error.message?.includes("500") || 
                          error.message?.includes("503") ||
                          error.message?.includes("fetch");

      if (attempt < retries && isRetryable) {
        attempt++;
        const delay = baseDelay * Math.pow(2, attempt - 1);
        if (logCallback) {
          logCallback('info', 'System', `${source}: 通信エラー。${attempt}回目のリトライを開始します (${delay}ms後)...`);
        }
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      throw error;
    }
  }
  throw new Error("Maximum retries reached");
}

export async function handleGeminiError<T>(fn: () => Promise<T>, source: string, logCallback?: LogCallback): Promise<T> {
  try {
    return await withRetry(fn, source, logCallback);
  } catch (error: any) {
    const friendlyMsg = getFriendlyErrorMessage(error);
    const detail = error.message || "No details available";
    
    if (logCallback) {
      logCallback('error', source as any, friendlyMsg, detail);
    }
    
    throw new DuoScriptError(friendlyMsg, detail, source, error.status);
  }
}

export const trackUsage = (
  response: GenerateContentResponse, 
  model: string, 
  source: string, 
  callback?: UsageCallback
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

/**
 * Compresses the current story context into a brief summary for AI prompts.
 */
export const getCompressedContext = (project: StoryProject) => {
  const bible = project.bible;
  const foundation = {
    title: project.meta.title,
    genre: project.meta.genre,
    tone: bible.tone,
    summary: bible.summaryBuffer || bible.grandArc.slice(0, 1000)
  };

  const charContext = bible.characters.map(c => 
    `${c.name} (${c.role}): ${c.description.slice(0, 100)}`
  ).join('\n');

  const recentChapters = project.chapters.slice(-2).map(ch => 
    `「${ch.title}」: ${ch.summary.slice(0, 150)}`
  ).join('\n');

  return `
[基礎] ${foundation.title} (${foundation.genre}) / トーン: ${foundation.tone}
[概略] ${foundation.summary}
[人物]
${charContext}
[直近]
${recentChapters}
`.trim();
};

/**
 * タスクの種類と複雑度に基づいて、最適なモデルと設定を解決します。
 */
export const resolveModelConfig = (
  task: 'CHAT' | 'DRAFT' | 'SIM' | 'SCAN' | 'IMAGE' | 'TTS' | 'AUTO_GEN',
  complexity: TaskComplexity = 'basic'
): ModelRequestConfig => {
  switch (task) {
    case 'CHAT':
      return {
        model: AiModel.REASONING,
        thinkingBudget: complexity === 'complex' ? 12000 : 4000
      };
    case 'DRAFT':
      return {
        model: complexity === 'creative' ? AiModel.REASONING : AiModel.FAST,
        thinkingBudget: complexity === 'creative' ? 24000 : 0
      };
    case 'SIM':
      return {
        model: AiModel.REASONING,
        thinkingBudget: 20000
      };
    case 'SCAN':
      return {
        model: AiModel.REASONING,
        thinkingBudget: 32768
      };
    case 'IMAGE':
      return { model: AiModel.IMAGE };
    case 'TTS':
      return { model: AiModel.TTS };
    case 'AUTO_GEN':
      return {
        model: AiModel.FAST,
        thinkingBudget: 0
      };
    default:
      return { model: AiModel.FAST };
  }
};
