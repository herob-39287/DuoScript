import { LogCallback } from '../../types';
import { AI_MODELS } from '../../constants';

export interface ExecutionConfig {
  maxRetries?: number;
  baseDelay?: number;
  source: string;
  logCallback: LogCallback;
}

const DEFAULT_CONFIG: ExecutionConfig = {
  maxRetries: 3,
  baseDelay: 1000,
  source: 'System',
  logCallback: () => {},
};

/**
 * AI応答のエラーを分類・判定する
 */
export const ErrorClassifier = {
  isSafetyBlock: (err: any) => {
    const msg = err.message || JSON.stringify(err);
    return msg.includes('SAFETY_BLOCK') || msg.includes('HARM_CATEGORY');
  },
  isAuthOrNotFoundError: (err: any) => {
    const msg = err.message || '';
    const status = err.status || err.error?.code;
    return (
      status === 403 ||
      status === 404 ||
      msg.includes('403') ||
      msg.includes('PERMISSION_DENIED') ||
      msg.includes('404') ||
      msg.includes('NOT_FOUND')
    );
  },
  isRetryable: (err: any) => {
    const msg = err.message || '';
    const status = err.status || err.error?.code;
    return (
      status === 429 ||
      (status >= 500 && status < 600) ||
      msg.includes('429') ||
      msg.includes('network error') ||
      msg.includes('fetch failed') ||
      msg.includes('JSON Parse') || // 構造エラーも一時的な生成不良としてリトライ対象にする
      msg.includes('Schema Validation')
    );
  },
};

/**
 * 汎用的なリトライ付き実行関数
 */
export async function executeWithRetry<T>(
  operation: (attempt: number) => Promise<T>,
  config: Partial<ExecutionConfig>,
): Promise<T> {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  let lastError: any = null;

  for (let attempt = 1; attempt <= finalConfig.maxRetries!; attempt++) {
    try {
      return await operation(attempt);
    } catch (error: any) {
      lastError = error;

      if (ErrorClassifier.isSafetyBlock(error)) {
        throw error; // 安全性ブロックは即時中断
      }

      if (attempt >= finalConfig.maxRetries!) {
        break; // リトライ上限
      }

      if (ErrorClassifier.isRetryable(error)) {
        const delay = Math.pow(2, attempt - 1) * finalConfig.baseDelay!;

        // JSON/Schemaエラーの場合はログレベルを下げる
        const isValidation = error.message?.includes('JSON') || error.message?.includes('Schema');
        const logLevel = isValidation ? 'info' : 'info'; // 両方infoで通知

        finalConfig.logCallback(
          logLevel,
          finalConfig.source as any,
          `再試行します (${attempt}/${finalConfig.maxRetries}): ${isValidation ? '形式不正' : '通信エラー'}`,
        );

        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }

      throw error; // リトライ不可エラー
    }
  }

  throw lastError;
}

/**
 * モデルのフォールバックロジックを含む実行関数
 * Proモデルで権限エラー等が出た場合、Flashモデルで再試行する
 */
export async function executeWithFallback<T>(
  primaryOp: (attempt: number) => Promise<T>,
  fallbackOp: (attempt: number) => Promise<T>,
  config: ExecutionConfig,
): Promise<T> {
  try {
    return await executeWithRetry(primaryOp, config);
  } catch (error: any) {
    if (ErrorClassifier.isAuthOrNotFoundError(error)) {
      config.logCallback(
        'info',
        config.source as any,
        `モデルへのアクセス権がないため、高速モデル(${AI_MODELS.FAST})に切り替えます。`,
      );
      // フォールバック時はリトライカウントをリセットして実行
      return await executeWithRetry(fallbackOp, config);
    }
    throw error;
  }
}
