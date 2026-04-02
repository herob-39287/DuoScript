import { BranchValidationIssue } from '../validation/branchValidator';

const formatIssueLine = (issue: BranchValidationIssue): string => {
  const scope = [issue.chapterId, issue.sceneId, issue.choiceId].filter(Boolean).join(' / ');
  const state = issue.stateKey ? ` [state: ${issue.stateKey}]` : '';
  return `- [${issue.level.toUpperCase()}] ${issue.code}: ${issue.message}${scope ? ` (${scope})` : ''}${state}`;
};

export const buildValidatorReport = (
  issues: BranchValidationIssue[],
  generatedAt = Date.now(),
): string => {
  const errorCount = issues.filter((issue) => issue.level === 'error').length;
  const warningCount = issues.filter((issue) => issue.level === 'warning').length;

  return [
    '# validator_report.md',
    '',
    `Generated at: ${new Date(generatedAt).toISOString()}`,
    '',
    '## Summary',
    `- Total issues: ${issues.length}`,
    `- Errors: ${errorCount}`,
    `- Warnings: ${warningCount}`,
    '',
    '## Issues',
    ...(issues.length > 0
      ? issues.map(formatIssueLine)
      : ['- No validator issues found. Ready for Codex edits.']),
    '',
    '## Required follow-up',
    '- Re-run branch validator after editing workspace artifacts.',
    '- Rebuild chapter draft from scene packages when branch/scene content changed.',
  ].join('\n');
};
