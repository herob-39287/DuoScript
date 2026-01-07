
import { StoryProject, AiModel, UsageCallback, LogCallback, TaskComplexity, ModelRequestConfig, TransmissionScope, SafetyPreset, Character, ContextFocus } from "../../types";
import { GenerateContentResponse, HarmCategory, HarmBlockThreshold } from "@google/genai";

export class DuoScriptError extends Error {
  constructor(
    message: string, 
    public details?: string, 
    public source?: string,
    public status?: number,
    public safetyCategory?: string
  ) {
    super(message);
    this.name = 'DuoScriptError';
  }
}

/**
 * 簡易的なトークン数推定 (文字数ベース)
 */
export function estimateTokenCount(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length * 1.1);
}

export function translateSafetyCategory(category?: string): string {
  if (!category) return "不明な安全ポリシー";
  const map: Record<string, string> = {
    'HARM_CATEGORY_SEXUALLY_EXPLICIT': '性的表現',
    'HARM_CATEGORY_HATE_SPEECH': 'ヘイトスピーチ',
    'HARM_CATEGORY_HARASSMENT': '嫌がらせ',
    'HARM_CATEGORY_DANGEROUS_CONTENT': '危険なコンテンツ',
    'HARM_CATEGORY_CIVIC_INTEGRITY': '公的誠実性'
  };
  return map[category] || category;
}

/**
 * AIが返したテキストから純粋なJSON部分を抽出・修復する
 */
export function repairTruncatedJson(text: string): { repairedText: string, repairSteps: string[] } {
  let repaired = text.trim();
  const steps: string[] = [];

  // 1. Markdownコードブロックの除去
  // Regex without backticks to prevent syntax errors in some environments
  const jsonMatch = repaired.match(new RegExp("```(?:json)?\\s*([\\s\\S]*?)\\s*```"));
  if (jsonMatch) {
    repaired = jsonMatch[1].trim();
    steps.push("Extracted from Markdown block");
  } else {
    // 閉じタグがない不完全なコードブロック
    repaired = repaired.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
  }

  // 2. 制御文字などの除去
  repaired = repaired.replace(/[\u0000-\u001F\u007F-\u009F]/g, "");

  // 3. 文字列の閉じ忘れチェック (トークン切れ対策)
  let isInsideString = false;
  let escaped = false;
  for (let i = 0; i < repaired.length; i++) {
    const char = repaired[i];
    if (char === '"' && !escaped) {
      isInsideString = !isInsideString;
    }
    escaped = char === '\\' && !escaped;
  }
  if (isInsideString) {
    repaired += '"';
    steps.push("Closed unterminated string");
  }

  // 4. 括弧の不一致の簡易補完
  const openBraces = (repaired.match(/\{/g) || []).length;
  const closeBraces = (repaired.match(/\}/g) || []).length;
  const openBrackets = (repaired.match(/\[/g) || []).length;
  const closeBrackets = (repaired.match(/\]/g) || []).length;

  if (openBrackets > closeBrackets) {
    repaired += ']'.repeat(openBrackets - closeBrackets);
    steps.push(`Added ${openBrackets - closeBrackets} brackets`);
  }
  if (openBraces > closeBraces) {
    repaired += '}'.repeat(openBraces - closeBraces);
    steps.push(`Added ${openBraces - closeBraces} braces`);
  }

  return { repairedText: repaired, repairSteps: steps };
}

/**
 * スキーマ遵守のJSONパース
 */
export function safeJsonParse<T>(text: string, source: string): { value: T | null; error?: string } {
  if (!text) return { value: null, error: "Empty response" };
  
  try {
    // まずはそのままパース
    return { value: JSON.parse(text) as T };
  } catch (e1) {
    try {
      // 修復を試みる
      const { repairedText } = repairTruncatedJson(text);
      return { value: JSON.parse(repairedText) as T };
    } catch (e2: any) {
      console.error(`JSON Parse Error [${source}]:`, e2.message, "Text preview:", text.slice(-100));
      return { value: null, error: e2.message };
    }
  }
}

/**
 * 値が期待する型や条件を満たすか検証し、満たさない場合はフォールバック値を返す
 */
export function sanitize<T>(value: any, predicate: (v: any) => boolean, fallback: T): T {
  return predicate(value) ? value : fallback;
}

export function isString(v: any): v is string {
  return typeof v === 'string';
}

export function isNonEmptyString(v: any): v is string {
  return typeof v === 'string' && v.trim().length > 0;
}

export function isNumber(v: any): v is number {
  return typeof v === 'number' && !isNaN(v);
}

export async function handleGeminiError<T>(
  operation: () => Promise<T>,
  source: string,
  logCallback?: LogCallback
): Promise<T> {
  try {
    return await operation();
  } catch (error: any) {
    if (logCallback) {
      const msg = error.message || "AI通信エラー";
      logCallback('error', source as any, msg);
    }
    throw error;
  }
}

export async function withRetry<T>(
  operation: () => Promise<T>,
  source: string,
  logCallback: LogCallback,
  maxRetries = 3
): Promise<T> {
  let lastError: any;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await operation();
    } catch (error: any) {
      lastError = error;
      if (error.status === 429 || error.message.includes("429")) {
        const delay = Math.pow(2, i) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      throw error; 
    }
  }
  throw lastError;
}

export function trackUsage(
  response: GenerateContentResponse, 
  model: string, 
  source: string, 
  callback?: UsageCallback
) {
  if (!response.usageMetadata || !callback) return;
  
  // promptTokenCount is generally the total input tokens (including cached).
  const totalPrompt = response.usageMetadata.promptTokenCount || 0;
  const cached = response.usageMetadata.cachedContentTokenCount || 0;
  const output = response.usageMetadata.candidatesTokenCount || 0;

  callback({
    model,
    source,
    input: totalPrompt,
    output: output,
    cached: cached
  });
}

export function getSafetySettings() {
  return [
    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
    { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH }
  ];
}
