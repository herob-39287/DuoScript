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
  const lastProcessedSignature = useRef<string | null>(null);

  useEffect(() => {
    projectDataRef.current = { meta, bible, chapters, sync };
  }, [meta, bible, chapters, sync]);

  useEffect(() => {
    const currentId = meta.id;
    if (!currentId) return;

    const chapterSignature = chapters
      .map((chapter) =>
        [
          chapter.id,
          chapter.updatedAt || 0,
          chapter.authoringMode || 'freeform',
          (chapter.draftText ?? '').length,
          (chapter.compiledContent ?? chapter.content ?? '').length,
          (chapter.scenePackages || []).length,
        ].join(':'),
      )
      .join('|');

    const bibleSignature = [
      bible.routes?.length ?? 0,
      bible.revealPlans?.length ?? 0,
      bible.stateAxes?.length ?? 0,
      bible.branchPolicies?.length ?? 0,
      bible.characters?.length ?? 0,
    ].join(':');
    const syncSignature = [
      sync.pendingChanges?.length ?? 0,
      sync.quarantine?.length ?? 0,
      sync.history?.length ?? 0,
      sync.chatHistory?.length ?? 0,
    ].join(':');
    const signature = `${meta.id}:${meta.updatedAt || 0}:${bibleSignature}:${syncSignature}:${chapterSignature}`;

    if (signature === lastProcessedSignature.current) return;

    const ragProject = {
      ...projectDataRef.current,
      chapters: projectDataRef.current.chapters.map((chapter) => {
        const mode = chapter.authoringMode || 'freeform';
        const text =
          mode === 'structured'
            ? chapter.compiledContent ?? chapter.content ?? ''
            : chapter.draftText ?? chapter.content ?? '';
        return {
          ...chapter,
          content: text,
        };
      }),
    };

    ragService
      .maintainIndex(ragProject as any, (msg) => {
        /* console.debug(`[RAG] ${msg}`); */
      })
      .catch((err) => console.error('[RAG] Indexing failed', err));

    lastProcessedSignature.current = signature;
  }, [meta.id, meta.updatedAt, chapters, bible, sync]);
};
