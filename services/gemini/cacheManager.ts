import { StoryProject, LogCallback } from '../../types';
import { GeminiClient } from './core';
import { PromptBuilder } from './promptBuilder';
import { AI_MODELS } from '../../constants';

interface CacheEntry {
  name: string;
  projectId: string;
  version: number;
  expiresAt: number;
}

/**
 * Manages Gemini Context Caching lifecycle for the Architect.
 */
export class CacheManager {
  private client: GeminiClient;
  private activeCache: CacheEntry | null = null;
  // Cache TTL in seconds (e.g., 60 minutes).
  private readonly TTL_SECONDS = 3600;
  // The model compatible with the cache (must match generation model)
  private readonly MODEL_NAME = AI_MODELS.REASONING;

  constructor(client: GeminiClient) {
    this.client = client;
  }

  /**
   * Retrieves an active cache name or creates a new one if stale/missing.
   */
  async getArchitectCache(project: StoryProject, logCallback: LogCallback): Promise<string> {
    const projectId = project.meta.id;
    const currentVersion = project.bible.version;
    const now = Date.now();

    // 1. Check in-memory validity
    if (
      this.activeCache &&
      this.activeCache.projectId === projectId &&
      this.activeCache.version === currentVersion &&
      this.activeCache.expiresAt > now
    ) {
      return this.activeCache.name;
    }

    // 2. Invalidate old cache if exists (Best effort)
    if (this.activeCache) {
      try {
        logCallback(
          'info',
          'System',
          '設定が更新されたため、コンテキスト・キャッシュを再構築します。',
        );
        await this.client.genAI.caches.delete({ name: this.activeCache.name });
      } catch (e) {
        console.warn('Failed to delete old cache', e);
      }
      this.activeCache = null;
    } else {
      logCallback('info', 'System', '物語設定(Bible)をクラウドにキャッシュしています...');
    }

    // 3. Create new cache
    try {
      const systemContent = PromptBuilder.buildStaticArchitectContext(project);

      const cacheResponse = await this.client.genAI.caches.create({
        model: this.MODEL_NAME,
        config: {
          contents: [{ role: 'user', parts: [{ text: systemContent }] }],
          displayName: `duoscript-${projectId.slice(0, 8)}-v${currentVersion}`,
          ttl: `${this.TTL_SECONDS}s`,
        },
      });

      if (!cacheResponse.name) {
        throw new Error('Cache response missing name.');
      }

      this.activeCache = {
        name: cacheResponse.name,
        projectId: projectId,
        version: currentVersion,
        expiresAt: now + this.TTL_SECONDS * 1000,
      };

      logCallback('success', 'System', 'コンテキスト・キャッシュが有効化されました。');
      return this.activeCache.name;
    } catch (e: any) {
      logCallback('error', 'System', `キャッシュ作成失敗: ${e.message}`);
      throw e;
    }
  }

  /**
   * Explicitly clears the cache (e.g. on project close)
   */
  async clearCache() {
    if (this.activeCache) {
      try {
        await this.client.genAI.caches.delete({ name: this.activeCache.name });
        this.activeCache = null;
      } catch (e) {
        console.warn('Failed to clear cache', e);
      }
    }
  }
}
