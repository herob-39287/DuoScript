import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  generateDraftStream,
  suggestNextSentence,
  generateFullChapterPackage,
  generateSharedSpineStage,
  generateVariantStage,
  generateConvergenceStage,
  getSafetyAlternatives,
  scanDraftAppSettings,
  getArchitectWhisper,
  identifyRelevantEntities,
} from '../services/geminiService';
import * as Actions from '../store/actions';
import {
  useManuscriptDispatch,
  useMetadataDispatch,
  useNotificationDispatch,
  useUIDispatch,
  useManuscript,
  useUI,
  useBible,
  useMetadata,
  useNeuralSync,
  useNeuralSyncDispatch,
} from '../contexts/StoryContext';
import { StoryProject, PlotBeat, WhisperAdvice } from '../types';

interface UseWriterAIProps {
  activeChapterId: string;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  setWordCount: (count: number) => void;
  draftVersionRef: React.MutableRefObject<number>;
}

export const useWriterAI = ({
  activeChapterId,
  textareaRef,
  setWordCount,
  draftVersionRef,
}: UseWriterAIProps) => {
  // Contexts
  const meta = useMetadata();
  const bible = useBible();
  const chapters = useManuscript();
  const sync = useNeuralSync();
  const ui = useUI();

  const projectDispatch = useManuscriptDispatch();
  const metaDispatch = useMetadataDispatch();
  const uiDispatch = useUIDispatch();
  const syncDispatch = useNeuralSyncDispatch();
  const { addLog } = useNotificationDispatch();

  const projectRef = useRef<StoryProject>({ meta, bible, chapters, sync });

  useEffect(() => {
    projectRef.current = { meta, bible, chapters, sync };
  }, [meta, bible, chapters, sync]);

  // States
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingBeatId, setProcessingBeatId] = useState<string | null>(null);
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [isWhispering, setIsWhispering] = useState(false);
  const [whisper, setWhisper] = useState<WhisperAdvice | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);

  // Internal Refs
  const librarianTimeoutRef = useRef<number | null>(null);

  const getResolvedChapter = (project: StoryProject) => {
    let chapter = project.chapters.find((c) => c.id === activeChapterId);
    if (!chapter && project.chapters.length > 0) {
      chapter = project.chapters[0];
    }
    return chapter;
  };

  /**
   * Librarian: Identifies relevant entities from the text and updates the context.
   */
  const triggerLibrarian = useCallback(
    async (text: string) => {
      if (!activeChapterId) return;
      try {
        const ids = await identifyRelevantEntities(
          text,
          projectRef.current,
          (u) => metaDispatch(Actions.trackUsage(u)),
          () => {},
        );
        if (ids.length > 0) {
          projectDispatch({
            type: 'UPDATE_CHAPTER',
            id: activeChapterId,
            updates: { relevantEntityIds: ids },
          });
        }
      } catch (e) {
        console.error('Librarian failed', e);
      }
    },
    [activeChapterId, projectDispatch, metaDispatch],
  );

  /**
   * Whisper: Scans text for contradictions.
   */
  const triggerWhisper = useCallback(async () => {
    const text = textareaRef.current?.value || '';
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
        projectRef.current,
        activeChapterId,
        (u) => metaDispatch(Actions.trackUsage(u)),
        addLog,
      );

      if (advice && !isProcessing && draftVersionRef.current === currentVersion) {
        setWhisper(advice);
        addLog('success', 'Architect', '設計士の助言が届きました。');
      } else if (!advice) {
        addLog('success', 'Architect', '特に矛盾は見つかりませんでした。順調です。');
      }
    } catch (e) {
      console.warn('Whisper failed', e);
    } finally {
      setIsWhispering(false);
    }
  }, [
    isWhispering,
    isProcessing,
    activeChapterId,
    draftVersionRef,
    addLog,
    metaDispatch,
    textareaRef,
  ]);

  /**
   * Analyze Content Change: Debounced calls to Librarian
   */
  const analyzeContext = useCallback(
    (content: string) => {
      if (librarianTimeoutRef.current) window.clearTimeout(librarianTimeoutRef.current);
      librarianTimeoutRef.current = window.setTimeout(() => {
        triggerLibrarian(content);
      }, 10000);
    },
    [triggerLibrarian],
  );

  /**
   * AI Action: Generate Plot Package
   */
  const generatePackage = useCallback(async () => {
    const project = projectRef.current;
    const activeChapter = getResolvedChapter(project);

    if (!activeChapter || isProcessing) {
      if (!activeChapter) addLog('error', 'Writer', '章データが見つかりません。');
      return;
    }

    setIsProcessing(true);
    uiDispatch(Actions.setThinkingPhase('Designing Plot Beats...'));
    addLog('info', 'Writer', `${activeChapter.title} の展開を設計中...`);

    try {
      const res = await generateFullChapterPackage(
        project,
        activeChapter,
        (u) => metaDispatch(Actions.trackUsage(u)),
        addLog,
      );

      projectDispatch(
        Actions.updateChapter(activeChapter.id, {
          beats: res.beats.map((b: any) => ({ id: crypto.randomUUID(), text: b.text })),
          strategy: { ...activeChapter.strategy, milestones: res.strategy.milestones },
        }),
      );

      addLog('success', 'Writer', '章のプロット構成が完了しました。');
    } catch (e: any) {
      addLog('error', 'Writer', '設計パッケージの生成に失敗しました。');
    } finally {
      setIsProcessing(false);
      uiDispatch(Actions.setThinkingPhase(null));
    }
  }, [isProcessing, uiDispatch, metaDispatch, projectDispatch, addLog]);

  /**
   * AI Action: Copilot Suggestion
   */
  const suggestNext = useCallback(async () => {
    const text = textareaRef.current?.value || '';
    if (text.length < 20 || isSuggesting) return;

    const project = projectRef.current;
    const activeChapter = getResolvedChapter(project);

    if (!activeChapter) {
      addLog('error', 'Writer', '章データが見つかりません。');
      return;
    }

    setIsSuggesting(true);
    uiDispatch(Actions.setThinkingPhase('Generating Suggestions...'));

    try {
      const res = await suggestNextSentence(
        text.slice(-1000),
        project,
        activeChapter.id,
        (u) => metaDispatch(Actions.trackUsage(u)),
        addLog,
        ui.isContextActive,
      );
      setSuggestions(res);
    } catch (e: any) {
      addLog('error', 'Writer', '続きの提案に失敗しました。');
    } finally {
      setIsSuggesting(false);
      uiDispatch(Actions.setThinkingPhase(null));
    }
  }, [isSuggesting, textareaRef, ui.isContextActive, uiDispatch, metaDispatch, addLog]);

  /**
   * AI Action: Apply Suggestion
   */
  const applySuggestion = useCallback(
    (text: string) => {
      if (!textareaRef.current) return;
      const textarea = textareaRef.current;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const currentVal = textarea.value;
      const nextVal = currentVal.substring(0, start) + text + currentVal.substring(end);

      textarea.value = nextVal;

      const newCursorPos = start + text.length;
      textarea.setSelectionRange(newCursorPos, newCursorPos);
      textarea.focus();

      setSuggestions([]);
      // Trigger update in Editor via callback? No, Editor owns state.
      // We need to notify Editor to update state.
      // Since we don't have direct setter for editor state here,
      // we assume the parent component will handle the state update event from textarea or we fire event.
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
    },
    [textareaRef],
  );

  /**
   * AI Action: Draft Scanning
   */
  const scanDraft = useCallback(async () => {
    const text = textareaRef.current?.value || '';
    if (text.length < 50 || isScanning) {
      if (text.length < 50)
        addLog('info', 'Writer', '抽出を行うにはもう少し本文の長さが必要です。');
      return;
    }

    const project = projectRef.current;
    const activeChapter = getResolvedChapter(project);
    if (!activeChapter) return;

    setIsScanning(true);
    uiDispatch(Actions.setThinkingPhase('Scanning Draft for Settings...'));
    addLog('info', 'Writer', 'ドラフトから設定を抽出中...');

    try {
      const res = await scanDraftAppSettings(
        text,
        project,
        activeChapter.id,
        (u) => metaDispatch(Actions.trackUsage(u)),
        addLog,
      );

      if (res.readyOps.length > 0) {
        syncDispatch(Actions.addPendingOps(res.readyOps));
        addLog('success', 'NeuralSync', `${res.readyOps.length}件の設定変更を抽出しました。`);
      } else {
        addLog('success', 'NeuralSync', '新しい設定変更は見つかりませんでした。');
      }
    } catch (e: any) {
      addLog('error', 'Writer', '設定抽出に失敗しました。');
    } finally {
      setIsScanning(false);
      uiDispatch(Actions.setThinkingPhase(null));
    }
  }, [isScanning, textareaRef, uiDispatch, addLog, syncDispatch, metaDispatch]);

  /**
   * AI Action: Streaming Draft
   */
  const streamDraft = useCallback(
    async (targetBeat?: PlotBeat) => {
      const project = projectRef.current;
      const activeChapter = getResolvedChapter(project);

      if (isProcessing || !activeChapter) {
        if (!activeChapter) addLog('error', 'Writer', 'アクティブな章が見つかりません。');
        return;
      }

      setIsProcessing(true);
      if (targetBeat) setProcessingBeatId(targetBeat.id);

      const targetBeats = targetBeat ? [targetBeat.text] : undefined;
      uiDispatch(Actions.setThinkingPhase(targetBeat ? 'Drafting Scene...' : 'Drafting Story...'));
      addLog('info', 'Writer', targetBeat ? 'シーンを執筆しています...' : '物語を紡いでいます...');

      let fullText = textareaRef.current?.value || '';
      const lastChunk = fullText.slice(-1500);

      if (fullText.length > 0 && !fullText.endsWith('\n')) fullText += '\n';

      try {
        const stream = generateDraftStream(
          activeChapter,
          project.bible.tone,
          true,
          project,
          lastChunk,
          targetBeats,
          addLog,
          ui.isContextActive,
          (u) => metaDispatch(Actions.trackUsage(u)),
        );

        for await (const chunk of stream) {
          uiDispatch(Actions.setThinkingPhase(null));
          const text = chunk.text || '';
          fullText += text;
          if (textareaRef.current) {
            textareaRef.current.value = fullText;
            textareaRef.current.scrollTop = textareaRef.current.scrollHeight;
            textareaRef.current.dispatchEvent(new Event('input', { bubbles: true }));
          }
          setWordCount(fullText.length);
        }
        addLog('success', 'Writer', '執筆が完了しました。');
      } catch (e: any) {
        if (e.message?.includes('SAFETY_BLOCK')) {
          const category = e.message.split(':')[1] || 'UNKNOWN';
          addLog('error', 'Safety', '安全ガイドラインにより生成が中断されました。');
          uiDispatch(Actions.setThinkingPhase('Consulting Safety Guide...'));
          try {
            const alternatives = await getSafetyAlternatives(
              lastChunk || activeChapter.summary,
              category,
              addLog,
            );
            uiDispatch(
              Actions.setSafetyIntervention({
                isOpen: true,
                alternatives,
                category,
                isLocked: false,
              }),
            );
          } catch (subError) {
            addLog('error', 'Safety', '代替案の生成に失敗しました。');
          }
        } else {
          addLog('error', 'Writer', '執筆中にエラーが発生しました。');
        }
      } finally {
        setIsProcessing(false);
        setProcessingBeatId(null);
        uiDispatch(Actions.setThinkingPhase(null));
      }
    },
    [isProcessing, textareaRef, ui.isContextActive, uiDispatch, addLog, setWordCount, metaDispatch],
  );

  const generateThreeStageDraft = useCallback(async () => {
    const project = projectRef.current;
    const activeChapter = getResolvedChapter(project);
    if (!activeChapter || isProcessing) return;

    setIsProcessing(true);
    uiDispatch(Actions.setThinkingPhase('Stage1: Shared Spine...'));

    try {
      const stage1 = await generateSharedSpineStage(
        project,
        activeChapter,
        (u) => metaDispatch(Actions.trackUsage(u)),
        addLog,
      );

      const baseScenePackages = (activeChapter.scenePackages || []).map((scenePackage) => {
        const next = stage1.scenePackages.find((s) => s.sceneId === scenePackage.sceneId);
        return next
          ? {
              ...scenePackage,
              purpose: next.purpose,
              mandatoryInfo: next.mandatoryInfo,
              sharedSpine: next.sharedSpine,
            }
          : scenePackage;
      });

      uiDispatch(Actions.setThinkingPhase('Stage2: Variants...'));
      const stage2 = await generateVariantStage(
        project,
        { ...activeChapter, scenePackages: baseScenePackages },
        baseScenePackages,
        (u) => metaDispatch(Actions.trackUsage(u)),
        addLog,
      );

      const withVariants = baseScenePackages.map((scenePackage) => {
        const next = stage2.scenePackages.find((s) => s.sceneId === scenePackage.sceneId);
        return next
          ? {
              ...scenePackage,
              choicePoints: next.choicePoints,
              reactionVariants: next.reactionVariants,
              carryoverStateChanges: next.carryoverStateChanges,
            }
          : scenePackage;
      });

      uiDispatch(Actions.setThinkingPhase('Stage3: Convergence & Polish...'));
      const stage3 = await generateConvergenceStage(
        project,
        { ...activeChapter, scenePackages: withVariants },
        withVariants,
        (u) => metaDispatch(Actions.trackUsage(u)),
        addLog,
      );

      const polishedPackages = withVariants.map((scenePackage) => {
        const next = stage3.scenePackages.find((s) => s.sceneId === scenePackage.sceneId);
        return next?.convergencePoint
          ? { ...scenePackage, convergencePoint: next.convergencePoint }
          : scenePackage;
      });

      const nextContent = stage3.content || textareaRef.current?.value || '';
      projectDispatch(
        Actions.updateChapter(activeChapter.id, {
          scenePackages: polishedPackages,
          content: nextContent,
        }),
      );
      if (textareaRef.current) textareaRef.current.value = nextContent;
      setWordCount(nextContent.length);
      addLog('success', 'Writer', '3段階生成が完了しました。');
    } catch (e) {
      addLog('error', 'Writer', '3段階生成に失敗しました。');
    } finally {
      setIsProcessing(false);
      uiDispatch(Actions.setThinkingPhase(null));
    }
  }, [isProcessing, uiDispatch, metaDispatch, addLog, projectDispatch, textareaRef, setWordCount]);

  return {
    isProcessing,
    processingBeatId,
    isSuggesting,
    isScanning,
    isWhispering,
    whisper,
    setWhisper,
    suggestions,
    setSuggestions,
    generatePackage,
    suggestNext,
    applySuggestion,
    streamDraft,
    generateThreeStageDraft,
    scanDraft,
    triggerWhisper,
    analyzeContext,
  };
};
