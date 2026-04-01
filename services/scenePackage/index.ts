export {
  upsertChoicePoint,
  upsertReactionVariant,
  setConvergencePoint,
  buildSceneBranchGraph,
  validateSceneBranching,
} from './editor';
export {
  buildScenePackageCanonicalText,
  buildChapterDraftFromScenePackages,
  syncChapterContentFromScenePackages,
  detectChapterContentDrift,
} from './chapterAssembler';
export { validateChapterScenePackages } from './ruleValidator';
export {
  validateSceneBranches,
  validateChapterBranches,
  validateProjectBranches,
} from './branchValidator';

export type { BranchGraph, BranchGraphEdge, BranchGraphNode, SceneBranchIssue } from './editor';
export type { ChapterRuleIssue } from './ruleValidator';
export type { BranchValidationIssue } from './branchValidator';
