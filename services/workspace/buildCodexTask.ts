import { StoryProject } from '../../types';

export type CodexTaskScope = {
  scopeType: 'project' | 'chapter' | 'scene';
  chapterId?: string;
  sceneId?: string;
  objective?: string;
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

export const buildCodexTask = (
  project: StoryProject,
  scope: CodexTaskScope,
  generatedAt = Date.now(),
): string => {
  const chapter = scope.chapterId
    ? project.chapters.find((item) => item.id === scope.chapterId)
    : undefined;

  return [
    '# codex_task.md',
    '',
    `Generated at: ${new Date(generatedAt).toISOString()}`,
    '',
    '## Objective',
    scope.objective ||
      'Improve VN route/scene branching quality while preserving canonical structure and validator compatibility.',
    '',
    '## Target scope',
    `- Scope: ${buildScopeLine(scope)}`,
    `- Project: ${project.meta.title} (${project.meta.id})`,
    ...(chapter ? [`- Chapter title: ${chapter.title}`] : []),
    '',
    '## Editable files',
    '- workspace_bundle.json',
    '- route_scope.json / chapter_scope.json / scene_scope.json (if included)',
    '',
    '## Do not edit',
    '- Unrelated chapters/scenes outside the provided scope',
    '- Metadata fields not needed for VN design edits',
    '',
    '## VN structure requirements',
    '- Treat `bible.routes`, `bible.revealPlans`, `bible.stateAxes`, `bible.branchPolicies`, `chapter.scenePackages` as canonical.',
    '- Treat `chapter.content` as cache/display output only.',
    '',
    '## Mandatory validation before returning output',
    '- Re-run branch validation assumptions and remove unknown variant references.',
    '- Ensure convergence policies and targets are consistent.',
    '- Ensure condition expressions respect declared state axis types.',
    '',
    '## Expected output',
    '- updated_workspace_bundle.json',
    '- codex_change_summary.md (what changed and why)',
  ].join('\n');
};
