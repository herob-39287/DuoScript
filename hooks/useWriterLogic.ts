import { useMemo, useState } from 'react';
import {
  useManuscript,
  useBible,
  useUI,
  useMetadata,
  useNeuralSync,
  useProjectDispatchContext,
} from '../contexts/StoryContext';
import * as Actions from '../store/actions';
import { useWriterUI } from './useWriterUI';
import { useManuscriptEditor } from './useManuscriptEditor';
import { useWriterAI } from './useWriterAI';
import { ScenePackage, StoryProject } from '../types';
import {
  compileChapterContentFromScenePackages,
  syncChapterCompiledContentFromScenePackages,
  validateChapterScenePackages,
} from '../services/scenePackage';
import {
  buildPrepareForCodexArtifacts,
  buildWorkspaceBundle,
  serializeWorkspaceBundle,
} from '../services/workspace/export';
import { detectCodexArtifact, workspaceBundleToProject } from '../services/workspace/import';
import { diffWorkspaceBundles, WorkspaceDiff } from '../services/workspace/diff';
import { validateProjectBranches as validateProjectBranchesV2 } from '../services/validation/branchValidator';
import { CodexTaskScope } from '../services/workspace/buildCodexTask';
import { shadowApplyCodexOps } from '../services/workspace/patchEngine';
import { CodexOpsArtifact } from '../services/workspace/patchTypes';

type PendingBundleImport = {
  mode: 'bundle';
  nextProject: StoryProject;
  diff: WorkspaceDiff;
  validationIssueCount: number;
  requiresDraftRebuild: boolean;
};

type PendingOpsImport = {
  mode: 'ops';
  opsArtifact: CodexOpsArtifact;
  selectedOpIds: string[];
  nextProject: StoryProject;
  diff: WorkspaceDiff;
  validationIssueCount: number;
  requiresDraftRebuild: boolean;
  opResults: { opId: string; status: string; message: string }[];
  unresolved: string[];
};

