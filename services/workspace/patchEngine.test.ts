import { describe, expect, it } from 'vitest';
import { shadowApplyCodexOps } from './patchEngine';
import { CodexOpsArtifact } from './patchTypes';

const buildProject = () =>
  ({
    meta: {
      id: 'project-1',
      title: 'Test',
      author: 'Tester',
      genre: 'Mystery',
      language: 'ja',
      updatedAt: 0,
    },
    bible: {
      setting: '',
      routes: [],
      revealPlans: [],
      stateAxes: [],
      branchPolicies: [],
    },
    chapters: [
      {
        id: 'ch-1',
        title: 'Chapter 1',
        summary: '',
        scenes: [],
        beats: [],
        strategy: { milestones: [], forbiddenResolutions: [], characterArcProgress: '', pacing: '' },
        status: 'Idea',
        wordCount: 0,
        content: '',
        draftVersion: 0,
        authoringMode: 'structured',
        draftText: '',
        compiledContent: 'stale',
        updatedAt: 0,
        involvedCharacterIds: [],
        scenePackages: [
          {
            sceneId: 's-1',
            title: 'Scene 1',
            chapterId: 'ch-1',
            involvedCharacterIds: [],
            purpose: '',
            mandatoryInfo: [],
            exitEffects: [],
            sharedSpine: {
              intro: 'fresh canonical text',
              conflict: '',
              deepen: '',
              preChoiceBeat: '',
              close: '',
            },
            choicePoints: [],
            reactionVariants: [],
            carryoverStateChanges: [],
            status: 'Idea',
          },
        ],
      },
    ],
    sync: {
      timeline: [],
      callbacks: [],
      unresolvedForeshadows: [],
      setupPayoffMap: [],
      conversationMemory: '',
      trustScore: 0,
      triggerAudit: [],
      activeAgents: [],
      ragState: {
        indexingProgress: 0,
        lastIndexedAt: 0,
      },
    },
  }) as any;

describe('patchEngine hardening', () => {
  it('blocks operations that target protected paths', () => {
    const artifact: CodexOpsArtifact = {
      kind: 'duoscript.codex.ops',
      version: 1,
      generatedAt: Date.now(),
      taskType: 'interactive refinement',
      responseMode: 'ops',
      scopeGuard: {
        protectedPaths: ['bible/routes'],
      },
      operations: [
        {
          type: 'upsertRoute',
          opId: 'op-1',
          route: {
            routeId: 'r-1',
            routeType: 'Common',
            description: 'Route 1',
            revealPolicy: 'default',
            enabledState: true,
          },
        },
      ],
    };

    const result = shadowApplyCodexOps(buildProject(), artifact);
    expect(result.opResults[0].status).toBe('blocked');
    expect(result.project.bible.routes).toHaveLength(0);
  });

  it('blocks upsertChapter in scene-scoped refinement', () => {
    const artifact: CodexOpsArtifact = {
      kind: 'duoscript.codex.ops',
      version: 1,
      generatedAt: Date.now(),
      taskType: 'interactive refinement',
      responseMode: 'ops',
      scopeGuard: {
        editableChapterIds: ['ch-1'],
        editableSceneIds: ['s-1'],
      },
      operations: [
        {
          type: 'upsertChapter',
          opId: 'op-2',
          chapter: { ...buildProject().chapters[0], title: 'Updated chapter title' },
        },
      ],
    };

    const result = shadowApplyCodexOps(buildProject(), artifact);
    expect(result.opResults[0].status).toBe('blocked');
    expect(result.project.chapters[0].title).toBe('Chapter 1');
  });

  it('auto-rebuilds compiled content after scene package updates', () => {
    const artifact: CodexOpsArtifact = {
      kind: 'duoscript.codex.ops',
      version: 1,
      generatedAt: Date.now(),
      taskType: 'interactive refinement',
      responseMode: 'ops',
      operations: [
        {
          type: 'upsertScenePackage',
          opId: 'op-3',
          chapterId: 'ch-1',
          scenePackage: {
            ...buildProject().chapters[0].scenePackages[0],
            sharedSpine: {
              intro: 'rebuilt text from ops',
              conflict: '',
              deepen: '',
              preChoiceBeat: '',
              close: '',
            },
          },
        },
      ],
    };

    const result = shadowApplyCodexOps(buildProject(), artifact);
    expect(result.requiresDraftRebuild).toBe(true);
    expect(result.project.chapters[0].compiledContent).toContain('rebuilt text from ops');
  });
});
