import { StoryProject } from '../../types';
import { validateProjectBranches } from '../validation/branchValidator';
import { buildCodexSchemaReference } from './buildCodexSchemaReference';
import { buildCodexTask, CodexTaskScope } from './buildCodexTask';
import { buildValidatorReport } from './buildValidatorReport';
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
  const bundle =
    scope.scopeType === 'scene' && scope.chapterId && scope.sceneId
      ? buildSceneWorkspaceBundle(project, scope.chapterId, scope.sceneId)
      : scope.scopeType === 'chapter' && scope.chapterId
        ? buildChapterWorkspaceBundle(project, scope.chapterId)
        : buildWorkspaceBundle(project);

  const issues = validateProjectBranches(bundle.project.chapters, bundle.project.bible);

  return {
    workspaceBundle: serializeWorkspaceBundle(bundle),
    codexTask: buildCodexTask(bundle, scope, issues),
    validatorReport: buildValidatorReport(issues),
    codexSchemaReference: buildCodexSchemaReference(),
  };
};
