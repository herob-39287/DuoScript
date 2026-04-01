import { StoryProject } from '../../types';
import { normalizeProject } from '../bibleManager';
import { WorkspaceBundleSchema } from './schema';
import { WorkspaceImportResult } from './types';

export const parseWorkspaceBundle = (raw: unknown) => {
  return WorkspaceBundleSchema.parse(raw);
};

export const workspaceBundleToProject = (
  currentProject: StoryProject,
  raw: unknown,
): WorkspaceImportResult => {
  const bundle = parseWorkspaceBundle(raw);

  const next: StoryProject = normalizeProject({
    ...currentProject,
    meta: {
      ...currentProject.meta,
      ...bundle.project.meta,
      updatedAt: Date.now(),
    },
    bible: {
      ...bundle.project.bible,
      routes: bundle.project.vnDesign.routes,
      revealPlans: bundle.project.vnDesign.revealPlans,
      stateAxes: bundle.project.vnDesign.stateAxes,
      branchPolicies: bundle.project.vnDesign.branchPolicies,
    },
    chapters: bundle.project.chapters.map((chapter) => ({
      ...chapter,
      codexImportedAt: Date.now(),
    })),
  });

  return {
    project: next,
    bundle,
  };
};
