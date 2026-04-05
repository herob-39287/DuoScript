import { BranchValidationIssue } from '../validation/branchValidator';
import { StoryProject, ChapterLog, ScenePackage, Route, RevealPlan, StateAxis, BranchPolicy } from '../../types';
import { WorkspaceDiff } from './diff';

export type CodexResponseMode = 'questions' | 'ops' | 'bundle';
export type CodexTaskType =
  | 'route design'
  | 'scene package generation'
  | 'branch repair'
  | 'draft polish'
  | 'project genesis'
  | 'interactive refinement';

export type SetProjectFieldOp = {
  type: 'setProjectField';
  opId: string;
  path: 'meta.title' | 'meta.author' | 'meta.genre' | 'bible.setting';
  value: string;
  reason?: string;
};

export type UpsertStateAxisOp = {
  type: 'upsertStateAxis';
  opId: string;
  axis: StateAxis;
  reason?: string;
};

export type UpsertRouteOp = {
  type: 'upsertRoute';
  opId: string;
  route: Route;
  reason?: string;
};

export type UpsertRevealPlanOp = {
  type: 'upsertRevealPlan';
  opId: string;
  revealPlan: RevealPlan;
  reason?: string;
};

export type UpsertBranchPolicyOp = {
  type: 'upsertBranchPolicy';
  opId: string;
  policy: BranchPolicy;
  reason?: string;
};

export type UpsertChapterOp = {
  type: 'upsertChapter';
  opId: string;
  chapter: ChapterLog;
  reason?: string;
};

export type UpsertScenePackageOp = {
  type: 'upsertScenePackage';
  opId: string;
  chapterId: string;
  scenePackage: ScenePackage;
  reason?: string;
};

export type DeleteScenePackageOp = {
  type: 'deleteScenePackage';
  opId: string;
  chapterId: string;
  sceneId: string;
  reason?: string;
};

export type CodexPatchOperation =
  | SetProjectFieldOp
  | UpsertStateAxisOp
  | UpsertRouteOp
  | UpsertRevealPlanOp
  | UpsertBranchPolicyOp
  | UpsertChapterOp
  | UpsertScenePackageOp
  | DeleteScenePackageOp;

export type CodexScopeGuard = {
  editableChapterIds?: string[];
  editableSceneIds?: string[];
  protectedPaths?: string[];
};

export type CodexOpsArtifact = {
  kind: 'duoscript.codex.ops';
  version: 1;
  generatedAt: number;
  taskType: CodexTaskType;
  responseMode: 'ops';
  scopeGuard?: CodexScopeGuard;
  operations: CodexPatchOperation[];
  unresolved?: string[];
};

export type CodexQuestionsArtifact = {
  kind: 'duoscript.codex.questions';
  version: 1;
  generatedAt: number;
  taskType: CodexTaskType;
  responseMode: 'questions';
  questions: string[];
};

export type OpApplyStatus = 'applied' | 'rejected' | 'blocked';

export type OpApplyResult = {
  opId: string;
  type: CodexPatchOperation['type'];
  status: OpApplyStatus;
  message: string;
};

export type CodexOpsShadowResult = {
  project: StoryProject;
  opResults: OpApplyResult[];
  diff: WorkspaceDiff;
  validatorIssues: BranchValidationIssue[];
  requiresDraftRebuild: boolean;
  unresolved: string[];
};
