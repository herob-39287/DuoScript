export {
  upsertChoicePoint,
  upsertReactionVariant,
  setConvergencePoint,
  buildSceneBranchGraph,
  validateSceneBranching,
} from './editor';
export {
  buildScenePackageCanonicalText,
  compileChapterContentFromScenePackages,
  syncChapterCompiledContentFromScenePackages,
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
