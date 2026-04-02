import { BranchValidationIssue } from '../validation/branchValidator';
import { WorkspaceBundle } from './types';

export type CodexTaskScope = {
  scopeType: 'project' | 'chapter' | 'scene';
  chapterId?: string;
  sceneId?: string;
  objective?: string;
  taskType?: 'route design' | 'scene package generation' | 'branch repair' | 'draft polish';
  expectedBranchLevel?: 'route' | 'chapter' | 'scene' | 'mixed';
  editableChapterIds?: string[];
  editableSceneIds?: string[];
  protectedPaths?: string[];
  expectedOutputs?: string[];
  focusIssueCodes?: string[];
  rebuildDraftExpected?: boolean;
};

const buildScopeLine = (scope: CodexTaskScope): string => {
  if (scope.scopeType === 'scene') {
    return `scene (${scope.chapterId || 'unknown chapter'} / ${scope.sceneId || 'unknown scene'})`;
  }
  if (scope.scopeType === 'chapter') {
    return `chapter (${scope.chapterId || 'unknown chapter'})`;
  }
  return 'project (full workspace)';
};

const detectDefaultTaskType = (
  scope: CodexTaskScope,
  issues: BranchValidationIssue[],
): NonNullable<CodexTaskScope['taskType']> => {
  if (scope.taskType) return scope.taskType;
  if (issues.length > 0) return 'branch repair';
  if (scope.scopeType === 'scene' || scope.scopeType === 'chapter') return 'scene package generation';
  return 'route design';
};

const buildFocusIssues = (
  issues: BranchValidationIssue[],
  scope: CodexTaskScope,
): string[] => {
  const requested = scope.focusIssueCodes || [];
  const issuePool = requested.length > 0 ? issues.filter((item) => requested.includes(item.code)) : issues;

  return issuePool.slice(0, 8).map((issue) => {
    const location = [issue.chapterId, issue.sceneId, issue.choiceId].filter(Boolean).join(' / ');
    return `- [${issue.level.toUpperCase()}] ${issue.code}: ${issue.message}${location ? ` (${location})` : ''}`;
  });
};

export const buildCodexTask = (
  bundle: WorkspaceBundle,
  scope: CodexTaskScope,
  issues: BranchValidationIssue[],
  generatedAt = Date.now(),
): string => {
  const chapter = scope.chapterId
    ? bundle.project.chapters.find((item) => item.id === scope.chapterId)
    : undefined;
  const scenePackage =
    scope.scopeType === 'scene' && scope.sceneId
      ? chapter?.scenePackages?.find((item) => item.sceneId === scope.sceneId)
      : undefined;

  const editableChapterIds = scope.editableChapterIds || bundle.project.chapters.map((item) => item.id);
  const editableSceneIds =
    scope.editableSceneIds ||
    (scope.scopeType === 'scene' && scope.sceneId
      ? [scope.sceneId]
      : scope.scopeType === 'chapter'
        ? (chapter?.scenePackages || []).map((item) => item.sceneId)
        : []);
  const expectedOutputs = scope.expectedOutputs || [
    'updated_workspace_bundle.json',
    'codex_change_summary.md',
  ];
  const focusIssues = buildFocusIssues(issues, scope);
  const taskType = detectDefaultTaskType(scope, issues);
  const rebuildDraftExpected =
    scope.rebuildDraftExpected ?? (taskType === 'scene package generation' || taskType === 'draft polish');

  return [
    '# codex_task.md',
    '',
    `Generated at: ${new Date(generatedAt).toISOString()}`,
    '',
    '## Objective',
    scope.objective ||
      'Improve VN route/scene branching quality while preserving canonical structure and validator compatibility.',
    '',
    '## Task type',
    `- ${taskType}`,
    `- Expected branch level: ${scope.expectedBranchLevel || scope.scopeType}`,
    '',
    '## Target scope',
    `- Scope: ${buildScopeLine(scope)}`,
    `- Project: ${bundle.project.meta.title} (${bundle.project.meta.id})`,
    ...(chapter ? [`- Chapter title: ${chapter.title}`] : []),
    ...(scenePackage?.title ? [`- Scene package title: ${scenePackage.title}`] : []),
    '',
    '## Scope guard',
    `- Editable chapter IDs: ${editableChapterIds.length > 0 ? editableChapterIds.join(', ') : 'none'}`,
    `- Editable scene IDs: ${editableSceneIds.length > 0 ? editableSceneIds.join(', ') : 'none'}`,
    ...(scope.protectedPaths?.length
      ? scope.protectedPaths.map((item) => `- Protected path: ${item}`)
      : ['- Protected path: chapters/scenes outside the provided scope']),
    '',
    '## Primary constraints',
    '- Treat `bible.routes`, `bible.revealPlans`, `bible.stateAxes`, `bible.branchPolicies`, `chapter.scenePackages` as canonical.',
    '- Treat `chapter.content` as cache/display output only.',
    '- Keep IDs stable unless explicit create/delete is requested.',
    '- Keep validator compatibility and branch convergence consistency.',
    '',
    '## Focus validator issues',
    ...(focusIssues.length > 0 ? focusIssues : ['- No current validator issues. Focus on quality improvements only.']),
    '',
    '## Expected touched entities',
    '- `project.bible.routes` / `project.bible.revealPlans` / `project.bible.stateAxes` / `project.bible.branchPolicies` (as needed)',
    '- `project.chapters[].scenePackages` in allowed scope only',
    '- Avoid broad rewrites to chapter prose unless explicitly requested',
    '',
    '## Expected outputs',
    ...expectedOutputs.map((item) => `- ${item}`),
    '',
    '## Rebuild expectation',
    `- Draft rebuild required after import: ${rebuildDraftExpected ? 'yes' : 'no'}`,
    '- Re-run branch validator after importing updated workspace.',
    '- Explicitly report unresolved validator issues in `codex_change_summary.md`.',
  ].join('\n');
};
