
import { useState, useEffect, useRef, useCallback } from 'react';
import { 
  useManuscript, useBible, useMetadata, 
  useManuscriptDispatch, useMetadataDispatch, useNotificationDispatch, useNeuralSync 
} from '../contexts/StoryContext';
import { loadChapterContent, saveChapterContent } from '../services/storageService';
import { getArchitectWhisper, identifyRelevantEntities } from '../services/geminiService';
import { ragService } from '../services/ragService';
import { WhisperAdvice } from '../types';

export const useManuscriptEditor = (initialChapterId: string, isProcessing: boolean = false) => {
  const chapters = useManuscript();
  const projectDispatch = useManuscriptDispatch();
  const bible = useBible();
  const sync = useNeuralSync();
  const meta = useMetadata();
  const metaDispatch = useMetadataDispatch();
  const { addLog } = useNotificationDispatch();

  const [activeChapterId, setActiveChapterId] = useState(initialChapterId);
  const [isLoadingContent, setIsLoadingContent] = useState(false);
  const [wordCount, setWordCount] = useState(0);
  const [whisper, setWhisper] = useState<WhisperAdvice | null>(null);
  const [isWhispering, setIsWhispering] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const syncTimeoutRef = useRef<number | null>(null);
  const librarianTimeoutRef = useRef<number | null>(null);
  const indexMaintenanceRef = useRef<number | null>(null);
  const lastWhisperTimeRef = useRef<number>(0);
  const draftVersionRef = useRef(0);

  const activeChapter = chapters.find(c => c.id === activeChapterId);

  useEffect(() => {
    if (activeChapter) {
      draftVersionRef.current = activeChapter.draftVersion || 0;
    }
  }, [activeChapterId]);

  useEffect(() => {
    const fetchContent = async () => {
      if (!activeChapterId || !meta.id) return;
      const chapter = chapters.find(c => c.id === activeChapterId);
      if (!chapter) return;
      
      if (chapter.content !== undefined && chapter.content !== null) {
        if (textareaRef.current) textareaRef.current.value = chapter.content;
        setWordCount(chapter.content.length);
        return;
      }

      setIsLoadingContent(true);
      try {
        const rev = meta.headRev || 1;
        const content = await loadChapterContent(meta.id, activeChapterId, rev) || "";
        projectDispatch({ type: 'SET_CHAPTER_CONTENT', id: activeChapterId, content });
        if (textareaRef.current) textareaRef.current.value = content;
        setWordCount(content.length);
      } catch (e) {
        addLog('error', 'System', '章の本文読み込みに失敗しました。');
      } finally {
        setIsLoadingContent(false);
      }
    };
    fetchContent();
  }, [activeChapterId, projectDispatch, addLog, meta.id, meta.headRev]);

  // Initial Index Maintenance on load
  useEffect(() => {
    if (meta.id) {
       ragService.maintainIndex({ meta, bible, chapters, sync } as any, (msg) => console.log(`[RAG] ${msg}`));
    }
  }, [meta.id]); // Run once on project load ideally, or when meta.id changes

  /**
   * Librarian (司書) の呼び出し: 文脈から関連設定を抽出
   */
  const triggerLibrarian = useCallback(async (text: string) => {
    if (!activeChapterId) return;
    try {
      const ids = await identifyRelevantEntities(
        text, 
        { meta, bible, chapters, sync } as any, 
        (u) => metaDispatch({ type: 'TRACK_USAGE', payload: u }), 
        () => {}
      );
      if (ids.length > 0) {
        projectDispatch({ type: 'UPDATE_CHAPTER', id: activeChapterId, updates: { relevantEntityIds: ids } });
      }
    } catch (e) {
      console.error("Librarian failed", e);
    }
  }, [activeChapterId, bible, meta, chapters, sync, projectDispatch, metaDispatch]);

  const triggerWhisper = useCallback(async () => {
    const text = textareaRef.current?.value || "";
    const currentVersion = draftVersionRef.current;
    
    if (text.length < 50) {
      addLog('info', 'Architect', '分析にはもう少し本文の長さが必要です。');
      return;
    }
    
    if (isWhispering || isProcessing || !activeChapterId) return;

    setIsWhispering(true);
    setWhisper(null);
    addLog('info', 'Architect', '設定との矛盾や伏線をスキャンしています...');
    
    try {
      const advice = await getArchitectWhisper(
        text.slice(-1500), 
        { meta, bible, chapters, sync } as any, 
        activeChapterId,
        (u) => metaDispatch({ type: 'TRACK_USAGE', payload: u }), 
        addLog
      );
      
      if (advice && !isProcessing && draftVersionRef.current === currentVersion) {
        setWhisper(advice);
        lastWhisperTimeRef.current = Date.now();
        addLog('success', 'Architect', '設計士の助言が届きました。');
      } else if (!advice) {
        addLog('success', 'Architect', '特に矛盾は見つかりませんでした。順調です。');
      }
    } catch (e) {
      console.warn("Whisper failed", e);
    } finally {
      setIsWhispering(false);
    }
  }, [bible, meta, chapters, sync, isWhispering, isProcessing, addLog, metaDispatch, activeChapterId]);

  const handleTextChange = useCallback(() => {
    if (!textareaRef.current || !activeChapterId || !meta.id) return;
    const currentVal = textareaRef.current.value;
    setWordCount(currentVal.length);
    
    draftVersionRef.current += 1;
    const currentVersion = draftVersionRef.current;

    // 自動保存
    if (syncTimeoutRef.current) window.clearTimeout(syncTimeoutRef.current);
    syncTimeoutRef.current = window.setTimeout(() => {
      projectDispatch({ type: 'UPDATE_CHAPTER', id: activeChapterId, updates: { content: currentVal, draftVersion: currentVersion } });
      saveChapterContent(meta.id, activeChapterId, meta.headRev || 1, currentVal);
    }, 1000);

    // 司書(Librarian)のバックグラウンド実行 (10秒おきに変更) & インデックス維持
    if (librarianTimeoutRef.current) window.clearTimeout(librarianTimeoutRef.current);
    librarianTimeoutRef.current = window.setTimeout(() => {
      // インデックスを更新してから検索（非同期で待たない）
      ragService.maintainIndex({ meta, bible, chapters, sync } as any).catch(console.error);
      triggerLibrarian(currentVal);
    }, 10000); // 頻度を落として負荷軽減

  }, [activeChapterId, projectDispatch, meta.id, meta.headRev, triggerLibrarian, bible, sync, chapters, meta]);

  return {
    activeChapter,
    activeChapterId,
    setActiveChapterId,
    isLoadingContent,
    wordCount,
    setWordCount,
    whisper,
    setWhisper,
    isWhispering,
    textareaRef,
    handleTextChange,
    triggerWhisper
  };
};
