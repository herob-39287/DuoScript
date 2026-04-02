import { collectStateIdentifiers, tryEvaluateConditionExpression } from '../conditions';
import {
  BranchValidationIssue,
  validateProjectBranches as validateProjectBranchesCore,
} from '../scenePackage';
import { ChapterLog, WorldBible } from './schemas';

const normalizeStateKey = (value: string): string =>
  value.includes('.') ? value.split('.').slice(1).join('.') : value;

const extractUpdatedStateCandidates = (chapter: ChapterLog): Set<string> => {
  const updates = new Set<string>();

  for (const scene of chapter.scenePackages || []) {
    const lines = [
      ...scene.carryoverStateChanges,
      ...scene.choicePoints.flatMap((choice) => [
        ...choice.immediateEffects,
        ...choice.delayedEffects,
      ]),
    ];

    for (const line of lines) {
      const first = line.trim().split(/\s+/)[0] || '';
      if (!first) continue;
      updates.add(normalizeStateKey(first.replace(/[^A-Za-z0-9_.]/g, '')));
    }
  }

  return updates;
};

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
            code: 'WEAK_CHOICE',
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

const impossibleUnlockIssues = (
  bible: Pick<WorldBible, 'routes'>,
): BranchValidationIssue[] => {
  const issues: BranchValidationIssue[] = [];

  for (const route of bible.routes || []) {
    if (!route.unlockConditions) continue;
    const staticResult = tryEvaluateConditionExpression(route.unlockConditions, {});
    if (collectStateIdentifiers(route.unlockConditions).length === 0 && !staticResult) {
      issues.push({
        code: 'IMPOSSIBLE_UNLOCK_CONDITION',
        level: 'error',
        message: `Route ${route.routeId} has unlock condition that is always false: '${route.unlockConditions}'.`,
      });
    }
  }

  return issues;
};

const unreachableRouteIssues = (
  chapters: ChapterLog[],
  bible: Pick<WorldBible, 'routes'>,
): BranchValidationIssue[] => {
  const referencedRoutes = new Set<string>();
  chapters.forEach((chapter) => {
    (chapter.scenePackages || []).forEach((scene) => {
      if (scene.routeId) referencedRoutes.add(scene.routeId);
      scene.choicePoints.forEach((choice) => {
        if (choice.routeImpact) referencedRoutes.add(choice.routeImpact);
      });
    });
  });

  return (bible.routes || [])
    .filter((route) => route.enabledState)
    .filter((route) => !referencedRoutes.has(route.routeId))
    .map((route) => ({
      code: 'UNREACHABLE_ROUTE' as const,
      level: 'warning' as const,
      message: `Route ${route.routeId} is enabled but never referenced by scene packages/choice impacts.`,
    }));
};

const crossChapterDependencyIssues = (
  chapters: ChapterLog[],
  bible: Pick<WorldBible, 'stateAxes'>,
): BranchValidationIssue[] => {
  const chapterScopedStates = new Set(
    (bible.stateAxes || [])
      .filter((axis) => axis.scope === 'chapter')
      .map((axis) => axis.stateKey),
  );
  const seenUpdated = new Set<string>();
  const issues: BranchValidationIssue[] = [];

  for (const chapter of chapters) {
    const updatedInChapter = extractUpdatedStateCandidates(chapter);
    const referencedInChapter = new Set<string>();

    for (const scene of chapter.scenePackages || []) {
      if (scene.entryConditions) {
        collectStateIdentifiers(scene.entryConditions).forEach((id) =>
          referencedInChapter.add(normalizeStateKey(id)),
        );
      }
      for (const choice of scene.choicePoints) {
        if (choice.visibilityCondition) {
          collectStateIdentifiers(choice.visibilityCondition).forEach((id) =>
            referencedInChapter.add(normalizeStateKey(id)),
          );
        }
        if (choice.availabilityCondition) {
          collectStateIdentifiers(choice.availabilityCondition).forEach((id) =>
            referencedInChapter.add(normalizeStateKey(id)),
          );
        }
      }
    }

    referencedInChapter.forEach((stateKey) => {
      if (!chapterScopedStates.has(stateKey)) return;
      if (updatedInChapter.has(stateKey)) return;
      if (seenUpdated.has(stateKey)) return;
      issues.push({
        code: 'CROSS_CHAPTER_STATE_DEPENDENCY',
        level: 'warning',
        chapterId: chapter.id,
        stateKey,
        message: `Chapter ${chapter.id} references chapter-scoped state '${stateKey}' before any prior chapter updates it.`,
      });
    });

    updatedInChapter.forEach((stateKey) => seenUpdated.add(stateKey));
  }

  return issues;
};

const convergencePolicyIssues = (chapters: ChapterLog[]): BranchValidationIssue[] => {
  const issues: BranchValidationIssue[] = [];

  for (const chapter of chapters) {
    for (const scene of chapter.scenePackages || []) {
      if (!scene.convergencePoint) continue;
      for (const variant of scene.reactionVariants) {
        if (variant.convergencePolicy !== scene.convergencePoint.convergencePolicy) {
          issues.push({
            code: 'CONVERGENCE_POLICY_MISMATCH',
            level: 'warning',
            chapterId: chapter.id,
            sceneId: scene.sceneId,
            message: `Variant ${variant.variantId} convergencePolicy (${variant.convergencePolicy}) differs from convergencePoint (${scene.convergencePoint.convergencePolicy}).`,
          });
        }
      }
    }
  }

  return issues;
};

export const validateProjectBranches = (
  chapters: ChapterLog[],
  bible: Pick<WorldBible, 'stateAxes' | 'revealPlans' | 'routes'>,
): BranchValidationIssue[] => {
  return [
    ...validateProjectBranchesCore(chapters, bible),
    ...weakChoiceIssues(chapters),
    ...impossibleUnlockIssues(bible),
    ...unreachableRouteIssues(chapters, bible),
    ...crossChapterDependencyIssues(chapters, bible),
    ...convergencePolicyIssues(chapters),
  ];
};

export type { BranchValidationIssue };
