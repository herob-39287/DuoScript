import { useEffect, useRef } from 'react';
import { useMetadata, useBible, useManuscript, useNeuralSync } from '../contexts/StoryContext';
import { ragService } from '../services/ragService';

export const useRAG = () => {
  const meta = useMetadata();
  const bible = useBible();
  const chapters = useManuscript();
  const sync = useNeuralSync();

  // データの最新状態をRefで保持（useEffectの依存配列による過剰な再実行を防ぐため）
  const projectDataRef = useRef({ meta, bible, chapters, sync });
  const lastProcessedId = useRef<string | null>(null);

  useEffect(() => {
    projectDataRef.current = { meta, bible, chapters, sync };
  }, [meta, bible, chapters, sync]);

  useEffect(() => {
    const currentId = meta.id;
    if (!currentId) return;

    // プロジェクトIDが変更された場合（ロード/インポート時）に実行
    if (currentId !== lastProcessedId.current) {
      // console.log("[RAG] Project loaded. Indexing...");

      // 非同期でインデックス更新を実行
      ragService
        .maintainIndex(projectDataRef.current as any, (msg) => {
          /* console.debug(`[RAG] ${msg}`); */
        })
        .catch((err) => console.error('[RAG] Indexing failed', err));

      lastProcessedId.current = currentId;
    }
  }, [meta.id]); // ID変更のみをトリガーにする
};
