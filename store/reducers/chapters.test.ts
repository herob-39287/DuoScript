import { describe, expect, it } from 'vitest';
import { chaptersReducer } from './chapters';

const createChapter = () =>
  ({
    id: 'ch1',
    title: 'ch1',
    summary: '',
    scenes: [],
    beats: [],
    strategy: { milestones: [], forbiddenResolutions: [], characterArcProgress: '', pacing: '' },
    status: 'Idea',
    wordCount: 0,
    draftVersion: 0,
    updatedAt: 0,
    involvedCharacterIds: [],
    content: 'legacy',
    scenePackages: [
      {
        sceneId: 's1',
        title: 'Scene 1',
        chapterId: 'ch1',
        involvedCharacterIds: [],
        purpose: 'p',
        mandatoryInfo: [],
        exitEffects: [],
        sharedSpine: { intro: 'intro', conflict: '', deepen: '', preChoiceBeat: '', close: '' },
        choicePoints: [],
        reactionVariants: [],
        carryoverStateChanges: [],
        status: 'Idea',
      },
    ],
  }) as any;

describe('chaptersReducer scenePackages canonical write strategy', () => {
  it('syncs content cache when scenePackages are updated', () => {
    const initial = [createChapter()];

    const next = chaptersReducer(initial, {
      type: 'UPDATE_CHAPTER',
      id: 'ch1',
      updates: {
        scenePackages: [
          {
            ...initial[0].scenePackages[0],
            sharedSpine: {
              ...initial[0].scenePackages[0].sharedSpine,
              intro: 'new intro',
            },
          },
        ],
      },
    } as any);

    expect(next[0].content).toContain('new intro');
    expect(next[0].wordCount).toBe((next[0].content || '').length);
  });
});
