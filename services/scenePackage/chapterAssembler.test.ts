import { describe, expect, it } from 'vitest';
import {
  compileChapterContentFromScenePackages,
  detectChapterContentDrift,
  syncChapterCompiledContentFromScenePackages,
} from './chapterAssembler';

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
    authoringMode: 'structured',
    content: 'legacy content',
    scenePackages: [
      {
        sceneId: 's1',
        title: '導入',
        chapterId: 'ch-1',
        involvedCharacterIds: [],
        purpose: '目的',
        mandatoryInfo: ['鍵'],
        exitEffects: [],
        sharedSpine: {
          intro: '鍵を見つける。',
          conflict: '',
          deepen: '',
          preChoiceBeat: '',
          close: '外に出る。',
        },
        choicePoints: [],
        reactionVariants: [],
        carryoverStateChanges: [],
        status: 'Idea',
      },
    ],
  }) as any;

describe('chapter assembler (P4)', () => {
  it('builds draft from scenePackages first', () => {
    const chapter = createChapter();
    const draft = compileChapterContentFromScenePackages(chapter);

    expect(draft).toContain('## 導入 (s1)');
    expect(draft).toContain('目的: 目的');
  });

  it('syncs chapter.compiledContent as cache from canonical scenePackages', () => {
    const chapter = createChapter();
    const synced = syncChapterCompiledContentFromScenePackages(chapter);

    expect(synced.compiledContent).toContain('鍵を見つける。');
    expect(synced.wordCount).toBe((synced.compiledContent || '').length);
  });

  it('detects drift between content and canonical scenePackage draft', () => {
    const chapter = createChapter();
    const drift = detectChapterContentDrift(chapter);

    expect(drift.hasDrift).toBe(true);
    expect(drift.canonicalContent).toContain('導入');
  });
});
