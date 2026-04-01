import {
  collectStateIdentifiers,
  lintConditionExpression,
  tryEvaluateConditionExpression,
} from '../conditions';
import {
  ChapterLog,
  ChoicePoint,
  ConditionExpression,
  RevealPlan,
  ScenePackage,
  StateAxis,
  WorldBible,
} from '../validation/schemas';
import { validateSceneBranching } from './editor';

export type BranchValidationIssue = {
  code:
    | 'UNREACHABLE_BRANCH'
    | 'CONDITION_CONFLICT'
    | 'UNUSED_STATE'
    | 'REFERENCED_NOT_UPDATED_STATE'
    | 'NON_CONVERGENT_BRANCH'
    | 'SPOILER_LEAKAGE'
    | 'ALWAYS_TRUE_CONDITION'
    | 'ALWAYS_FALSE_CONDITION'
    | 'CONDITION_TYPE_MISMATCH';
  level: 'error' | 'warning';
  chapterId?: string;
  sceneId?: string;
  choiceId?: string;
  stateKey?: string;
  message: string;
};

const isStaticExpression = (expression: string): boolean => {
  return collectStateIdentifiers(expression).length === 0;
};

const evaluateStaticExpression = (expression: ConditionExpression): boolean => {
  return tryEvaluateConditionExpression(expression, {});
};

const referencedStatesInChoice = (choice: ChoicePoint): string[] => {
  const refs = new Set<string>();
  if (choice.visibilityCondition) {
    for (const id of collectStateIdentifiers(choice.visibilityCondition)) refs.add(id);
  }
  if (choice.availabilityCondition) {
    for (const id of collectStateIdentifiers(choice.availabilityCondition)) refs.add(id);
  }
  return [...refs].map((ref) => (ref.includes('.') ? ref.split('.').slice(1).join('.') : ref));
};

const extractUpdatedStateCandidates = (scene: ScenePackage): Set<string> => {
  const updates = new Set<string>();
  const lines = [
    ...scene.carryoverStateChanges,
    ...scene.choicePoints.flatMap((c) => [...c.immediateEffects, ...c.delayedEffects]),
  ];

  for (const line of lines) {
    const first = line.trim().split(/\s+/)[0] || '';
    if (first) updates.add(first.replace(/[^A-Za-z0-9_.]/g, ''));
  }

  return updates;
};

const detectSpoilerLeakage = (
  scene: ScenePackage,
  revealPlans: RevealPlan[],
): BranchValidationIssue[] => {
  if (!scene.routeId) return [];

  const issues: BranchValidationIssue[] = [];
  const revealed = new Set(scene.reactionVariants.flatMap((variant) => variant.revealedInfo));

  for (const infoKey of revealed) {
    const plan = revealPlans.find((r) => r.informationKey === infoKey);
    if (!plan) continue;
    if (!plan.allowedRoutes.includes(scene.routeId)) {
      issues.push({
        code: 'SPOILER_LEAKAGE',
        level: 'error',
        sceneId: scene.sceneId,
        message: `Info '${infoKey}' is revealed in route '${scene.routeId}' but reveal plan disallows it.`,
      });
    }
  }

  return issues;
};

