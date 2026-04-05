import { StoryProject } from '../../types';
import { validateProjectBranches } from '../validation/branchValidator';
import { diffWorkspaceBundles } from './diff';
import { buildWorkspaceBundle } from './export';
import {
  CodexOpsArtifact,
  CodexOpsShadowResult,
  CodexPatchOperation,
  OpApplyResult,
} from './patchTypes';

const upsertBy = <T>(items: T[], incoming: T, getId: (item: T) => string): T[] => {
  const id = getId(incoming);
  const index = items.findIndex((item) => getId(item) === id);
  if (index === -1) return [...items, incoming];
  const next = [...items];
  next[index] = incoming;
  return next;
};

const isChapterEditable = (chapterId: string, editableChapterIds?: string[]) => {
  if (!editableChapterIds || editableChapterIds.length === 0) return true;
  return editableChapterIds.includes(chapterId);
};

const isSceneEditable = (sceneId: string, editableSceneIds?: string[]) => {
  if (!editableSceneIds || editableSceneIds.length === 0) return true;
  return editableSceneIds.includes(sceneId);
};

const applyOperation = (
  project: StoryProject,
  op: CodexPatchOperation,
  artifact: CodexOpsArtifact,
): { project: StoryProject; result: OpApplyResult; touchedStructuredChapter: boolean } => {
  const scope = artifact.scopeGuard;

  if (op.type === 'setProjectField') {
    const next: StoryProject = structuredClone(project);
    if (op.path === 'meta.title') next.meta.title = op.value;
    if (op.path === 'meta.author') next.meta.author = op.value;
    if (op.path === 'meta.genre') next.meta.genre = op.value;
    if (op.path === 'bible.setting') next.bible.setting = op.value;
    return {
      project: next,
      touchedStructuredChapter: false,
      result: { opId: op.opId, type: op.type, status: 'applied', message: `${op.path} updated.` },
    };
  }

  if (op.type === 'upsertStateAxis') {
    return {
      project: { ...project, bible: { ...project.bible, stateAxes: upsertBy(project.bible.stateAxes || [], op.axis, (item) => item.stateKey) } },
      touchedStructuredChapter: false,
      result: { opId: op.opId, type: op.type, status: 'applied', message: `StateAxis ${op.axis.stateKey} upserted.` },
    };
  }

  if (op.type === 'upsertRoute') {
    return {
      project: { ...project, bible: { ...project.bible, routes: upsertBy(project.bible.routes || [], op.route, (item) => item.routeId) } },
      touchedStructuredChapter: false,
      result: { opId: op.opId, type: op.type, status: 'applied', message: `Route ${op.route.routeId} upserted.` },
    };
  }

  if (op.type === 'upsertRevealPlan') {
    return {
      project: {
        ...project,
        bible: {
          ...project.bible,
          revealPlans: upsertBy(project.bible.revealPlans || [], op.revealPlan, (item) => item.revealId),
        },
      },
      touchedStructuredChapter: false,
      result: { opId: op.opId, type: op.type, status: 'applied', message: `RevealPlan ${op.revealPlan.revealId} upserted.` },
    };
  }

  if (op.type === 'upsertBranchPolicy') {
    return {
      project: {
        ...project,
        bible: {
          ...project.bible,
          branchPolicies: upsertBy(project.bible.branchPolicies || [], op.policy, (item) => item.policyId),
        },
      },
      touchedStructuredChapter: false,
      result: { opId: op.opId, type: op.type, status: 'applied', message: `BranchPolicy ${op.policy.policyId} upserted.` },
    };
  }

  if (op.type === 'upsertChapter') {
    if (!isChapterEditable(op.chapter.id, scope?.editableChapterIds)) {
      return {
        project,
        touchedStructuredChapter: false,
        result: { opId: op.opId, type: op.type, status: 'blocked', message: `Chapter ${op.chapter.id} is outside scope guard.` },
      };
    }

    return {
      project: { ...project, chapters: upsertBy(project.chapters, op.chapter, (item) => item.id) },
      touchedStructuredChapter: (op.chapter.authoringMode || 'freeform') === 'structured',
      result: { opId: op.opId, type: op.type, status: 'applied', message: `Chapter ${op.chapter.id} upserted.` },
    };
  }

  if (op.type === 'upsertScenePackage') {
    if (!isChapterEditable(op.chapterId, scope?.editableChapterIds)) {
      return {
        project,
        touchedStructuredChapter: false,
        result: { opId: op.opId, type: op.type, status: 'blocked', message: `Chapter ${op.chapterId} is outside scope guard.` },
      };
    }
    if (!isSceneEditable(op.scenePackage.sceneId, scope?.editableSceneIds)) {
      return {
        project,
        touchedStructuredChapter: false,
        result: { opId: op.opId, type: op.type, status: 'blocked', message: `Scene ${op.scenePackage.sceneId} is outside scope guard.` },
      };
    }

    const nextChapters = project.chapters.map((chapter) => {
      if (chapter.id !== op.chapterId) return chapter;
      const nextScenePackages = upsertBy(chapter.scenePackages || [], op.scenePackage, (item) => item.sceneId);
      return { ...chapter, scenePackages: nextScenePackages };
    });

    return {
      project: { ...project, chapters: nextChapters },
      touchedStructuredChapter: true,
      result: { opId: op.opId, type: op.type, status: 'applied', message: `ScenePackage ${op.scenePackage.sceneId} upserted.` },
    };
  }

  if (op.type === 'deleteScenePackage') {
    if (!isChapterEditable(op.chapterId, scope?.editableChapterIds)) {
      return {
        project,
        touchedStructuredChapter: false,
        result: { opId: op.opId, type: op.type, status: 'blocked', message: `Chapter ${op.chapterId} is outside scope guard.` },
      };
    }
    if (!isSceneEditable(op.sceneId, scope?.editableSceneIds)) {
      return {
        project,
        touchedStructuredChapter: false,
        result: { opId: op.opId, type: op.type, status: 'blocked', message: `Scene ${op.sceneId} is outside scope guard.` },
      };
    }

    const nextChapters = project.chapters.map((chapter) => {
      if (chapter.id !== op.chapterId) return chapter;
      return {
        ...chapter,
        scenePackages: (chapter.scenePackages || []).filter((item) => item.sceneId !== op.sceneId),
      };
    });

    return {
      project: { ...project, chapters: nextChapters },
      touchedStructuredChapter: true,
      result: { opId: op.opId, type: op.type, status: 'applied', message: `ScenePackage ${op.sceneId} deleted.` },
    };
  }

  const unsupported = op as { opId: string; type: CodexPatchOperation['type'] };
  return {
    project,
    touchedStructuredChapter: false,
    result: { opId: unsupported.opId, type: unsupported.type, status: 'rejected', message: 'Unsupported op.' },
  };
};

export const shadowApplyCodexOps = (
  currentProject: StoryProject,
  artifact: CodexOpsArtifact,
  selectedOpIds?: string[],
): CodexOpsShadowResult => {
  const allow = selectedOpIds ? new Set(selectedOpIds) : null;
  let nextProject: StoryProject = structuredClone(currentProject);
  const opResults: OpApplyResult[] = [];
  let requiresDraftRebuild = false;

  artifact.operations.forEach((op) => {
    if (allow && !allow.has(op.opId)) {
      opResults.push({ opId: op.opId, type: op.type, status: 'rejected', message: 'Skipped by selection.' });
      return;
    }

    const applied = applyOperation(nextProject, op, artifact);
    nextProject = applied.project;
    requiresDraftRebuild = requiresDraftRebuild || applied.touchedStructuredChapter;
    opResults.push(applied.result);
  });

  const validatorIssues = validateProjectBranches(nextProject.chapters, nextProject.bible);
  const diff = diffWorkspaceBundles(buildWorkspaceBundle(currentProject), buildWorkspaceBundle(nextProject));

  return {
    project: nextProject,
    opResults,
    diff,
    validatorIssues,
    requiresDraftRebuild,
    unresolved: artifact.unresolved || [],
  };
};
