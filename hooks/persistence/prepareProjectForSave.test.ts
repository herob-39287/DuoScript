import { describe, expect, it } from 'vitest';
import { prepareProjectForSave } from './prepareProjectForSave';

const createProject = () =>
  ({
    meta: {
      id: 'p1',
      title: 'P1',
      author: 'a',
      language: 'ja',
      createdAt: 0,
      updatedAt: 0,
      headRev: 0,
      preferences: {
        appLanguage: 'ja',
        transmissionScope: 'FULL',
        safetyPreset: 'STRICT',
        aiPersona: 'STANDARD',
        autoSave: true,
        useCloudSync: false,
        defaultGenerativeModel: 'gemini-2.5-pro',
        defaultImageModel: 'imagen-3.0-generate-002',
        editorSettings: {
          fontSize: 16,
          lineHeight: 1.7,
          letterSpacing: 0.04,
          preferredFont: 'sans',
          writingWidth: 42,
          vertical: false,
        },
      },
      tokenUsage: [],
      safetyViolations: [],
    },
    bible: {
      stateAxes: [
        {
          stateKey: 'trust_a',
          scope: 'scene',
          type: 'number',
          defaultValue: 0,
          min: 0,
          max: 10,
          usagePurpose: 'test',
        },
      ],
      revealPlans: [],
    },
    sync: { chatHistory: [], memory: '', pendingOps: [], quarantine: [], history: [] },
    chapters: [
      {
        id: 'ch1',
        title: 'ch1',
        summary: '',
        scenes: [],
        beats: [],
        strategy: {
          milestones: [],
          forbiddenResolutions: [],
          characterArcProgress: '',
          pacing: '',
        },
        status: 'Idea',
        wordCount: 0,
        draftVersion: 0,
        updatedAt: 0,
        involvedCharacterIds: [],
        content: 'old',
        scenePackages: [
          {
            sceneId: 's1',
            title: 's1',
            chapterId: 'ch1',
            involvedCharacterIds: [],
            purpose: 'p',
            mandatoryInfo: [],
            entryConditions: 'trust_a >= 0',
            exitEffects: [],
            sharedSpine: { intro: 'intro', conflict: '', deepen: '', preChoiceBeat: '', close: '' },
            choicePoints: [],
            reactionVariants: [],
            carryoverStateChanges: ['trust_a += 1'],
            status: 'Idea',
          },
        ],
      },
    ],
  }) as any;

describe('prepareProjectForSave', () => {
  it('syncs chapter cache content and returns saveable project', () => {
    const prepared = prepareProjectForSave(createProject());

    expect(prepared.didSyncChapterContent).toBe(true);
    expect(prepared.projectToSave.chapters[0].content).toContain('## s1 (s1)');
    expect(prepared.blockingIssues).toHaveLength(0);
  });

  it('returns blocking issues when chapter-level branch validation fails', () => {
    const project = createProject();
    project.chapters[0].scenePackages[0].choicePoints = [
      {
        choiceId: 'c1',
        text: '選ぶ',
        branchLevel: 'local_branch',
        intentTag: 'test',
        immediateEffects: [],
        delayedEffects: [],
        routeImpact: 'none',
        unlockImpact: 'none',
      },
    ];

    const prepared = prepareProjectForSave(project);

    expect(prepared.blockingIssues.length).toBeGreaterThan(0);
    expect(prepared.blockingIssues.some((issue) => issue.message.includes('local_branch'))).toBe(
      true,
    );
  });
});
