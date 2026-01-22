
import { StoryProject } from "../types";

export interface SearchResult {
  id: string;
  name: string;
  type: string;
  score: number;
  reason: 'Exact' | 'Fuzzy' | 'Semantic';
}

class RAGServiceProxy {
  private worker: Worker;
  private pendingRequests = new Map<string, { resolve: (val: any) => void; reject: (err: any) => void }>();
  private logCallback: ((msg: string) => void) | null = null;

  constructor() {
    // Fix: Use window.location.origin as base to avoid "Invalid URL" error if import.meta.url is undefined
    const workerUrl = new URL('/workers/rag.worker.ts', window.location.origin);
    this.worker = new Worker(workerUrl, { type: 'module' });
    
    // Pass API Key securely to worker
    this.worker.postMessage({ type: 'INIT', payload: { apiKey: process.env.API_KEY } });

    this.worker.onmessage = (e) => {
      const { id, type, payload } = e.data;

      if (type === 'LOG') {
        if (this.logCallback) this.logCallback(payload);
        return;
      }

      if (id && this.pendingRequests.has(id)) {
        const { resolve, reject } = this.pendingRequests.get(id)!;
        if (type === 'ERROR') reject(new Error(payload));
        else resolve(payload);
        this.pendingRequests.delete(id);
      }
    };
  }

  private request<T>(type: string, payload: any): Promise<T> {
    const id = crypto.randomUUID();
    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject });
      this.worker.postMessage({ id, type, payload });
    });
  }

  /**
   * Worker用にプロジェクトデータを軽量化する
   * 画像データ(Base64)や原稿本文、履歴などを除外
   */
  private minifyProject(project: StoryProject) {
    return {
      meta: {
        id: project.meta.id,
        updatedAt: project.meta.updatedAt
      },
      bible: {
        ...project.bible,
        // キャラクターの画像データと履歴を除外
        characters: project.bible.characters.map(({ imageUrl, history, ...rest }) => rest),
        // アイテム履歴を除外
        keyItems: project.bible.keyItems.map(({ history, ...rest }) => rest)
      }
      // chapters, sync, assets はRAGインデックス作成には不要なため送信しない
    };
  }

  /**
   * インデックスの整合性を維持する (Web Worker)
   */
  async maintainIndex(project: StoryProject, logCallback?: (msg: string) => void): Promise<void> {
    this.logCallback = logCallback || null;
    try {
      const payload = this.minifyProject(project);
      await this.request('MAINTAIN', { project: payload });
    } finally {
      this.logCallback = null;
    }
  }

  /**
   * ハイブリッド検索 (Web Worker)
   */
  async hybridSearch(query: string, project: StoryProject, limit: number = 20): Promise<SearchResult[]> {
    const payload = this.minifyProject(project);
    return this.request<SearchResult[]>('SEARCH', { query, project: payload, limit });
  }
}

export const ragService = new RAGServiceProxy();
