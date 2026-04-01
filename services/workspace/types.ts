import { ChapterLog, StoryProject, StoryProjectMetadata, WorldBible } from '../../types';

export const WORKSPACE_BUNDLE_VERSION = 1 as const;

export type WorkspaceValidationIssue = {
  code: string;
  level: 'error' | 'warning';
  chapterId?: string;
  sceneId?: string;
  choiceId?: string;
  stateKey?: string;
  message: string;
};

export type ValidatorReport = {
  generatedAt: number;
  issues: WorkspaceValidationIssue[];
};

export type WorkspaceVNDesign = {
  routes: WorldBible['routes'];
  revealPlans: WorldBible['revealPlans'];
  stateAxes: WorldBible['stateAxes'];
  branchPolicies: WorldBible['branchPolicies'];
};

export type WorkspaceBundle = {
  kind: 'duoscript.workspace';
  version: number;
  exportedAt: number;
  project: {
    meta: Pick<
      StoryProjectMetadata,
      'id' | 'title' | 'author' | 'genre' | 'language' | 'updatedAt'
    >;
    bible: WorldBible;
    chapters: ChapterLog[];
    vnDesign: WorkspaceVNDesign;
    reports: ValidatorReport[];
  };
};

export type WorkspaceImportResult = {
  project: StoryProject;
  bundle: WorkspaceBundle;
};