export const useWriterLogic = () => {
  const chapters = useManuscript();
  const projectDispatch = useProjectDispatchContext();
  const bible = useBible();
  const globalUI = useUI();
  const meta = useMetadata();
  const sync = useNeuralSync();

  const [pendingImport, setPendingImport] = useState<PendingBundleImport | PendingOpsImport | null>(
    null,
  );
  const [codexQuestions, setCodexQuestions] = useState<string[]>([]);

  const ui = useWriterUI();
  const editor = useManuscriptEditor({
    initialChapterId: chapters[0]?.id || '',
    onContentUpdate: (content) => {
      writerAI.analyzeContext(content);
    },
  });

  const writerAI = useWriterAI({
    activeChapterId: editor.activeChapterId,
    textareaRef: editor.textareaRef,
    setWordCount: editor.setWordCount,
    draftVersionRef: editor.draftVersionRef,
  });

  const branchIssues = validateProjectBranchesV2(chapters, bible);
  const activeChapterIssues = editor.activeChapter
    ? validateChapterScenePackages(editor.activeChapter, bible)
    : [];

  const applyProjectSnapshot = (project: StoryProject) => {
    projectDispatch(Actions.updateMeta(project.meta));
    projectDispatch(Actions.loadBible(project.bible));
    projectDispatch(Actions.loadChapters(project.chapters));
    projectDispatch(Actions.loadSync(project.sync));
  };

  const recomputeOpsPreview = (opsArtifact: CodexOpsArtifact, selectedOpIds: string[]) => {
    const currentProject = { meta, bible, chapters, sync };
    const preview = shadowApplyCodexOps(currentProject, opsArtifact, selectedOpIds);
    const nextProject = {
      ...currentProject,
      ...preview.project,
    };
    setPendingImport({
      mode: 'ops',
      opsArtifact,
      selectedOpIds,
      nextProject,
      diff: preview.diff,
      validationIssueCount: preview.validatorIssues.length,
      requiresDraftRebuild: preview.requiresDraftRebuild,
      opResults: preview.opResults,
      unresolved: preview.unresolved,
    });
  };

  const actions = {
    toggleVertical: ui.toggleVertical,
    toggleZen: ui.toggleZen,
    toggleSettings: ui.toggleSettings,
    setRightPanelTab: ui.setRightPanelTab,
    setMobileTab: ui.setMobileTab,
    setWriterMode: ui.setWriterMode,
    navigateBack: ui.navigateBack,
    selectChapter: editor.setActiveChapterId,
    addChapter: () => {
      const newChapter = {
        id: crypto.randomUUID(),
        title: `第${chapters.length + 1}章`,
        summary: '',
        scenes: [],
        beats: [],
        strategy: {
          milestones: [],
          forbiddenResolutions: [],
          characterArcProgress: '',
          pacing: '',
        },
        status: 'Idea' as const,
        wordCount: 0,
        draftVersion: 0,
        authoringMode: 'freeform' as const,
        draftText: '',
        compiledContent: '',
        updatedAt: Date.now(),
        involvedCharacterIds: [],
      };
      projectDispatch(Actions.addChapter(newChapter));
    },
    handleTextChange: editor.handleTextChange,
    generatePackage: writerAI.generatePackage,
    suggest: writerAI.suggestNext,
    applySuggestion: writerAI.applySuggestion,
    streamDraft: writerAI.streamDraft,
    generateThreeStageDraft: writerAI.generateThreeStageDraft,
    scanDraft: writerAI.scanDraft,
    triggerWhisper: writerAI.triggerWhisper,
    closeSuggestions: () => writerAI.setSuggestions([]),
    closeWhisper: () => writerAI.setWhisper(null),

    updateScenePackage: (
      sceneId: string,
      updater: (scenePackage: ScenePackage) => ScenePackage,
    ) => {
      const chapter = editor.activeChapter;
      if (!chapter) return;
      const existing = chapter.scenePackages || [];
      const nextScenePackages = existing.map((scenePackage) =>
        scenePackage.sceneId === sceneId ? updater(scenePackage as ScenePackage) : scenePackage,
      );
      projectDispatch(Actions.updateChapter(chapter.id, { scenePackages: nextScenePackages }));
    },

    syncChapterFromScenePackages: () => {
      const chapter = editor.activeChapter;
      if (!chapter) return;
      if ((chapter.authoringMode || 'freeform') !== 'structured') return;
      const synced = syncChapterCompiledContentFromScenePackages(chapter);
      projectDispatch(Actions.updateChapter(chapter.id, synced));
      if (editor.textareaRef.current && synced.compiledContent !== undefined) {
        editor.textareaRef.current.value = synced.compiledContent;
      }
      editor.setWordCount((synced.compiledContent || '').length);
    },

    rebuildCompiledContentFromScenePackages: () => {
      const chapter = editor.activeChapter;
      if (!chapter) return;
      if ((chapter.authoringMode || 'freeform') !== 'structured') return;
      const compiledContent = compileChapterContentFromScenePackages(chapter);
      projectDispatch(Actions.updateChapter(chapter.id, { compiledContent }));
      if (editor.textareaRef.current) editor.textareaRef.current.value = compiledContent;
      editor.setWordCount(compiledContent.length);
    },

    convertChapterToFreeform: () => {
      const chapter = editor.activeChapter;
      if (!chapter) return;
      projectDispatch(Actions.setChapterAuthoringMode(chapter.id, 'freeform'));
      projectDispatch(
        Actions.setChapterDraftText(
          chapter.id,
          chapter.draftText ?? chapter.compiledContent ?? chapter.content ?? '',
        ),
      );
    },

    exportWorkspace: () =>
      serializeWorkspaceBundle(buildWorkspaceBundle({ meta, bible, chapters, sync })),

    importWorkspace: (raw: unknown, options?: { autoApply?: boolean; fallbackText?: string }) => {
      const currentProject = { meta, bible, chapters, sync };
      const detected = detectCodexArtifact(raw, options?.fallbackText);

      if (detected.type === 'questions') {
        setCodexQuestions(detected.questions.questions);
        setPendingImport(null);
        return { applied: false, mode: 'questions' as const };
      }

      if (detected.type === 'ops') {
        const selectedOpIds = detected.ops.operations.map((op) => op.opId);
        recomputeOpsPreview(detected.ops, selectedOpIds);

        if (options?.autoApply) {
          const preview = shadowApplyCodexOps(currentProject, detected.ops, selectedOpIds);
          applyProjectSnapshot({ ...currentProject, ...preview.project });
          setPendingImport(null);
          return {
            applied: true,
            mode: 'ops' as const,
            validationIssueCount: preview.validatorIssues.length,
            requiresDraftRebuild: preview.requiresDraftRebuild,
          };
        }

        return { applied: false, mode: 'ops' as const };
      }

      const currentBundle = buildWorkspaceBundle(currentProject);
      const imported = workspaceBundleToProject(currentProject, detected.bundle);
      const importedBundle = buildWorkspaceBundle(imported.project);
      const requiresDraftRebuild = imported.rebuiltChapterIds.length > 0;
      const nextPendingImport: PendingBundleImport = {
        mode: 'bundle',
        nextProject: imported.project,
        diff: diffWorkspaceBundles(currentBundle, importedBundle),
        validationIssueCount: imported.validationIssueCount,
        requiresDraftRebuild,
      };

      if (options?.autoApply) {
        applyProjectSnapshot(nextPendingImport.nextProject);
        setPendingImport(null);
        return {
          applied: true,
          mode: 'bundle' as const,
          validationIssueCount: imported.validationIssueCount,
          requiresDraftRebuild,
        };
      }

      setPendingImport(nextPendingImport);
      return {
        applied: false,
        mode: 'bundle' as const,
        validationIssueCount: imported.validationIssueCount,
        requiresDraftRebuild,
      };
    },

    prepareForCodex: (scope: CodexTaskScope) =>
      buildPrepareForCodexArtifacts({ meta, bible, chapters, sync }, scope),
    validateBranches: () => validateProjectBranchesV2(chapters, bible),
    rebuildDraft: () => actions.rebuildCompiledContentFromScenePackages(),

    acceptImportedChanges: () => {
      if (!pendingImport) return;
      applyProjectSnapshot(pendingImport.nextProject);
      setPendingImport(null);
    },
    rejectImportedChanges: () => setPendingImport(null),

    applyAllCodexOps: () => {
      if (!pendingImport || pendingImport.mode !== 'ops') return;
      recomputeOpsPreview(
        pendingImport.opsArtifact,
        pendingImport.opsArtifact.operations.map((op) => op.opId),
      );
    },
    rejectAllCodexOps: () => {
      if (!pendingImport || pendingImport.mode !== 'ops') return;
      recomputeOpsPreview(pendingImport.opsArtifact, []);
    },
    applyCodexOp: (opId: string) => {
      if (!pendingImport || pendingImport.mode !== 'ops') return;
      if (pendingImport.selectedOpIds.includes(opId)) return;
      recomputeOpsPreview(pendingImport.opsArtifact, [...pendingImport.selectedOpIds, opId]);
    },
    rejectCodexOp: (opId: string) => {
      if (!pendingImport || pendingImport.mode !== 'ops') return;
      recomputeOpsPreview(
        pendingImport.opsArtifact,
        pendingImport.selectedOpIds.filter((id) => id !== opId),
      );
    },
    clearCodexQuestions: () => setCodexQuestions([]),
  };

  const selectedOpIds =
    pendingImport && pendingImport.mode === 'ops' ? pendingImport.selectedOpIds : [];

  const selectedOpSet = useMemo(() => new Set(selectedOpIds), [selectedOpIds]);

  return {
    state: {
      ui: {
        isZenMode: ui.isZenMode,
        isVertical: ui.isVertical,
        showSettings: ui.showSettings,
        rightPanelTab: ui.rightPanelTab,
        mobileTab: ui.mobileTab,
        writerMode: ui.writerMode,
        thinkingPhase: globalUI.thinkingPhase,
        isContextActive: globalUI.isContextActive,
      },
      data: {
        chapters,
        activeChapter: editor.activeChapter,
        activeChapterId: editor.activeChapterId,
        wordCount: editor.wordCount,
        whisper: writerAI.whisper,
        suggestions: writerAI.suggestions,
        bible,
        branchIssues,
        activeChapterIssues,
        pendingImportDiff: pendingImport?.diff || null,
        pendingImportValidationIssueCount: pendingImport?.validationIssueCount || 0,
        pendingImportRequiresDraftRebuild: pendingImport?.requiresDraftRebuild || false,
        hasPendingImport: Boolean(pendingImport),
        pendingImportMode: pendingImport?.mode || null,
        codexQuestions,
        codexOps:
          pendingImport && pendingImport.mode === 'ops'
            ? pendingImport.opsArtifact.operations.map((op) => ({
                op,
                selected: selectedOpSet.has(op.opId),
                result: pendingImport.opResults.find((result) => result.opId === op.opId),
              }))
            : [],
        codexOpsUnresolved:
          pendingImport && pendingImport.mode === 'ops' ? pendingImport.unresolved : [],
      },
      status: {
        isProcessing: writerAI.isProcessing,
        processingBeatId: writerAI.processingBeatId,
        isSuggesting: writerAI.isSuggesting,
        isScanning: writerAI.isScanning,
        isWhispering: writerAI.isWhispering,
        isLoadingContent: editor.isLoadingContent,
      },
    },
    refs: {
      textareaRef: editor.textareaRef,
    },
    actions,
  };
};
