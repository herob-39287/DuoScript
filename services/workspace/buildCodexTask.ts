import { BranchValidationIssue } from '../validation/branchValidator';
import { WorkspaceBundle } from './types';
import { CodexResponseMode, CodexTaskType } from './patchTypes';

export type CodexTaskScope = {
  scopeType: 'project' | 'chapter' | 'scene';
  chapterId?: string;
  sceneId?: string;
  objective?: string;
  taskType?: CodexTaskType;
  responseMode?: CodexResponseMode;
  expectedBranchLevel?: 'route' | 'chapter' | 'scene' | 'mixed';
  editableChapterIds?: string[];
  editableSceneIds?: string[];
  protectedPaths?: string[];
  expectedOutputs?: string[];
  focusIssueCodes?: string[];
  rebuildDraftExpected?: boolean;
  expectedTouchedEntities?: string[];
  doNotChange?: string[];
  preferredOutputGranularity?: 'project' | 'chapter' | 'scene';
  unresolved?: string[];
  recentChangeSummary?: string[];
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
  if (scope.scopeType === 'scene' || scope.scopeType === 'chapter')
    return 'scene package generation';
  return 'route design';
};

const detectDefaultResponseMode = (scope: CodexTaskScope): CodexResponseMode => {
  if (scope.responseMode) return scope.responseMode;
  if (scope.taskType === 'project genesis') return 'questions';
  return scope.scopeType === 'project' ? 'bundle' : 'ops';
};

const getFocusedIssues = (
  issues: BranchValidationIssue[],
  scope: CodexTaskScope,
): BranchValidationIssue[] => {
  const requested = scope.focusIssueCodes || [];
  const issuePool =
    requested.length > 0 ? issues.filter((item) => requested.includes(item.code)) : issues;
  return issuePool.slice(0, 8);
};

const buildFocusIssueLines = (issues: BranchValidationIssue[]): string[] => {
  return issues.map((issue) => {
    const location = [issue.chapterId, issue.sceneId, issue.choiceId].filter(Boolean).join(' / ');
    return `- [${issue.level.toUpperCase()}] ${issue.code}: ${issue.message}${location ? ` (${location})` : ''}`;
  });
};

const ISSUE_CHECKLIST: Record<string, string> = {
  UNKNOWN_STATE_REFERENCE:
    'StateAxis に存在しないキー参照を追加せず、条件/effects のキーを正規キーに合わせる。',
  CONDITION_TYPE_MISMATCH:
    'Condition の比較値型を StateAxis 型（number/boolean/string）に一致させる。',
  CONDITION_CONFLICT: '同一 choice/scene 内の条件矛盾を解消し、到達不能分岐を残さない。',
  SPOILER_LEAKAGE: 'reveal 条件と variant 文脈を見直し、未解禁情報が露出しないようにする。',
  UNREACHABLE_BRANCH:
    'entry/visibility/availability 条件を調整し、少なくとも1経路で到達可能にする。',
  WEAK_CHOICE:
    'choice に condition/effect/routeImpact/unlockImpact のいずれかを与えて意味差を作る。',
  CONVERGENCE_POLICY_MISMATCH: 'variant と convergencePoint の convergencePolicy を一致させる。',
  CONVERGENCE_TARGET_MISMATCH:
    'choice の convergenceTarget と scene convergencePoint の整合を取る。',
  MISSING_CONVERGENCE_POINT: '分岐が発生する scene には convergencePoint を定義する。',
  LOCAL_BRANCH_MISSING_CONVERGENCE_TARGET: 'local branch choice に convergenceTarget を設定する。',
  LOCAL_BRANCH_MISSING_VARIANT:
    'reactionVariantId / immediateReactionVariantId の未解決参照を解消する。',
  IMPOSSIBLE_UNLOCK_CONDITION: '常に false になる unlockConditions を修正する。',
  UNREACHABLE_ROUTE: 'enabled route が scene/choice の route 参照から到達可能になるよう接続する。',
  CROSS_CHAPTER_STATE_DEPENDENCY:
    'chapter scope state は参照前に先行章で更新される流れへ修正する。',
  REFERENCED_NOT_UPDATED_STATE: '参照する state が未更新にならないよう carryover/effects を補う。',
};

