import { useState } from 'react';
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
import { ScenePackage } from '../types';
import {
  buildChapterDraftFromScenePackages,
  syncChapterContentFromScenePackages,
  validateChapterScenePackages,
} from '../services/scenePackage';
import {
  buildPrepareForCodexArtifacts,
  buildWorkspaceBundle,
  serializeWorkspaceBundle,
} from '../services/workspace/export';
import { workspaceBundleToProject } from '../services/workspace/import';
import { diffWorkspaceBundles, WorkspaceDiff } from '../services/workspace/diff';
import { validateProjectBranches as validateProjectBranchesV2 } from '../services/validation/branchValidator';
import { CodexTaskScope } from '../services/workspace/buildCodexTask';

export const useWriterLogic = () => {
  const chapters = useManuscript();
  const projectDispatch = useProjectDispatchContext();
  const bible = useBible();
  const globalUI = useUI();
  const meta = useMetadata();
  const sync = useNeuralSync();
  const [pendingImport, setPendingImport] = useState<{
    nextProject: {
      meta: typeof meta;
      bible: typeof bible;
      chapters: typeof chapters;
      sync: typeof sync;
    };
    diff: WorkspaceDiff;
    validationIssueCount: number;
    requiresDraftRebuild: boolean;
  } | null>(null);

  // 1. UI Logic
  const ui = useWriterUI();

  // 2. Editor Logic
  const editor = useManuscriptEditor({
    initialChapterId: chapters[0]?.id || '',
    onContentUpdate: (content) => {
      // 3. Trigger AI Context Analysis
      writerAI.analyzeContext(content);
    },
  });

  // 4. AI Logic
  const writerAI = useWriterAI({
    activeChapterId: editor.activeChapterId,
    textareaRef: editor.textareaRef,
    setWordCount: editor.setWordCount,
    draftVersionRef: editor.draftVersionRef,
  });

  // --- Handlers ---
  const branchIssues = validateProjectBranchesV2(chapters, bible);
  const activeChapterIssues = editor.activeChapter
    ? validateChapterScenePackages(editor.activeChapter, bible)
    : [];

  const actions = {
    // Navigation & UI
    toggleVertical: ui.toggleVertical,
    toggleZen: ui.toggleZen,
    toggleSettings: ui.toggleSettings,
    setRightPanelTab: ui.setRightPanelTab,
    setMobileTab: ui.setMobileTab,
    setWriterMode: ui.setWriterMode,
    navigateBack: ui.navigateBack,

    // Chapter Management
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
        updatedAt: Date.now(),
        involvedCharacterIds: [],
      };
      projectDispatch(Actions.addChapter(newChapter));
    },

    // Editor Interaction
    handleTextChange: editor.handleTextChange,

    // AI Actions
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

      projectDispatch(
        Actions.updateChapter(chapter.id, {
          scenePackages: nextScenePackages,
        }),
      );
    },

    syncChapterFromScenePackages: () => {
      const chapter = editor.activeChapter;
      if (!chapter) return;

      const synced = syncChapterContentFromScenePackages(chapter);
      projectDispatch(Actions.updateChapter(chapter.id, synced));
      if (editor.textareaRef.current && synced.content !== undefined) {
        editor.textareaRef.current.value = synced.content;
      }
      editor.setWordCount((synced.content || '').length);
    },

    buildDraftFromScenePackages: () => {
      const chapter = editor.activeChapter;
      if (!chapter) return;

      const draft = buildChapterDraftFromScenePackages(chapter);
      projectDispatch(
        Actions.updateChapter(chapter.id, {
          content: draft,
        }),
      );
      if (editor.textareaRef.current) {
        editor.textareaRef.current.value = draft;
      }
      editor.setWordCount(draft.length);
    },
    exportWorkspace: () => {
      return serializeWorkspaceBundle(buildWorkspaceBundle({ meta, bible, chapters, sync }));
    },
    importWorkspace: (raw: unknown, options?: { autoApply?: boolean }) => {
      const currentBundle = buildWorkspaceBundle({ meta, bible, chapters, sync });
      const imported = workspaceBundleToProject({ meta, bible, chapters, sync }, raw);
      const importedBundle = buildWorkspaceBundle(imported.project);
      const validationIssues = validateProjectBranchesV2(
        imported.project.chapters,
        imported.project.bible,
      );
      const requiresDraftRebuild = imported.project.chapters.some((chapter) => {
        const currentChapter = chapters.find((item) => item.id === chapter.id);
        if (!currentChapter) return true;
        return JSON.stringify(currentChapter.scenePackages || []) !== JSON.stringify(chapter.scenePackages || []);
      });
      const nextPendingImport = {
        nextProject: imported.project,
        diff: diffWorkspaceBundles(currentBundle, importedBundle),
        validationIssueCount: validationIssues.length,
        requiresDraftRebuild,
      };

      if (options?.autoApply) {
        projectDispatch(Actions.updateMeta(nextPendingImport.nextProject.meta));
        projectDispatch(Actions.loadBible(nextPendingImport.nextProject.bible));
        projectDispatch(Actions.loadChapters(nextPendingImport.nextProject.chapters));
        projectDispatch(Actions.loadSync(nextPendingImport.nextProject.sync));
        setPendingImport(null);
        return {
          applied: true,
          validationIssueCount: validationIssues.length,
          requiresDraftRebuild,
        };
      }

      setPendingImport(nextPendingImport);
      return {
        applied: false,
        validationIssueCount: validationIssues.length,
        requiresDraftRebuild,
      };
    },
    prepareForCodex: (scope: CodexTaskScope) => {
      return buildPrepareForCodexArtifacts({ meta, bible, chapters, sync }, scope);
    },
    validateBranches: () => validateProjectBranchesV2(chapters, bible),
    rebuildDraft: () => actions.buildDraftFromScenePackages(),
    acceptImportedChanges: () => {
      if (!pendingImport) return;
      projectDispatch(Actions.updateMeta(pendingImport.nextProject.meta));
      projectDispatch(Actions.loadBible(pendingImport.nextProject.bible));
      projectDispatch(Actions.loadChapters(pendingImport.nextProject.chapters));
      projectDispatch(Actions.loadSync(pendingImport.nextProject.sync));
      setPendingImport(null);
    },
    rejectImportedChanges: () => setPendingImport(null),
  };

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
