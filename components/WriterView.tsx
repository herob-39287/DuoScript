import React, { useEffect, useRef, useState } from 'react';
import { useWriterLogic } from '../hooks/useWriterLogic';

// Sub-components
import { EditorCanvas } from './writer/EditorCanvas';
import { WriterHeader } from './writer/WriterHeader';
import { ChapterNavigation } from './writer/ChapterNavigation';
import { PlotReference } from './writer/PlotReference';
import { MiniBible } from './writer/MiniBible';
import { WriterToolbar } from './writer/WriterToolbar';
import { SuggestionOverlay } from './writer/SuggestionOverlay';
import { AppearanceSettingsModal } from './writer/AppearanceSettingsModal';
import { ThinkingIndicator } from './ui/ThinkingIndicator';
import { Book, Zap } from 'lucide-react';
import { MobileDrawers } from './writer/MobileDrawers';
import { ScenePackageModePanel } from './writer/ScenePackageModePanel';
import { BranchIssuesPanel } from './writer/BranchIssuesPanel';

const WriterView: React.FC = () => {
  const { state, refs, actions } = useWriterLogic();
  const { ui, data, status } = state;
  const importInputRef = useRef<HTMLInputElement>(null);
  const importAndApplyInputRef = useRef<HTMLInputElement>(null);
  const [prepareScope, setPrepareScope] = useState<'project' | 'chapter' | 'scene'>('project');
  const [prepareSceneId, setPrepareSceneId] = useState('');

  useEffect(() => {
    const firstSceneId = data.activeChapter?.scenePackages?.[0]?.sceneId || '';
    setPrepareSceneId(firstSceneId);
  }, [data.activeChapterId, data.activeChapter?.scenePackages]);

  const downloadWorkspace = () => {
    const serialized = actions.exportWorkspace();
    const blob = new Blob([serialized], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `WriterWorkspace_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 500);
  };

  const downloadPrepareForCodex = () => {
    const artifacts = actions.prepareForCodex({
      scopeType: prepareScope,
      chapterId: prepareScope !== 'project' ? data.activeChapterId : undefined,
      sceneId: prepareScope === 'scene' ? prepareSceneId : undefined,
      objective: 'Refine VN branching packages with validator-safe updates.',
    });
    const files = [
      { name: 'workspace_bundle.json', content: artifacts.workspaceBundle, type: 'application/json' },
      { name: 'codex_task.md', content: artifacts.codexTask, type: 'text/markdown' },
      { name: 'validator_report.md', content: artifacts.validatorReport, type: 'text/markdown' },
      {
        name: 'codex_schema_reference.md',
        content: artifacts.codexSchemaReference,
        type: 'text/markdown',
      },
    ];

    files.forEach((file, index) => {
      setTimeout(() => {
        const blob = new Blob([file.content], { type: `${file.type};charset=utf-8` });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = file.name;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 500);
      }, index * 120);
    });
  };

  return (
    <div
      className={`h-full flex flex-col transition-all duration-700 bg-stone-900 ${ui.isZenMode ? 'fixed inset-0 z-[200] bg-stone-950' : ''}`}
    >
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

        <main
          className={`flex-1 relative flex flex-col overflow-hidden items-center ${ui.isZenMode ? 'pt-12 md:pt-16 pb-safe' : 'pb-safe'}`}
        >
          <div
            className={`w-full max-w-4xl h-full flex flex-col transition-all duration-1000 ${ui.isZenMode ? 'px-4 md:px-0' : 'px-4 md:px-8'}`}
          >
            {!ui.isZenMode && (
              <div className="mt-4 mb-3 rounded-2xl border border-white/10 bg-stone-900/60 p-1 grid grid-cols-2 md:grid-cols-4 gap-1">
                {[
                  ['shared_spine', 'Shared Spine'],
                  ['choice_variant', 'Choice / Variant'],
                  ['convergence', 'Convergence'],
                  ['validation', 'Validation'],
                  ['final_draft', 'Final Draft'],
                ].map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() =>
                      actions.setWriterMode(
                        key as
                          | 'shared_spine'
                          | 'choice_variant'
                          | 'convergence'
                          | 'validation'
                          | 'final_draft',
                      )
                    }
                    className={`px-3 py-2 rounded-xl text-[11px] font-black tracking-wider transition-colors ${ui.writerMode === key ? 'bg-orange-500/20 text-orange-300 border border-orange-500/40' : 'text-stone-400 hover:text-stone-100'}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}

            {!ui.isZenMode && (
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <button
                  onClick={downloadWorkspace}
                  className="px-3 py-2 rounded-xl text-[10px] font-black tracking-widest text-stone-200 bg-stone-800 hover:bg-stone-700"
                >
                  Export Workspace
                </button>
                <button
                  onClick={downloadPrepareForCodex}
                  className="px-3 py-2 rounded-xl text-[10px] font-black tracking-widest text-orange-200 bg-orange-500/10 border border-orange-500/30 hover:bg-orange-500/20"
                >
                  Prepare for Codex
                </button>
                <select
                  value={prepareScope}
                  onChange={(event) =>
                    setPrepareScope(event.target.value as 'project' | 'chapter' | 'scene')
                  }
                  className="px-3 py-2 rounded-xl text-[10px] font-black tracking-widest text-stone-200 bg-stone-800 border border-white/10"
                >
                  <option value="project">Scope: Project</option>
                  <option value="chapter">Scope: Active Chapter</option>
                  <option value="scene">Scope: Active Scene</option>
                </select>
                {prepareScope === 'scene' && (
                  <select
                    value={prepareSceneId}
                    onChange={(event) => setPrepareSceneId(event.target.value)}
                    className="px-3 py-2 rounded-xl text-[10px] font-black tracking-widest text-stone-200 bg-stone-800 border border-white/10"
                  >
                    {(data.activeChapter?.scenePackages || []).map((scenePackage) => (
                      <option key={scenePackage.sceneId} value={scenePackage.sceneId}>
                        {scenePackage.sceneId}
                      </option>
                    ))}
                  </select>
                )}
                <button
                  onClick={() => importInputRef.current?.click()}
                  className="px-3 py-2 rounded-xl text-[10px] font-black tracking-widest text-stone-200 bg-stone-800 hover:bg-stone-700"
                >
                  Import Workspace
                </button>
                <button
                  onClick={() => importAndApplyInputRef.current?.click()}
                  className="px-3 py-2 rounded-xl text-[10px] font-black tracking-widest text-emerald-200 bg-emerald-500/15 border border-emerald-500/30"
                >
                  Import & Apply
                </button>
                {data.hasPendingImport && (
                  <>
                    <button
                      onClick={actions.acceptImportedChanges}
                      className="px-3 py-2 rounded-xl text-[10px] font-black tracking-widest text-emerald-200 bg-emerald-500/15 border border-emerald-500/30"
                    >
                      Accept Import
                    </button>
                    <button
                      onClick={actions.rejectImportedChanges}
                      className="px-3 py-2 rounded-xl text-[10px] font-black tracking-widest text-rose-200 bg-rose-500/10 border border-rose-500/30"
                    >
                      Reject Import
                    </button>
                  </>
                )}
                <input
                  ref={importInputRef}
                  type="file"
                  accept=".json,application/json"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = () => {
                      try {
                        actions.importWorkspace(JSON.parse(String(reader.result)));
                      } catch {
                        // noop
                      }
                    };
                    reader.readAsText(file);
                  }}
                />
                <input
                  ref={importAndApplyInputRef}
                  type="file"
                  accept=".json,application/json"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = () => {
                      try {
                        actions.importWorkspace(JSON.parse(String(reader.result)), { autoApply: true });
                      } catch {
                        // noop
                      }
                    };
                    reader.readAsText(file);
                  }}
                />
              </div>
            )}

            {!ui.isZenMode && ui.writerMode === 'final_draft' && (
              <div className="mb-3 flex items-center gap-2">
                <button
                  onClick={actions.buildDraftFromScenePackages}
                  className="px-3 py-2 rounded-xl text-[10px] font-black tracking-widest text-stone-200 bg-stone-800 hover:bg-stone-700"
                >
                  Build Draft
                </button>
                <button
                  onClick={actions.syncChapterFromScenePackages}
                  className="px-3 py-2 rounded-xl text-[10px] font-black tracking-widest text-orange-300 bg-orange-500/10 border border-orange-500/30 hover:bg-orange-500/20"
                >
                  Sync Cache
                </button>
              </div>
            )}

            <ScenePackageModePanel
              mode={ui.writerMode}
              chapter={data.activeChapter}
              onUpdateScenePackage={actions.updateScenePackage}
            />

            {!ui.isZenMode && ui.writerMode === 'validation' && (
              <div className="mb-4 rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 text-xs text-stone-200 space-y-1">
                <p>Route + Chapter + Scene + Validator 差分プレビュー</p>
                <p>
                  {data.pendingImportDiff
                    ? `routes +${data.pendingImportDiff.routeDiff.added.length}/-${data.pendingImportDiff.routeDiff.removed.length}/~${data.pendingImportDiff.routeDiff.modified.length}, chapters +${data.pendingImportDiff.chapterDiff.added.length}/-${data.pendingImportDiff.chapterDiff.removed.length}/~${data.pendingImportDiff.chapterDiff.modified.length}, scenes +${data.pendingImportDiff.sceneDiff.added.length}/-${data.pendingImportDiff.sceneDiff.removed.length}/~${data.pendingImportDiff.sceneDiff.modified.length}, choices ~${data.pendingImportDiff.detailDiff.modifiedChoices.length}, variants ~${data.pendingImportDiff.detailDiff.modifiedReactionVariants.length}, conditions ~${data.pendingImportDiff.detailDiff.modifiedConditions.length}, issues ${data.pendingImportDiff.validatorDiff.previous}→${data.pendingImportDiff.validatorDiff.next}`
                    : 'Pending import はありません。Import Workspace を実行してください。'}
                </p>
                {data.pendingImportDiff && (
                  <p>
                    import validation: {data.pendingImportValidationIssueCount} issues / draft rebuild{' '}
                    {data.pendingImportRequiresDraftRebuild ? 'required' : 'not required'}
                  </p>
                )}
                <button
                  onClick={actions.validateBranches}
                  className="mt-2 px-3 py-2 rounded-xl text-[10px] font-black tracking-widest text-orange-200 bg-orange-500/10 border border-orange-500/30"
                >
                  Re-run Validator
                </button>
              </div>
            )}

            {ui.writerMode === 'final_draft' && (
              <>
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

                <div className="mt-3 space-y-2">
                  <div className="text-[10px] font-black tracking-widest text-orange-300">
                    CODEX ROUND-TRIP
                  </div>
                  <div className="text-[10px] text-stone-400">
                    Use “Prepare for Codex” / “Import Workspace” for the primary flow.
                  </div>
                  <div className="text-[10px] font-black tracking-widest text-stone-400">
                    GEMINI ASSIST (OPTIONAL)
                  </div>
                  <WriterToolbar
                    isZenMode={ui.isZenMode}
                    isProcessing={status.isProcessing}
                    isSuggesting={status.isSuggesting}
                    isWhispering={status.isWhispering}
                    isScanning={status.isScanning}
                    onSuggest={actions.suggest}
                    onDraft={() => actions.generateThreeStageDraft()}
                    onWhisper={() => actions.triggerWhisper()}
                    onScan={actions.scanDraft}
                    onToggleZen={actions.toggleZen}
                  />
                </div>
              </>
            )}
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
                <Zap size={12} /> Plot
              </button>
              <button
                onClick={() => actions.setRightPanelTab('bible')}
                className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-colors ${ui.rightPanelTab === 'bible' ? 'text-orange-400 bg-stone-900' : 'text-stone-500 hover:text-stone-300'}`}
              >
                <Book size={12} /> Bible
              </button>
              <button
                onClick={() => actions.setRightPanelTab('branch')}
                className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-colors ${ui.rightPanelTab === 'branch' ? 'text-orange-400 bg-stone-900' : 'text-stone-500 hover:text-stone-300'}`}
              >
                Branch
              </button>
            </div>

            {ui.rightPanelTab === 'plot' ? (
              <PlotReference
                beats={data.activeChapter?.beats || []}
                whisper={data.whisper}
                contextUsage={64}
                onGeneratePackage={actions.generatePackage}
                onCloseWhisper={actions.closeWhisper}
                onDraftBeat={(beatText) => actions.streamDraft(beatText)}
                className="flex-1 overflow-hidden"
              />
            ) : ui.rightPanelTab === 'bible' ? (
              <MiniBible
                onInsert={(text) => actions.applySuggestion(text)}
                className="flex-1 overflow-hidden"
              />
            ) : (
              <BranchIssuesPanel
                issues={data.branchIssues}
                chapterIssues={data.activeChapterIssues}
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
            onAddChapter: actions.addChapter,
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
              onDraftBeat: (beatText) => actions.streamDraft(beatText),
            },
            miniBibleProps: {
              onInsert: (text) => actions.applySuggestion(text),
            },
            branchProps: {
              issues: data.branchIssues,
              chapterIssues: data.activeChapterIssues,
            },
          }}
        />
      </div>

      <AppearanceSettingsModal
        isOpen={ui.showSettings}
        onClose={() => actions.toggleSettings(false)}
      />

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
