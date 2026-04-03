import { useState, useEffect, useRef, useCallback } from 'react';
import {
  useManuscript,
  useMetadata,
  useManuscriptDispatch,
  useNotificationDispatch,
} from '../contexts/StoryContext';
import { ChapterLog } from '../types';
import { loadChapterBody } from '../services/storageService';
import * as Actions from '../store/actions';

interface UseManuscriptEditorProps {
  initialChapterId: string;
  onContentUpdate?: (content: string) => void;
}

export const useManuscriptEditor = ({
  initialChapterId,
  onContentUpdate,
}: UseManuscriptEditorProps) => {
  const chapters = useManuscript();
  const projectDispatch = useManuscriptDispatch();
  const meta = useMetadata();
  const { addLog } = useNotificationDispatch();

  const [activeChapterId, setActiveChapterId] = useState(initialChapterId);
  const [isLoadingContent, setIsLoadingContent] = useState(false);
  const [wordCount, setWordCount] = useState(0);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const syncTimeoutRef = useRef<number | null>(null);
  const wordCountThrottleRef = useRef<number | null>(null);
  const draftVersionRef = useRef(0);

  const activeChapter = chapters.find((c) => c.id === activeChapterId);
  const getEditorText = (chapter: ChapterLog): string => {
    if ((chapter.authoringMode || 'freeform') === 'structured') {
      return chapter.compiledContent ?? chapter.content ?? '';
    }
    return chapter.draftText ?? chapter.content ?? '';
  };

  // Auto-select first chapter if activeChapterId is invalid
  useEffect(() => {
    if (chapters.length > 0) {
      const isValid = chapters.some((c) => c.id === activeChapterId);
      if (!activeChapterId || !isValid) {
        setActiveChapterId(chapters[0].id);
      }
    }
  }, [chapters, activeChapterId]);

  useEffect(() => {
    if (activeChapter) {
      draftVersionRef.current = activeChapter.draftVersion || 0;
    }
  }, [activeChapterId, activeChapter]);

  useEffect(() => {
    const fetchContent = async () => {
      if (!activeChapterId || !meta.id) return;
      const chapter = chapters.find((c) => c.id === activeChapterId);
      if (!chapter) return;

      const hasInMemoryText =
        chapter.draftText !== undefined ||
        chapter.compiledContent !== undefined ||
        chapter.content !== undefined;
      const inMemoryText = getEditorText(chapter);
      if (hasInMemoryText) {
        if (textareaRef.current) textareaRef.current.value = inMemoryText;
        setWordCount(inMemoryText.length);
        return;
      }

      setIsLoadingContent(true);
      try {
        const rev = meta.headRev || 1;
        const body = await loadChapterBody(meta.id, activeChapterId, rev);
        const mode = chapter.authoringMode || 'freeform';
        const draftText = body?.draftText ?? chapter.draftText ?? chapter.content ?? '';
        const compiledContent = body?.compiledContent ?? chapter.compiledContent ?? chapter.content ?? '';
        projectDispatch(
          Actions.updateChapter(activeChapterId, {
            authoringMode: mode,
            draftText,
            compiledContent,
          }),
        );
        const text = mode === 'structured' ? compiledContent : draftText;
        if (textareaRef.current) textareaRef.current.value = text;
        setWordCount(text.length);
      } catch (e) {
        addLog('error', 'System', '章の本文読み込みに失敗しました。');
      } finally {
        setIsLoadingContent(false);
      }
    };
    fetchContent();
  }, [activeChapterId, projectDispatch, addLog, meta.id, meta.headRev]);

  const handleTextChange = useCallback(() => {
    if (!textareaRef.current || !activeChapterId || !meta.id) return;
    if (!activeChapter) return;
    const currentVal = textareaRef.current.value;
    if ((activeChapter.authoringMode || 'freeform') === 'structured') {
      return;
    }

    // 文字数の更新頻度を抑制
    if (!wordCountThrottleRef.current) {
      setWordCount(currentVal.length);
      wordCountThrottleRef.current = window.setTimeout(() => {
        if (textareaRef.current) setWordCount(textareaRef.current.value.length);
        wordCountThrottleRef.current = null;
      }, 1000);
    }

    draftVersionRef.current += 1;
    const currentVersion = draftVersionRef.current;

    // 自動保存 (State更新) のデバウンス
    if (syncTimeoutRef.current) window.clearTimeout(syncTimeoutRef.current);
    syncTimeoutRef.current = window.setTimeout(() => {
      setWordCount(currentVal.length);
      projectDispatch({
        type: 'SET_CHAPTER_DRAFT_TEXT',
        id: activeChapterId,
        draftText: currentVal,
      });
      projectDispatch({
        type: 'UPDATE_CHAPTER',
        id: activeChapterId,
        updates: { draftVersion: currentVersion },
      });
    }, 1000);

    // 通知
    if (onContentUpdate) {
      onContentUpdate(currentVal);
    }
  }, [activeChapterId, activeChapter, projectDispatch, meta.id, meta.headRev, onContentUpdate]);

  return {
    activeChapter,
    activeChapterId,
    setActiveChapterId,
    isLoadingContent,
    wordCount,
    setWordCount,
    draftVersionRef,
    textareaRef,
    handleTextChange,
  };
};
