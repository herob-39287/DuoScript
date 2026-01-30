import {
  StoryProject,
  UsageCallback,
  LogCallback,
  TaskComplexity,
  ModelRequestConfig,
  TransmissionScope,
  SafetyPreset,
  Character,
  ContextFocus,
} from '../../types';
import { AiModel } from '../../constants';
import { GenerateContentResponse, HarmCategory, HarmBlockThreshold } from '@google/genai';
import { z } from 'zod';

export class DuoScriptError extends Error {
  constructor(
    message: string,
    public details?: string,
    public source?: string,
    public status?: number,
    public safetyCategory?: string,
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
  if (!category) return '不明な安全ポリシー';
  const map: Record<string, string> = {
    HARM_CATEGORY_SEXUALLY_EXPLICIT: '性的表現',
    HARM_CATEGORY_HATE_SPEECH: 'ヘイトスピーチ',
    HARM_CATEGORY_HARASSMENT: '嫌がらせ',
    HARM_CATEGORY_DANGEROUS_CONTENT: '危険なコンテンツ',
    HARM_CATEGORY_CIVIC_INTEGRITY: '公的誠実性',
  };
  return map[category] || category;
}

/**
 * AIが返したテキストから純粋なJSON部分を抽出・修復する
 */
export function repairTruncatedJson(text: string): { repairedText: string; repairSteps: string[] } {
  let repaired = text.trim();
  const steps: string[] = [];

  // 1. Markdownコードブロックの除去
  const jsonMatch = repaired.match(new RegExp('```(?:json)?\\s*([\\s\\S]*?)\\s*```'));
  if (jsonMatch) {
    repaired = jsonMatch[1].trim();
    steps.push('Extracted from Markdown block');
  } else {
    repaired = repaired.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
  }

  // 2. 制御文字などの除去
  repaired = Array.from(repaired)
    .filter((char) => {
      const code = char.charCodeAt(0);
      return !(code <= 0x1f || (code >= 0x7f && code <= 0x9f));
    })
    .join('');

  // 3. Stack-based repair for structure (Robust against truncation)
  const stack: string[] = [];
  let inString = false;
  let isEscaped = false;

  for (let i = 0; i < repaired.length; i++) {
    const c = repaired[i];

    if (inString) {
      if (c === '"' && !isEscaped) {
        inString = false;
      }
      isEscaped = c === '\\' && !isEscaped;
    } else {
      if (c === '"') {
        inString = true;
        isEscaped = false;
      } else if (c === '{') {
        stack.push('}');
      } else if (c === '[') {
        stack.push(']');
      } else if (c === '}' || c === ']') {
        if (stack.length > 0) {
          const expected = stack[stack.length - 1];
          if (c === expected) {
            stack.pop();
          }
          // If mismatch, assume minor corruption or desync, proceed scanning
        }
      }
    }
  }

  // 4. Close unterminated string
  if (inString) {
    repaired += '"';
    steps.push('Closed unterminated string');
  }

  // 5. Remove trailing comma (often happens before truncation or after string closure)
  // Check trimming white space from end first
  const trimmedEnd = repaired.trimEnd();
  if (trimmedEnd.endsWith(',')) {
    repaired = trimmedEnd.slice(0, -1);
    steps.push('Removed trailing comma');
  }

  // 6. Close open containers
  while (stack.length > 0) {
    const closer = stack.pop();
    repaired += closer;
    steps.push(`Added '${closer}'`);
  }

  return { repairedText: repaired, repairSteps: steps };
}

/**
 * 従来の非推奨パーサー（互換性のため維持）
 */
export function safeJsonParse<T>(
  text: string,
  source: string,
): { value: T | null; error?: string } {
  if (!text) return { value: null, error: 'Empty response' };

  try {
    return { value: JSON.parse(text) as T };
  } catch (e1) {
    try {
      const { repairedText } = repairTruncatedJson(text);
      return { value: JSON.parse(repairedText) as T };
    } catch (e2: any) {
      console.error(`JSON Parse Error [${source}]:`, e2.message);
      return { value: null, error: e2.message };
    }
  }
}

/**
 * Zodを使用した堅牢なバリデーション付きパース
 */
export function parseWithSchema<T>(
  text: string,
  schema: z.ZodType<T, z.ZodTypeDef, unknown>,
  source: string,
  fallback?: T,
): T {
  if (!text && fallback !== undefined) return fallback;
  if (!text) throw new Error('Empty response from AI');

  let json: any;
  try {
    json = JSON.parse(text);
  } catch (e) {
    try {
      const { repairedText } = repairTruncatedJson(text);
      json = JSON.parse(repairedText);
    } catch (finalError) {
      console.error(`[${source}] JSON Parse Fatal:`, text.slice(0, 200));
      if (fallback !== undefined) return fallback;
      throw new Error(`JSON Parse Failed: ${source}`);
    }
  }

  const result = schema.safeParse(json);

  if (result.success) {
    return result.data;
  } else {
    console.warn(`[${source}] Schema Validation Failed:`, result.error.format());
    // バリデーション失敗時も、フォールバックがあればそれを返す
    if (fallback !== undefined) return fallback;
    throw new Error(`Schema Validation Failed: ${source}`);
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
  logCallback?: LogCallback,
): Promise<T> {
  try {
    return await operation();
  } catch (error: any) {
    let msg = error.message || 'AI通信エラー';

    // Customize user-facing error messages for common auth/rate issues
    if (error.status === 403) {
      msg = '権限エラー(403): APIキーが正しくないか、モデルへのアクセス権がありません。';
    } else if (error.status === 404) {
      msg = 'モデルが見つかりません(404): 指定されたモデルが利用できない可能性があります。';
    } else if (error.status === 429) {
      msg = 'リクエスト上限(429): APIの利用制限に達しました。しばらく待って再試行してください。';
    } else if (error.message?.includes('API_KEY')) {
      msg = 'APIキーの設定エラー: 環境変数を確認してください。';
    }

    if (logCallback) {
      logCallback('error', source as any, msg);
    }
    throw error;
  }
}

// Deprecated: Use runGeminiRequest internal retry mechanism
export async function withRetry<T>(
  operation: () => Promise<T>,
  source: string,
  logCallback: LogCallback,
  maxRetries = 3,
): Promise<T> {
  return await operation();
}

export function trackUsage(
  response: GenerateContentResponse,
  model: string,
  source: string,
  callback?: UsageCallback,
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
    cached: cached,
  });
}

export function getSafetySettings() {
  return [
    {
      category: HarmCategory.HARM_CATEGORY_HARASSMENT,
      threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
    },
    {
      category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
      threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
    },
    {
      category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
      threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
    },
    {
      category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
      threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
    },
  ];
}