const buildIssueChecklistLines = (issues: BranchValidationIssue[]): string[] => {
  const uniqueCodes = [...new Set(issues.map((item) => item.code))];
  if (uniqueCodes.length === 0) {
    return ['- 現在 issue なし。設計品質改善（弱い選択肢・分岐密度・収束明瞭性）を優先する。'];
  }

  return uniqueCodes.map(
    (code) =>
      `- ${code}: ${ISSUE_CHECKLIST[code] || '対象 issue の再現条件を保ったまま、最小差分で修正する。'}`,
  );
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

  const editableChapterIds =
    scope.editableChapterIds || bundle.project.chapters.map((item) => item.id);
  const editableSceneIds =
    scope.editableSceneIds ||
    (scope.scopeType === 'scene' && scope.sceneId
      ? [scope.sceneId]
      : scope.scopeType === 'chapter'
        ? (chapter?.scenePackages || []).map((item) => item.sceneId)
        : []);
  const expectedOutputs = scope.expectedOutputs || [
    ...(detectDefaultResponseMode(scope) === 'questions'
      ? ['codex_questions.md']
      : detectDefaultResponseMode(scope) === 'ops'
        ? ['codex_ops.json', 'codex_change_summary.md']
        : ['updated_workspace_bundle.json', 'codex_change_summary.md']),
  ];
  const focusedIssues = getFocusedIssues(issues, scope);
  const focusIssueLines = buildFocusIssueLines(focusedIssues);
  const issueChecklistLines = buildIssueChecklistLines(focusedIssues);
  const taskType = detectDefaultTaskType(scope, issues);
  const responseMode = detectDefaultResponseMode(scope);
  const rebuildDraftExpected =
    scope.rebuildDraftExpected ??
    (taskType === 'scene package generation' || taskType === 'draft polish');
  const touchedEntities = scope.expectedTouchedEntities || [
    '`project.bible.routes` / `project.bible.revealPlans` / `project.bible.stateAxes` / `project.bible.branchPolicies` (as needed)',
    '`project.chapters[].scenePackages` in allowed scope only',
    'validator-related `choices` / `variants` / `convergence` links in allowed scope',
  ];
  const doNotChange = scope.doNotChange || [
    'chapter/scene IDs outside scope guard',
    'global prose rewrite (`chapter.draftText` / `chapter.compiledContent`) unless explicitly requested',
    'unrelated routes or state axes with no task/validator impact',
  ];

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
    `- Response mode: ${responseMode}`,
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
    '- Prefer minimal diffs in scope when response mode is `ops`.',
    '',
    '## Primary constraints',
    '- Treat `bible.routes`, `bible.revealPlans`, `bible.stateAxes`, `bible.branchPolicies`, `chapter.scenePackages` as canonical.',
    '- For `structured` chapters: treat `chapter.scenePackages` as canonical and `chapter.compiledContent` as cache/display output.',
    '- For `freeform` chapters: treat `chapter.draftText` as canonical prose source.',
    '- Keep IDs stable unless explicit create/delete is requested.',
    '- Keep validator compatibility and branch convergence consistency.',
    '',
    '## Focus validator issues',
    ...(focusIssueLines.length > 0
      ? focusIssueLines
      : ['- No current validator issues. Focus on quality improvements only.']),
    '',
    '## Validator issue-driven checklist',
    ...issueChecklistLines,
    '',
    '## Expected touched entities',
    ...touchedEntities.map((item) => `- ${item}`),
    '',
    '## Do not change',
    ...doNotChange.map((item) => `- ${item}`),
    '',
    '## Preferred output granularity',
    `- ${scope.preferredOutputGranularity || scope.scopeType}`,
    '- Prefer minimal diffs that satisfy validator and scope objective.',
    '',
    '## Expected outputs',
    ...expectedOutputs.map((item) => `- ${item}`),
    '',
    '## Session context',
    `- taskType: ${taskType}`,
    `- responseMode: ${responseMode}`,
    ...(scope.recentChangeSummary?.length
      ? ['- recent changes:', ...scope.recentChangeSummary.map((item) => `  - ${item}`)]
      : ['- recent changes: (none provided)']),
    ...(scope.unresolved?.length
      ? ['- unresolved:', ...scope.unresolved.map((item) => `  - ${item}`)]
      : ['- unresolved: (none)']),
    `- editable scope: chapters=${editableChapterIds.length}, scenes=${editableSceneIds.length}`,
    '',
    '## Draft rebuild expectation',
    `- Draft rebuild required after import: ${rebuildDraftExpected ? 'yes' : 'no'}`,
    '- Re-run branch validator after importing updated workspace.',
    '',
    '## If unresolved, explain why',
    '- Do not silently drop failing structures or IDs.',
    '- In `codex_change_summary.md`, list unresolved issues with concrete reason, impact, and next action.',
  ].join('\n');
};