export const validateSceneBranches = (
  scene: ScenePackage,
  bible: Pick<WorldBible, 'stateAxes' | 'revealPlans'>,
  chapterId?: string,
): BranchValidationIssue[] => {
  const issues: BranchValidationIssue[] = [];

  for (const branchIssue of validateSceneBranching(scene)) {
    const code =
      branchIssue.code === 'CONVERGENCE_TARGET_MISMATCH' ||
      branchIssue.code === 'MISSING_CONVERGENCE_POINT'
        ? 'NON_CONVERGENT_BRANCH'
        : 'UNREACHABLE_BRANCH';
    issues.push({
      code,
      level: 'error',
      chapterId,
      sceneId: scene.sceneId,
      choiceId: branchIssue.choiceId,
      message: branchIssue.message,
    });
  }

  const variantIds = new Set(scene.reactionVariants.map((v) => v.variantId));
  for (const choice of scene.choicePoints) {
    const variantId = choice.reactionVariantId || choice.immediateReactionVariantId;
    if (variantId && !variantIds.has(variantId)) {
      issues.push({
        code: 'UNREACHABLE_BRANCH',
        level: 'error',
        chapterId,
        sceneId: scene.sceneId,
        choiceId: choice.choiceId,
        message: `Choice ${choice.choiceId} references unknown variant '${variantId}'.`,
      });
    }

    for (const cond of [choice.visibilityCondition, choice.availabilityCondition]) {
      if (!cond) continue;

      for (const lintIssue of lintConditionExpression(cond, bible.stateAxes || [])) {
        if (lintIssue.code === 'UNKNOWN_IDENTIFIER') continue;
        issues.push({
          code: 'CONDITION_TYPE_MISMATCH',
          level: 'error',
          chapterId,
          sceneId: scene.sceneId,
          choiceId: choice.choiceId,
          message: lintIssue.message,
        });
      }

      if (!isStaticExpression(cond)) continue;
      const value = evaluateStaticExpression(cond);
      issues.push({
        code: value ? 'ALWAYS_TRUE_CONDITION' : 'ALWAYS_FALSE_CONDITION',
        level: 'warning',
        chapterId,
        sceneId: scene.sceneId,
        choiceId: choice.choiceId,
        message: `Choice ${choice.choiceId} has static condition '${cond}'.`,
      });
      if (!value) {
        issues.push({
          code: 'CONDITION_CONFLICT',
          level: 'error',
          chapterId,
          sceneId: scene.sceneId,
          choiceId: choice.choiceId,
          message: `Choice ${choice.choiceId} condition is always false: '${cond}'.`,
        });
      }
    }
  }

  const stateAxes = bible.stateAxes || [];
  const knownStates = new Set(stateAxes.map((s) => s.stateKey));
  const updatedStates = extractUpdatedStateCandidates(scene);
  const referencedStates = new Set<string>();

  if (scene.entryConditions) {
    for (const lintIssue of lintConditionExpression(scene.entryConditions, bible.stateAxes || [])) {
      if (lintIssue.code === 'UNKNOWN_IDENTIFIER') continue;
      issues.push({
        code: 'CONDITION_TYPE_MISMATCH',
        level: 'error',
        chapterId,
        sceneId: scene.sceneId,
        message: lintIssue.message,
      });
    }

    for (const id of collectStateIdentifiers(scene.entryConditions)) {
      referencedStates.add(id.includes('.') ? id.split('.').slice(1).join('.') : id);
    }
  }
  for (const choice of scene.choicePoints) {
    for (const state of referencedStatesInChoice(choice)) referencedStates.add(state);
  }

  for (const state of referencedStates) {
    if (!knownStates.has(state)) {
      issues.push({
        code: 'CONDITION_CONFLICT',
        level: 'error',
        chapterId,
        sceneId: scene.sceneId,
        stateKey: state,
        message: `Referenced state '${state}' is not defined in stateAxes.`,
      });
    }
    if (!updatedStates.has(state)) {
      issues.push({
        code: 'REFERENCED_NOT_UPDATED_STATE',
        level: 'warning',
        chapterId,
        sceneId: scene.sceneId,
        stateKey: state,
        message: `Referenced state '${state}' is not updated by this scene package.`,
      });
    }
  }

  issues.push(...detectSpoilerLeakage(scene, bible.revealPlans || []));

  return issues;
};

export const validateChapterBranches = (
  chapter: ChapterLog,
  bible: Pick<WorldBible, 'stateAxes' | 'revealPlans'>,
): BranchValidationIssue[] => {
  const scenePackages = chapter.scenePackages || [];
  return scenePackages.flatMap((scene) => validateSceneBranches(scene, bible, chapter.id));
};

export const validateProjectBranches = (
  chapters: ChapterLog[],
  bible: Pick<WorldBible, 'stateAxes' | 'revealPlans'>,
): BranchValidationIssue[] => {
  const issues = chapters.flatMap((chapter) => validateChapterBranches(chapter, bible));

  const referenced = new Set(
    issues
      .filter((i) => i.stateKey)
      .map((i) => i.stateKey as string)
      .filter(Boolean),
  );

  for (const axis of bible.stateAxes || []) {
    if (!referenced.has(axis.stateKey)) {
      issues.push({
        code: 'UNUSED_STATE',
        level: 'warning',
        stateKey: axis.stateKey,
        message: `State axis '${axis.stateKey}' is never referenced by branch conditions.`,
      });
    }
  }

  return issues;
};
