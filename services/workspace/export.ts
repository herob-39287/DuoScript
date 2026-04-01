import { StoryProject } from '../../types';
import { validateProjectBranches } from '../validation/branchValidator';
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

export const serializeWorkspaceBundle = (bundle: WorkspaceBundle): string => {
  return JSON.stringify(bundle, null, 2);
};
