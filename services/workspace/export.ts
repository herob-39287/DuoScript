import { StoryProject } from '../../types';
import { validateProjectBranches } from '../validation/branchValidator';
import { buildCodexSchemaReference } from './buildCodexSchemaReference';
import { buildCodexTask, CodexTaskScope } from './buildCodexTask';
import { buildValidatorReport } from './buildValidatorReport';
import { isStarterProject } from './projectGenesis';
import { WorkspaceBundle, WORKSPACE_BUNDLE_VERSION } from './types';

export const buildWorkspaceBundle = (project: StoryProject): WorkspaceBundle => {
  const reports = [
    {
      generatedAt: Date.now(),
      issues: validateProjectBranches(project.chapters, project.bible),
    },
  ];

  return {
    kind: 'duoscript.workspace',
    version: WORKSPACE_BUNDLE_VERSION,
    exportedAt: Date.now(),
    project: {
      meta: {
        id: project.meta.id,
        title: project.meta.title,
        author: project.meta.author,
        genre: project.meta.genre,
        language: project.meta.language,
        updatedAt: project.meta.updatedAt,
      },
      bible: project.bible,
      chapters: project.chapters,
      vnDesign: {
        routes: project.bible.routes || [],
        revealPlans: project.bible.revealPlans || [],
        stateAxes: project.bible.stateAxes || [],
        branchPolicies: project.bible.branchPolicies || [],
      },
      reports,
    },
  };
};

export const buildStarterWorkspaceBundle = (project: StoryProject): WorkspaceBundle => {
  const fallbackChapter = {
    id: 'chapter-1',
    title: 'Chapter 1',
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
    content: '',
    draftVersion: 0,
    authoringMode: 'structured' as const,
    draftText: '',
    compiledContent: '',
    updatedAt: Date.now(),
    involvedCharacterIds: [],
    scenePackages: [],
  };

  return buildWorkspaceBundle({
    ...project,
    bible: {
      ...project.bible,
      setting: project.bible.setting || 'Project genesis starter setting.',
      routes: [],
      revealPlans: [],
      stateAxes: [],
      branchPolicies: [],
    },
    chapters: project.chapters.length > 0 ? project.chapters : [fallbackChapter],
  });
};

export const buildChapterWorkspaceBundle = (
  project: StoryProject,
  chapterId: string,
): WorkspaceBundle => {
  const chapter = project.chapters.find((item) => item.id === chapterId);
  if (!chapter) return buildWorkspaceBundle(project);

  return buildWorkspaceBundle({
    ...project,
    chapters: [chapter],
  });
};

export const buildSceneWorkspaceBundle = (
  project: StoryProject,
  chapterId: string,
  sceneId: string,
): WorkspaceBundle => {
  const chapter = project.chapters.find((item) => item.id === chapterId);
  if (!chapter) return buildWorkspaceBundle(project);

  const scenePackages = (chapter.scenePackages || []).filter((item) => item.sceneId === sceneId);

  return buildWorkspaceBundle({
    ...project,
    chapters: [
      {
        ...chapter,
        scenePackages,
      },
    ],
  });
};

export const serializeWorkspaceBundle = (bundle: WorkspaceBundle): string => {
  return JSON.stringify(bundle, null, 2);
};

export const buildPrepareForCodexArtifacts = (
  project: StoryProject,
  scope: CodexTaskScope,
): {
  workspaceBundle: string;
  codexTask: string;
  validatorReport: string;
  codexSchemaReference: string;
} => {
  const shouldUseStarterBundle = scope.taskType === 'project genesis' && isStarterProject(project);
  const effectiveScope: CodexTaskScope =
    scope.taskType === 'project genesis' && !shouldUseStarterBundle
      ? { ...scope, taskType: 'interactive refinement' }
      : scope;

  const bundle = shouldUseStarterBundle
    ? buildStarterWorkspaceBundle(project)
    : effectiveScope.scopeType === 'scene' && effectiveScope.chapterId && effectiveScope.sceneId
      ? buildSceneWorkspaceBundle(project, effectiveScope.chapterId, effectiveScope.sceneId)
      : effectiveScope.scopeType === 'chapter' && effectiveScope.chapterId
        ? buildChapterWorkspaceBundle(project, effectiveScope.chapterId)
        : buildWorkspaceBundle(project);

  const issues = validateProjectBranches(bundle.project.chapters, bundle.project.bible);

  return {
    workspaceBundle: serializeWorkspaceBundle(bundle),
    codexTask: buildCodexTask(bundle, effectiveScope, issues),
    validatorReport: buildValidatorReport(issues),
    codexSchemaReference: buildCodexSchemaReference(),
  };
};
