
import React, { useState, useMemo } from 'react';
import { generateDraftStream, suggestNextSentence, generateFullChapterPackage } from '../services/geminiService';
import { 
  useManuscript, useBible, useUI, useMetadata, 
  useManuscriptDispatch, useMetadataDispatch, useNotificationDispatch, 
  useUIDispatch, useNeuralSync 
} from '../contexts/StoryContext';
import * as Actions from '../store/actions';
import { Brain } from 'lucide-react';
import { ViewMode } from '../types';
import { useManuscriptEditor } from '../hooks/useManuscriptEditor';

// Sub-components
import { EditorCanvas } from './writer/EditorCanvas';
import { WriterHeader } from './writer/WriterHeader';
import { ChapterNavigation } from './writer/ChapterNavigation';
import { PlotReference } from './writer/PlotReference';
import { WriterToolbar } from './writer/WriterToolbar';
import { SuggestionOverlay } from './writer/SuggestionOverlay';

const WriterView: React.FC = () => {
  const chapters = useManuscript();
  const projectDispatch = useManuscriptDispatch();
  const bible = useBible();
  const meta = useMetadata();
  const metaDispatch = useMetadataDispatch();
  const { addLog } = useNotificationDispatch();
  const uiDispatch = useUIDispatch();
  const sync = useNeuralSync();
  const ui = useUI();

  const project = useMemo(() => ({ meta, bible, chapters, sync }), [meta, bible, chapters, sync]);

  const [isProcessing, setIsProcessing] = useState(false);
  const [isZenMode, setIsZenMode] = useState(false);
  const [isVertical, setIsVertical] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isSuggesting, setIsSuggesting] = useState(false);

  const {
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
  } = useManuscriptEditor(chapters[0]?.id || '', isProcessing);

  const handleGeneratePackage = async () => {
    if (!activeChapter || isProcessing) return;
    setIsProcessing(true);
    setIsThinking(true);
    addLog('info', 'Writer', `${activeChapter.title} の展開を設計中...`);
    try {
      const res = await generateFullChapterPackage(project as any, activeChapter, (u) => metaDispatch(Actions.trackUsage(u)), addLog);
      projectDispatch(Actions.updateChapter(activeChapterId, {
        beats: res.beats.map((b: any) => ({ id: crypto.randomUUID(), text: b.text })),
        strategy: { ...activeChapter.strategy, milestones: res.strategy.milestones }
      }));
      addLog('success', 'Writer', '章のプロット構成が完了しました。執筆の準備が整いました。');
    } catch (e) {
      addLog('error', 'Writer', '設計パッケージの生成に失敗しました。');
    } finally {
      setIsProcessing(false);
      setIsThinking(false);
    }
  };

  const handleSuggest = async () => {
    const text = textareaRef.current?.value || "";
    if (text.length < 20 || isSuggesting) return;
    setIsSuggesting(true);
    setIsThinking(true);
    try {
      const res = await suggestNextSentence(text.slice(-1000), project as any, activeChapterId, (u) => metaDispatch(Actions.trackUsage(u)), addLog, ui.isContextActive);
      setSuggestions(res);
    } catch (e) {
      addLog('error', 'Writer', '続きの提案に失敗しました。');
    } finally {
      setIsSuggesting(false);
      setIsThinking(false);
    }
  };

  const applySuggestion = (text: string) => {
    if (!textareaRef.current) return;
    const current = textareaRef.current.value;
    const next = current.endsWith(' ') || current.endsWith('\n') ? current + text : current + " " + text;
    textareaRef.current.value = next;
    handleTextChange();
    setSuggestions([]);
  };

  const handleStreamDraft = async () => {
    if (!activeChapter || isProcessing) return;
    setIsProcessing(true);
    setIsThinking(true);
    addLog('info', 'Writer', '物語を紡いでいます...');
    
    let fullText = textareaRef.current?.value || "";
    if (fullText.length > 0) fullText += "\n\n";

    try {
      const stream = generateDraftStream(activeChapter, bible.tone, true, project as any, addLog, ui.isContextActive);
      for await (const chunk of stream) {
        const text = chunk.text || "";
        fullText += text;
        if (textareaRef.current) {
          textareaRef.current.value = fullText;
          textareaRef.current.scrollTop = textareaRef.current.scrollHeight;
        }
        setWordCount(fullText.length);
      }
      handleTextChange();
      addLog('success', 'Writer', '執筆が完了しました。');
    } catch (e: any) {
      if (e.message?.includes("SAFETY_BLOCK")) {
        addLog('error', 'Safety', '内容に不適切な表現が含まれる可能性があるため、生成が中断されました。');
      } else {
        addLog('error', 'Writer', '執筆中にエラーが発生しました。');
      }
    } finally {
      setIsProcessing(false);
      setIsThinking(false);
    }
  };

  return (
    <div className={`h-full flex flex-col transition-all duration-700 bg-stone-900 ${isZenMode ? 'bg-stone-950' : ''}`}>
      {!isZenMode && (
        <WriterHeader
          activeChapter={activeChapter}
          wordCount={wordCount}
          isVertical={isVertical}
          onToggleVertical={() => setIsVertical(!isVertical)}
          onToggleZen={() => setIsZenMode(true)}
          onNavigateBack={() => uiDispatch(Actions.setView(ViewMode.DASHBOARD))}
        />
      )}

      <div className="flex-1 flex overflow-hidden relative h-full">
        {!isZenMode && (
          <ChapterNavigation 
            chapters={chapters}
            activeChapterId={activeChapterId}
            onSelectChapter={setActiveChapterId}
            onAddChapter={() => projectDispatch(Actions.addChapter({ id: crypto.randomUUID(), title: `第${chapters.length + 1}章`, summary: '', scenes: [], beats: [], strategy: { milestones: [], forbiddenResolutions: [], characterArcProgress: '', pacing: '' }, status: 'Idea', wordCount: 0, draftVersion: 0, updatedAt: Date.now(), involvedCharacterIds: [] }))}
          />
        )}

        <main className={`flex-1 relative flex flex-col overflow-hidden items-center ${isZenMode ? 'pt-12 md:pt-24' : ''}`}>
          {isThinking && (
            <div className="absolute top-4 md:top-6 z-50 animate-fade-in">
              <div className="glass-bright px-4 md:px-6 py-2 md:py-3 rounded-full flex items-center gap-3 border border-orange-500/30 shadow-2xl">
                <Brain size={14} className="text-orange-400 animate-spin" />
                <span className="text-[8px] md:text-[10px] font-black uppercase tracking-[0.2em] md:tracking-[0.3em] text-stone-200">Architect is reasoning...</span>
              </div>
            </div>
          )}

          <div className={`w-full max-w-4xl h-full flex flex-col transition-all duration-1000 ${isZenMode ? 'px-4 md:px-0' : 'px-4 md:px-8'}`}>
            <EditorCanvas 
              textareaRef={textareaRef}
              onChange={handleTextChange}
              isVertical={isVertical}
              isZenMode={isZenMode}
              isLoading={isLoadingContent}
              isProcessing={isProcessing}
            />

            <SuggestionOverlay 
              suggestions={suggestions}
              onApply={applySuggestion}
              onClose={() => setSuggestions([])}
            />

            <WriterToolbar 
              isZenMode={isZenMode}
              isProcessing={isProcessing}
              isSuggesting={isSuggesting}
              isWhispering={isWhispering}
              onSuggest={handleSuggest}
              onDraft={handleStreamDraft}
              onWhisper={() => triggerWhisper()}
              onToggleZen={() => setIsZenMode(!isZenMode)}
            />
          </div>
        </main>

        {!isZenMode && (
          <PlotReference 
            beats={activeChapter?.beats || []}
            whisper={whisper}
            contextUsage={64} // Placeholder for calculated usage
            onGeneratePackage={handleGeneratePackage}
            onCloseWhisper={() => setWhisper(null)}
          />
        )}
      </div>
    </div>
  );
};

export default WriterView;
