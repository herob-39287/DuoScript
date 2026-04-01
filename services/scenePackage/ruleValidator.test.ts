import { describe, expect, it } from 'vitest';
import { validateChapterScenePackages } from './ruleValidator';

const createChapter = () =>
  ({
    id: 'ch-1',
    title: '第一章',
    summary: '',
    scenes: [],
    beats: [],
    strategy: { milestones: [], forbiddenResolutions: [], characterArcProgress: '', pacing: '' },
    status: 'Idea',
    wordCount: 0,
    draftVersion: 0,
    involvedCharacterIds: [],
    updatedAt: 0,
    scenePackages: [
      {
        sceneId: 's1',
        title: '導入',
        chapterId: 'ch-1',
        involvedCharacterIds: [],
        purpose: '鍵を得る',
        mandatoryInfo: ['鍵'],
        entryConditions: 'global.known_key == true',
        exitEffects: [],
        sharedSpine: {
          intro: '主人公が扉の前に立つ。',
          conflict: '',
          deepen: '',
          preChoiceBeat: '',
          close: '鍵を拾う。',
        },
        choicePoints: [
          {
            choiceId: 'c1',
            text: '調べる',
            branchLevel: 'local_branch',
            intentTag: 'investigate',
            immediateEffects: [],
            delayedEffects: [],
            reactionVariantId: 'v1',
            convergenceTarget: 'merge-1',
            visibilityCondition: 'global.known_key == true',
          },
        ],
        reactionVariants: [
          {
            variantId: 'v1',
            trigger: 'investigate',
            affectedStates: [],
            toneShift: 'neutral',
            revealedInfo: [],
            responseBlocks: ['鍵を発見する。'],
            convergencePolicy: 'keep_state',
          },
        ],
        convergencePoint: {
          convergenceId: 'conv-1',
          sceneId: 's1',
          targetBlockId: 'merge-1',
          convergencePolicy: 'keep_state',
        },
        carryoverStateChanges: [],
        status: 'Idea',
      },
    ],
  }) as any;

describe('scenePackage rule validator (P4)', () => {
  it('passes when state refs and mandatory info are valid', () => {
    const chapter = createChapter();
    const bible = {
      stateAxes: [{ stateKey: 'known_key' }],
    } as any;

    const issues = validateChapterScenePackages(chapter, bible);
    expect(issues).toHaveLength(0);
  });

  it('detects unknown state references', () => {
    const chapter = createChapter();
    const bible = { stateAxes: [] } as any;

    const issues = validateChapterScenePackages(chapter, bible);
    expect(issues.some((i) => i.code === 'UNKNOWN_STATE_REFERENCE')).toBe(true);
  });

  it('detects duplicate scene IDs', () => {
    const chapter = createChapter();
    chapter.scenePackages.push({ ...chapter.scenePackages[0] });

    const issues = validateChapterScenePackages(chapter, { stateAxes: [{ stateKey: 'known_key' }] } as any);
    expect(issues.some((i) => i.code === 'DUPLICATE_SCENE_ID')).toBe(true);
  });

  it('detects strict condition type mismatch', () => {
    const chapter = createChapter();
    chapter.scenePackages[0].entryConditions = 'global.known_key >= "high"';

    const issues = validateChapterScenePackages(chapter, {
      stateAxes: [
        {
          stateKey: 'known_key',
          scope: 'global',
          type: 'boolean',
          defaultValue: false,
          usagePurpose: 'test',
        },
      ],
    } as any);

    expect(issues.some((i) => i.code === 'CONDITION_TYPE_MISMATCH')).toBe(true);
  });
});
