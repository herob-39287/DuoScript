import React from 'react';
import { ChapterNavigation } from './ChapterNavigation';
import { PlotReference } from './PlotReference';
import { MiniBible } from './MiniBible';
import { BranchIssuesPanel } from './BranchIssuesPanel';
import { BranchValidationIssue, ChapterRuleIssue } from '../../services/scenePackage';
import { Styles } from '../ui/DesignSystem';
import { Zap, Book } from 'lucide-react';
import { ChapterLog, PlotBeat, WhisperAdvice } from '../../types';

interface MobileDrawersProps {
  mobileTab: 'none' | 'chapters' | 'rightPanel';
  onClose: () => void;
  chapterNavProps: {
    chapters: ChapterLog[];
    activeChapterId: string;
    onSelectChapter: (id: string) => void;
    onAddChapter: () => void;
  };
  rightPanelProps: {
    rightPanelTab: 'plot' | 'bible' | 'branch';
    setRightPanelTab: (tab: 'plot' | 'bible' | 'branch') => void;
    plotProps: {
      beats: PlotBeat[];
      whisper: WhisperAdvice | null;
      contextUsage: number;
      onGeneratePackage: () => void;
      onCloseWhisper: () => void;
      onDraftBeat: (beat: PlotBeat) => void;
      processingBeatId?: string | null;
      isProcessing?: boolean;
    };
    miniBibleProps: {
      onInsert: (text: string) => void;
    };
    branchProps: {
      issues: BranchValidationIssue[];
      chapterIssues: ChapterRuleIssue[];
    };
  };
}

export const MobileDrawers: React.FC<MobileDrawersProps> = ({
  mobileTab,
  onClose,
  chapterNavProps,
  rightPanelProps,
}) => {
  return (
    <>
      {mobileTab === 'chapters' && (
        <div className="absolute inset-0 z-[150] flex xl:hidden bg-stone-950/80 backdrop-blur-sm animate-fade-in">
          <div className="w-[85vw] max-w-xs h-full animate-slide-in-left shadow-2xl">
            <ChapterNavigation
              {...chapterNavProps}
              className="w-full h-full border-r border-white/10 bg-stone-900 flex flex-col"
              onClose={onClose}
            />
          </div>
          <button
            className="flex-1 w-full h-full cursor-default focus:outline-none"
            onClick={onClose}
            aria-label="Close menu"
          />
        </div>
      )}

      {mobileTab === 'rightPanel' && (
        <div className="absolute inset-0 z-[150] flex xl:hidden bg-stone-950/80 backdrop-blur-sm animate-fade-in justify-end">
          <button
            className="flex-1 w-full h-full cursor-default focus:outline-none"
            onClick={onClose}
            aria-label="Close menu"
          />
          <div className="w-[85vw] max-w-sm h-full animate-slide-in-right shadow-2xl bg-stone-900 border-l border-white/10 flex flex-col">
            <div className="flex border-b border-white/5 shrink-0">
              <button
                onClick={() => rightPanelProps.setRightPanelTab('plot')}
                className={`flex-1 py-4 ${Styles.text.label} flex items-center justify-center gap-2 transition-colors ${rightPanelProps.rightPanelTab === 'plot' ? 'text-orange-400 bg-stone-900' : 'text-stone-500'}`}
              >
                <Zap size={14} /> Plot
              </button>
              <button
                onClick={() => rightPanelProps.setRightPanelTab('bible')}
                className={`flex-1 py-4 ${Styles.text.label} flex items-center justify-center gap-2 transition-colors ${rightPanelProps.rightPanelTab === 'bible' ? 'text-orange-400 bg-stone-900' : 'text-stone-500'}`}
              >
                <Book size={14} /> Bible
              </button>
              <button
                onClick={() => rightPanelProps.setRightPanelTab('branch')}
                className={`flex-1 py-4 ${Styles.text.label} flex items-center justify-center gap-2 transition-colors ${rightPanelProps.rightPanelTab === 'branch' ? 'text-orange-400 bg-stone-900' : 'text-stone-500'}`}
              >
                Branch
              </button>
            </div>

            {rightPanelProps.rightPanelTab === 'plot' ? (
              <PlotReference
                {...rightPanelProps.plotProps}
                className="flex-1 overflow-hidden"
                onClose={onClose}
              />
            ) : rightPanelProps.rightPanelTab === 'bible' ? (
              <MiniBible {...rightPanelProps.miniBibleProps} className="flex-1 overflow-hidden" />
            ) : (
              <BranchIssuesPanel {...rightPanelProps.branchProps} />
            )}
          </div>
        </div>
      )}
    </>
  );
};
