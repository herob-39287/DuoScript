import { describe, expect, it } from 'vitest';
import {
  buildSceneBranchGraph,
  setConvergencePoint,
  upsertChoicePoint,
  upsertReactionVariant,
  validateSceneBranching,
} from './editor';

const baseScenePackage = () =>
  ({
    sceneId: 'scene-1',
    title: '再会',
    chapterId: 'ch-1',
    involvedCharacterIds: ['a', 'b'],
    purpose: '関係変化',
    mandatoryInfo: [],
    exitEffects: [],
    sharedSpine: { intro: '', conflict: '', deepen: '', preChoiceBeat: '', close: '' },
    choicePoints: [],
    reactionVariants: [],
    carryoverStateChanges: [],
    status: 'Idea',
  }) as any;

describe('scenePackage editor utilities (P3)', () => {
  it('upserts choice and reaction variant', () => {
    const scene = baseScenePackage();

    const withChoice = upsertChoicePoint(scene, {
      choiceId: 'c1',
      text: '受け入れる',
      branchLevel: 'local_branch',
      intentTag: 'accept',
      immediateEffects: [],
      delayedEffects: [],
      reactionVariantId: 'v1',
      convergenceTarget: 'merge-1',
    } as any);

    const withVariant = upsertReactionVariant(withChoice, {
      variantId: 'v1',
      trigger: 'accept',
      affectedStates: [],
      toneShift: 'warm',
      revealedInfo: [],
      responseBlocks: ['...'],
      convergencePolicy: 'merge_text_only',
    } as any);

    expect(withVariant.choicePoints).toHaveLength(1);
    expect(withVariant.reactionVariants).toHaveLength(1);
  });

  it('builds branch graph with merge node', () => {
    let scene = baseScenePackage();
    scene = upsertChoicePoint(scene, {
      choiceId: 'c1',
      text: '質問する',
      branchLevel: 'local_branch',
      intentTag: 'ask',
      immediateEffects: [],
      delayedEffects: [],
      reactionVariantId: 'v1',
      convergenceTarget: 'merge-1',
    } as any);
    scene = upsertReactionVariant(scene, {
      variantId: 'v1',
      trigger: 'ask',
      affectedStates: [],
      toneShift: 'tense',
      revealedInfo: [],
      responseBlocks: ['...'],
      convergencePolicy: 'keep_state',
    } as any);
    scene = setConvergencePoint(scene, {
      convergenceId: 'conv-1',
      sceneId: 'scene-1',
      targetBlockId: 'merge-1',
      convergencePolicy: 'keep_state',
    } as any);

    const graph = buildSceneBranchGraph(scene);

    expect(graph.nodes.some((n) => n.id === 'choice:c1')).toBe(true);
    expect(graph.nodes.some((n) => n.id === 'variant:v1')).toBe(true);
    expect(graph.nodes.some((n) => n.id === 'merge:merge-1')).toBe(true);
  });

  it('flags convergence issues for invalid local branches', () => {
    const scene = upsertChoicePoint(baseScenePackage(), {
      choiceId: 'c1',
      text: '曖昧',
      branchLevel: 'local_branch',
      intentTag: 'none',
      immediateEffects: [],
      delayedEffects: [],
      convergenceTarget: '',
    } as any);

    const issues = validateSceneBranching(scene);

    expect(issues.some((i) => i.code === 'LOCAL_BRANCH_MISSING_CONVERGENCE_TARGET')).toBe(true);
    expect(issues.some((i) => i.code === 'LOCAL_BRANCH_MISSING_VARIANT')).toBe(true);
    expect(issues.some((i) => i.code === 'MISSING_CONVERGENCE_POINT')).toBe(true);
  });
});
