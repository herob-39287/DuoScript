import { describe, expect, it } from 'vitest';
import {
  collectStateIdentifiers,
  evaluateChoiceAvailability,
  evaluateConditionExpression,
  evaluateRouteUnlocked,
  evaluateSceneEntry,
  lintConditionExpression,
} from './evaluator';

describe('condition evaluator (P2)', () => {
  it('evaluates numeric and boolean conditions', () => {
    const result = evaluateConditionExpression(
      'trust_A >= 3 AND flag_confession_seen == true',
      {
        scene: { trust_A: 4 },
        global: { flag_confession_seen: true },
      },
    );

    expect(result).toBe(true);
  });

  it('resolves scoped identifiers', () => {
    const result = evaluateConditionExpression('route.trust >= 2 AND chapter.phase == 1', {
      route: { trust: 2 },
      chapter: { phase: 1 },
    });

    expect(result).toBe(true);
  });

  it('supports grouping and NOT', () => {
    const result = evaluateConditionExpression('NOT (knowledge.weapon == true OR affinity.Alice < 2)', {
      knowledge: { weapon: false },
      affinity: { Alice: 5 },
    });

    expect(result).toBe(true);
  });

  it('evaluates choice visibility/availability', () => {
    const choice = {
      choiceId: 'c1',
      text: '選ぶ',
      branchLevel: 'local_branch',
      intentTag: 'test',
      immediateEffects: [],
      delayedEffects: [],
      convergenceTarget: 'merge-1',
      visibilityCondition: 'scene.phase >= 2',
      availabilityCondition: 'global.has_key == true',
    } as any;

    const result = evaluateChoiceAvailability(choice, {
      scene: { phase: 2 },
      global: { has_key: true },
    });

    expect(result).toEqual({ visible: true, available: true });
  });

  it('evaluates route unlock and scene entry', () => {
    const route = {
      routeId: 'r1',
      routeType: 'Character',
      description: 'test',
      revealPolicy: 'strict',
      enabledState: true,
      unlockConditions: 'affinity.Alice >= 3',
    } as any;

    const scene = {
      sceneId: 's1',
      title: 'scene',
      chapterId: 'ch1',
      involvedCharacterIds: [],
      purpose: 'test',
      mandatoryInfo: [],
      exitEffects: [],
      sharedSpine: { intro: '', conflict: '', deepen: '', preChoiceBeat: '', close: '' },
      choicePoints: [],
      reactionVariants: [],
      carryoverStateChanges: [],
      status: 'Idea',
      entryConditions: 'global.opening_seen == true',
    } as any;

    expect(evaluateRouteUnlocked(route, { affinity: { Alice: 3 } })).toBe(true);
    expect(evaluateSceneEntry(scene, { global: { opening_seen: true } })).toBe(true);
  });

  it('collects referenced identifiers', () => {
    const refs = collectStateIdentifiers('trust_A >= 3 AND global.flag == true');
    expect(refs).toContain('trust_A');
    expect(refs).toContain('global.flag');
  });

  it('detects strict type mismatch issues', () => {
    const issues = lintConditionExpression('trust_A >= "high"', [
      {
        stateKey: 'trust_A',
        scope: 'scene',
        type: 'number',
        defaultValue: 0,
        usagePurpose: 'test',
      } as any,
    ]);

    expect(issues.some((issue) => issue.code === 'TYPE_MISMATCH')).toBe(true);
    expect(issues.some((issue) => issue.code === 'INVALID_COMPARATOR_FOR_TYPE')).toBe(true);
  });
});
