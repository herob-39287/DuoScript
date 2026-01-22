
import React from 'react';
import { ViewMode } from '../../types';
import { useWriterLogic } from '../../hooks/useWriterLogic';

// Sub-components
import { EditorCanvas } from './EditorCanvas';
import { WriterHeader } from './WriterHeader';
import { ChapterNavigation } from './ChapterNavigation';
import { PlotReference } from './PlotReference';
import { MiniBible } from './MiniBible';
import { WriterToolbar } from './WriterToolbar';
import { SuggestionOverlay } from './SuggestionOverlay';
import { AppearanceSettingsModal } from './AppearanceSettingsModal';
import { ThinkingIndicator } from '../ui/ThinkingIndicator';
import { MobileDrawers } from './MobileDrawers';
import { Book, Zap } from 'lucide-react';

const WriterView: React.FC = () => {
  const { state, refs, actions } = useWriterLogic();
  const { ui, data, status } = state;

  return (
    <div className={`h-full flex flex-col transition-all duration-700 bg-stone-900 ${ui.isZenMode ? 'fixed inset-0 z-[200] bg-stone-950' : ''}`}>
      <ThinkingIndicator phase={ui.thinkingPhase} />
      
      {!ui.isZenMode && (
        <WriterHeader
          activeChapter={data.activeChapter}
          wordCount={data.wordCount}
          isVertical={ui.isVertical}
          onToggleVertical={actions.toggleVertical}
          onToggleZen={actions.toggleZen}
          onNavigateBack={actions.navigateBack}
          onOpenChapters={() => actions.setMobileTab('chapters')}
          onOpenPlot={() => actions.setMobileTab('rightPanel')}
          onOpenSettings={() => actions.toggleSettings(true)}
        />
      )}

      <div className="flex-1 flex overflow-hidden relative h-full">
        {/* Desktop Sidebar: Chapter Nav */}
        {!ui.isZenMode && (
          <ChapterNavigation 
            chapters={data.chapters}
            activeChapterId={data.activeChapterId}
            onSelectChapter={actions.selectChapter}
            onAddChapter={actions.addChapter}
          />
        )}

        <main className={`flex-1 relative flex flex-col overflow-hidden items-center ${ui.isZenMode ? 'pt-12 md:pt-16 pb-safe' : 'pb-safe'}`}>
          <div className={`w-full max-w-4xl h-full flex flex-col transition-all duration-1000 ${ui.isZenMode ? 'px-4 md:px-0' : 'px-4 md:px-8'}`}>
            <EditorCanvas 
              textareaRef={refs.textareaRef}
              onChange={actions.handleTextChange}
              isVertical={ui.isVertical}
              isZenMode={ui.isZenMode}
              isLoading={status.isLoadingContent}
              isProcessing={status.isProcessing}
            />

            <SuggestionOverlay 
              suggestions={data.suggestions}
              onApply={actions.applySuggestion}
              onClose={actions.closeSuggestions}
            />

            <WriterToolbar 
              isZenMode={ui.isZenMode}
              isProcessing={status.isProcessing}
              isSuggesting={status.isSuggesting}
              isWhispering={status.isWhispering}
              isScanning={status.isScanning}
              onSuggest={actions.suggest}
              onDraft={() => actions.streamDraft()}
              onWhisper={() => actions.triggerWhisper()}
              onScan={actions.scanDraft}
              onToggleZen={actions.toggleZen}
            />
          </div>
        </main>

        {/* Desktop Sidebar: Right Panel (Plot/Bible) */}
        {!ui.isZenMode && (
          <div className="hidden xl:flex w-80 border-l border-white/5 flex-col bg-stone-900/40 shrink-0">
             <div className="flex border-b border-white/5">
                <button 
                  onClick={() => actions.setRightPanelTab('plot')}
                  className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-colors ${ui.rightPanelTab === 'plot' ? 'text-orange-400 bg-stone-900' : 'text-stone-500 hover:text-stone-300'}`}
                >
                  <Zap size={12}/> Plot
                </button>
                <button 
                  onClick={() => actions.setRightPanelTab('bible')}
                  className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-colors ${ui.rightPanelTab === 'bible' ? 'text-orange-400 bg-stone-900' : 'text-stone-500 hover:text-stone-300'}`}
                >
                  <Book size={12}/> Bible
                </button>
             </div>
             
             {ui.rightPanelTab === 'plot' ? (
                <PlotReference 
                  beats={data.activeChapter?.beats || []}
                  whisper={data.whisper}
                  contextUsage={64} 
                  onGeneratePackage={actions.generatePackage}
                  onCloseWhisper={actions.closeWhisper}
                  onDraftBeat={(beat) => actions.streamDraft(beat)}
                  processingBeatId={status.processingBeatId}
                  isProcessing={status.isProcessing}
                  className="flex-1 overflow-hidden"
                />
             ) : (
                <MiniBible 
                  onInsert={(text) => actions.applySuggestion(text)} 
                  className="flex-1 overflow-hidden"
                />
             )}
          </div>
        )}

        {/* Mobile Drawers */}
        <MobileDrawers
          mobileTab={ui.mobileTab}
          onClose={() => actions.setMobileTab('none')}
          chapterNavProps={{
            chapters: data.chapters,
            activeChapterId: data.activeChapterId,
            onSelectChapter: actions.selectChapter,
            onAddChapter: actions.addChapter
          }}
          rightPanelProps={{
            rightPanelTab: ui.rightPanelTab,
            setRightPanelTab: actions.setRightPanelTab,
            plotProps: {
              beats: data.activeChapter?.beats || [],
              whisper: data.whisper,
              contextUsage: 64,
              onGeneratePackage: actions.generatePackage,
              onCloseWhisper: actions.closeWhisper,
              onDraftBeat: (beat) => actions.streamDraft(beat),
              processingBeatId: status.processingBeatId,
              isProcessing: status.isProcessing
            },
            miniBibleProps: {
              onInsert: (text) => actions.applySuggestion(text)
            }
          }}
        />
      </div>
      
      <AppearanceSettingsModal isOpen={ui.showSettings} onClose={() => actions.toggleSettings(false)} />

      <style>{`
        .animate-slide-in-left { animation: slideInLeft 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        @keyframes slideInLeft { from { transform: translateX(-100%); } to { transform: translateX(0); } }
        .animate-slide-in-right { animation: slideInRight 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        @keyframes slideInRight { from { transform: translateX(100%); } to { transform: translateX(0); } }
      `}</style>
    </div>
  );
};

export default WriterView;
