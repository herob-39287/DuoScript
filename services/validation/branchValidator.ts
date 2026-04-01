import { ChapterLog, WorldBible } from './schemas';
import {
  BranchValidationIssue,
  validateProjectBranches as validateProjectBranchesCore,
} from '../scenePackage';

const weakChoiceIssues = (chapters: ChapterLog[]): BranchValidationIssue[] => {
  const issues: BranchValidationIssue[] = [];

  for (const chapter of chapters) {
    for (const scene of chapter.scenePackages || []) {
      for (const choice of scene.choicePoints || []) {
        const hasSignal =
          Boolean(choice.availabilityCondition) ||
          Boolean(choice.visibilityCondition) ||
          (choice.immediateEffects?.length || 0) > 0 ||
          (choice.delayedEffects?.length || 0) > 0 ||
          Boolean(choice.routeImpact) ||
          Boolean(choice.unlockImpact);

        if (!hasSignal) {
          issues.push({
            code: 'UNREACHABLE_BRANCH',
            level: 'warning',
            chapterId: chapter.id,
            sceneId: scene.sceneId,
            choiceId: choice.choiceId,
            message: `Choice ${choice.choiceId} looks weak (no condition/effect/impact metadata).`,
          });
        }
      }
    }
  }

  return issues;
};

export const validateProjectBranches = (
  chapters: ChapterLog[],
  bible: Pick<WorldBible, 'stateAxes' | 'revealPlans'>,
): BranchValidationIssue[] => {
  return [...validateProjectBranchesCore(chapters, bible), ...weakChoiceIssues(chapters)];
};

export type { BranchValidationIssue };
