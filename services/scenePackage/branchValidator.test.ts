import { describe, expect, it } from 'vitest';
import { validateProjectBranches, validateSceneBranches } from './branchValidator';

const makeScene = () =>
  ({
    sceneId: 's1',
    title: 'scene',
    chapterId: 'ch1',
    routeId: 'common',
    involvedCharacterIds: [],
    purpose: 'test',
    mandatoryInfo: [],
    entryConditions: 'global.trust >= 1',
    exitEffects: [],
    sharedSpine: { intro: '', conflict: '', deepen: '', preChoiceBeat: '', close: '' },
    choicePoints: [
      {
        choiceId: 'c1',
        text: 'x',
        branchLevel: 'local_branch',
        intentTag: 'test',
        immediateEffects: ['trust +1'],
        delayedEffects: [],
        reactionVariantId: 'v1',
        convergenceTarget: 'merge-1',
        visibilityCondition: '1 == 2',
      },
    ],
    reactionVariants: [
      {
        variantId: 'v1',
        trigger: 'test',
        affectedStates: [],
        toneShift: 'neutral',
        revealedInfo: ['secretA'],
        responseBlocks: ['...'],
        convergencePolicy: 'keep_state',
      },
    ],
    convergencePoint: {
      convergenceId: 'cv1',
      sceneId: 's1',
      targetBlockId: 'merge-1',
      convergencePolicy: 'keep_state',
    },
    carryoverStateChanges: [],
    status: 'Idea',
  }) as any;

describe('branch validator (P5)', () => {
  it('detects always-false condition and condition conflict', () => {
    const scene = makeScene();
    const issues = validateSceneBranches(
      scene,
      {
        stateAxes: [{ stateKey: 'trust' }],
        revealPlans: [{ informationKey: 'secretA', allowedRoutes: ['locked-route'] }],
      } as any,
      'ch1',
    );

    expect(issues.some((i) => i.code === 'ALWAYS_FALSE_CONDITION')).toBe(true);
    expect(issues.some((i) => i.code === 'CONDITION_CONFLICT')).toBe(true);
    expect(issues.some((i) => i.code === 'SPOILER_LEAKAGE')).toBe(true);
  });

  it('detects referenced-not-updated and unknown state', () => {
    const scene = makeScene();
    scene.entryConditions = 'global.unknown_flag == true';

    const issues = validateSceneBranches(
      scene,
      {
        stateAxes: [{ stateKey: 'trust' }],
        revealPlans: [],
      } as any,
    );

    expect(issues.some((i) => i.code === 'REFERENCED_NOT_UPDATED_STATE')).toBe(true);
    expect(issues.some((i) => i.code === 'CONDITION_CONFLICT' && i.stateKey === 'unknown_flag')).toBe(
      true,
    );
  });

  it('detects project-level unused states', () => {
    const scene = makeScene();
    const chapter = { id: 'ch1', scenePackages: [scene] } as any;

    const issues = validateProjectBranches(
      [chapter],
      {
        stateAxes: [{ stateKey: 'trust' }, { stateKey: 'unused_axis' }],
        revealPlans: [],
      } as any,
    );

    expect(issues.some((i) => i.code === 'UNUSED_STATE' && i.stateKey === 'unused_axis')).toBe(true);
  });

  it('detects strict condition type mismatch', () => {
    const scene = makeScene();
    scene.entryConditions = 'global.trust >= "high"';

    const issues = validateSceneBranches(
      scene,
      {
        stateAxes: [
          {
            stateKey: 'trust',
            scope: 'global',
            type: 'number',
            defaultValue: 0,
            usagePurpose: 'test',
          },
        ],
        revealPlans: [],
      } as any,
    );

    expect(issues.some((i) => i.code === 'CONDITION_TYPE_MISMATCH')).toBe(true);
  });
});
