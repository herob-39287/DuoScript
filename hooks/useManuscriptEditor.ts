
import { useState, useEffect, useRef, useCallback } from 'react';
import { 
  useManuscript, useBible, useMetadata, 
  useManuscriptDispatch, useMetadataDispatch, useNotificationDispatch, useNeuralSync 
} from '../contexts/StoryContext';
import { loadChapterContent, saveChapterContent } from '../services/storageService';
import { getArchitectWhisper } from '../services/geminiService';

export const useManuscriptEditor = (initialChapterId: string) => {
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
  const [whisper, setWhisper] = useState<{ text: string; type: 'info' | 'alert' } | null>(null);
  const [isWhispering, setIsWhispering] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const syncTimeoutRef = useRef<number | null>(null);
  const whisperTimeoutRef = useRef<number | null>(null);

  const activeChapter = chapters.find(c => c.id === activeChapterId);

  // Load content when chapter changes
  useEffect(() => {
    const fetchContent = async () => {
      if (!activeChapterId) return;
      const chapter = chapters.find(c => c.id === activeChapterId);
      if (!chapter) return;
      
      setIsLoadingContent(true);
      try {
        const content = chapter.content !== undefined ? chapter.content : (await loadChapterContent(activeChapterId) || "");
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
  }, [activeChapterId, projectDispatch, addLog]);

  const triggerWhisper = useCallback(async (text: string) => {
    if (text.length < 100 || isWhispering) return;
    setIsWhispering(true);
    try {
      const advice = await getArchitectWhisper(
        text.slice(-1000), 
        { meta, bible, chapters, sync } as any, 
        (u) => metaDispatch({ type: 'TRACK_USAGE', payload: u }), 
        addLog
      );
      if (advice) setWhisper(advice);
    } catch (e) {
      console.warn("Whisper failed", e);
    } finally {
      setIsWhispering(false);
    }
  }, [bible, meta, chapters, sync, isWhispering, addLog, metaDispatch]);

  const handleTextChange = useCallback(() => {
    if (!textareaRef.current || !activeChapterId) return;
    const currentVal = textareaRef.current.value;
    setWordCount(currentVal.length);
    
    if (syncTimeoutRef.current) window.clearTimeout(syncTimeoutRef.current);
    syncTimeoutRef.current = window.setTimeout(() => {
      projectDispatch({ type: 'SET_CHAPTER_CONTENT', id: activeChapterId, content: currentVal });
      saveChapterContent(activeChapterId, currentVal);
    }, 1000);

    if (whisperTimeoutRef.current) window.clearTimeout(whisperTimeoutRef.current);
    whisperTimeoutRef.current = window.setTimeout(() => triggerWhisper(currentVal), 15000);
  }, [activeChapterId, projectDispatch, triggerWhisper]);

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
    handleTextChange
  };
};
