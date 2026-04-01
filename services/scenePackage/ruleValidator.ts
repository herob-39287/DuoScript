import { collectStateIdentifiers, lintConditionExpression } from '../conditions';
import { ChapterLog, ScenePackage, StateAxis, WorldBible } from '../validation/schemas';
import { validateSceneBranching } from './editor';

export type ChapterRuleIssue = {
  code:
    | 'DUPLICATE_SCENE_ID'
    | 'SCENE_BRANCH'
    | 'UNKNOWN_STATE_REFERENCE'
    | 'MANDATORY_INFO_NOT_REFLECTED'
    | 'CONDITION_TYPE_MISMATCH';
  level: 'error' | 'warning';
  chapterId: string;
  sceneId?: string;
  message: string;
};

const includesLoose = (haystack: string, needle: string): boolean => {
  if (!needle) return true;
  return haystack.toLowerCase().includes(needle.toLowerCase());
};

const validateMandatoryInfo = (chapterId: string, scene: ScenePackage): ChapterRuleIssue[] => {
  const text = [
    scene.sharedSpine.intro,
    scene.sharedSpine.conflict,
    scene.sharedSpine.deepen,
    scene.sharedSpine.preChoiceBeat,
    scene.sharedSpine.close,
    ...scene.reactionVariants.flatMap((v) => v.responseBlocks),
  ]
    .filter(Boolean)
    .join('\n');

  return scene.mandatoryInfo
    .filter((item) => !includesLoose(text, item))
    .map((item) => ({
      code: 'MANDATORY_INFO_NOT_REFLECTED' as const,
      level: 'warning' as const,
      chapterId,
      sceneId: scene.sceneId,
      message: `mandatoryInfo '${item}' is not reflected in scene text blocks.`,
    }));
};

const validateStateReferences = (
  chapterId: string,
  scene: ScenePackage,
  stateAxes: StateAxis[],
): ChapterRuleIssue[] => {
  const known = new Set(stateAxes.map((s) => s.stateKey));
  const refs = new Set<string>();

  if (scene.entryConditions) {
    for (const id of collectStateIdentifiers(scene.entryConditions)) refs.add(id);
  }

  for (const choice of scene.choicePoints) {
    if (choice.visibilityCondition) {
      for (const id of collectStateIdentifiers(choice.visibilityCondition)) refs.add(id);
    }
    if (choice.availabilityCondition) {
      for (const id of collectStateIdentifiers(choice.availabilityCondition)) refs.add(id);
    }
  }

  const issues: ChapterRuleIssue[] = [];
  for (const ref of refs) {
    const normalized = ref.includes('.') ? ref.split('.').slice(1).join('.') : ref;
    if (!known.has(normalized)) {
      issues.push({
        code: 'UNKNOWN_STATE_REFERENCE',
        level: 'error',
        chapterId,
        sceneId: scene.sceneId,
        message: `Condition references unknown state '${ref}'.`,
      });
    }
  }

  return issues;
};

const validateConditionTypeSafety = (
  chapterId: string,
  scene: ScenePackage,
  stateAxes: StateAxis[],
): ChapterRuleIssue[] => {
  const conditions = [
    scene.entryConditions,
    ...scene.choicePoints.flatMap((choice) => [
      choice.visibilityCondition,
      choice.availabilityCondition,
    ]),
  ].filter(Boolean) as string[];

  return conditions.flatMap((condition) =>
    lintConditionExpression(condition, stateAxes)
      .filter((issue) => issue.code !== 'UNKNOWN_IDENTIFIER')
      .map((issue) => ({
        code: 'CONDITION_TYPE_MISMATCH' as const,
        level: 'error' as const,
        chapterId,
        sceneId: scene.sceneId,
        message: issue.message,
      })),
  );
};

export const validateChapterScenePackages = (
  chapter: ChapterLog,
  bible: Pick<WorldBible, 'stateAxes'>,
): ChapterRuleIssue[] => {
  const issues: ChapterRuleIssue[] = [];
  const scenePackages = chapter.scenePackages || [];

  const seen = new Set<string>();
  for (const scene of scenePackages) {
    if (seen.has(scene.sceneId)) {
      issues.push({
        code: 'DUPLICATE_SCENE_ID',
        level: 'error',
        chapterId: chapter.id,
        sceneId: scene.sceneId,
        message: `Duplicate sceneId '${scene.sceneId}' found in chapter.`,
      });
    }
    seen.add(scene.sceneId);

    for (const branchIssue of validateSceneBranching(scene)) {
      issues.push({
        code: 'SCENE_BRANCH',
        level: 'error',
        chapterId: chapter.id,
        sceneId: scene.sceneId,
        message: branchIssue.message,
      });
    }

    issues.push(...validateStateReferences(chapter.id, scene, bible.stateAxes || []));
    issues.push(...validateConditionTypeSafety(chapter.id, scene, bible.stateAxes || []));
    issues.push(...validateMandatoryInfo(chapter.id, scene));
  }

  return issues;
};
