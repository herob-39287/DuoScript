import { StoryProject, AiModel } from "../../types";

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
  logCallback?: (type: string, source: string, msg: string, detail?: string) => void
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
        logCallback('error', 'NeuralSync', "構造化データの解析に失敗しました。デフォルト値を使用します。", (e2 as Error).message);
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
  logCallback?: any, 
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

export async function handleGeminiError<T>(fn: () => Promise<T>, source: string, logCallback?: any): Promise<T> {
  try {
    return await withRetry(fn, source, logCallback);
  } catch (error: any) {
    const friendlyMsg = getFriendlyErrorMessage(error);
    const detail = error.message || "No details available";
    
    if (logCallback) {
      logCallback('error', source, friendlyMsg, detail);
    }
    
    throw new DuoScriptError(friendlyMsg, detail, source, error.status);
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
 * Determines the appropriate thinking budget based on task complexity.
 * タスクの種類と入力コンテキストの大きさに応じて予算を動的に計算します。
 */
export const determineThinkingBudget = (model: string, taskComplexity: 'low' | 'medium' | 'high' | 'critical'): number => {
  if (model !== AiModel.REASONING) return 0;
  
  const MAX_PRO = 32768;
  const budgets = {
    low: 4000,      // 軽い推敲、単純なQ&A
    medium: 10000,  // キャラクター設定の深掘り、短文生成
    high: 20000,    // 複雑なプロット分岐、長文生成
    critical: MAX_PRO // 章全体の再構築、不整合スキャン
  };
  
  return budgets[taskComplexity];
};
