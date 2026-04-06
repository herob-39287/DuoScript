import { describe, expect, it } from 'vitest';
import { StoryProject } from '../../types';
import { buildPrepareForCodexArtifacts } from './export';

const createBaseProject = (): StoryProject =>
  ({
    meta: {
      id: 'project-1',
      title: 'Project 1',
      author: 'author',
      genre: 'fantasy',
      language: 'ja',
      createdAt: 0,
      updatedAt: 0,
      headRev: 1,
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
      setting: 'Setting',
      routes: [],
      revealPlans: [],
      stateAxes: [],
      branchPolicies: [],
    },
    chapters: [
      {
        id: 'chapter-1',
        title: 'Chapter 1',
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
        authoringMode: 'structured',
        updatedAt: 0,
        involvedCharacterIds: [],
        content: '',
        draftText: '',
        compiledContent: '',
        scenePackages: [],
      },
    ],
    sync: { chatHistory: [], memory: '', pendingOps: [], quarantine: [], history: [] },
  }) as StoryProject;

describe('buildPrepareForCodexArtifacts', () => {
  it('keeps project genesis for starter projects', () => {
    const artifacts = buildPrepareForCodexArtifacts(createBaseProject(), {
      scopeType: 'project',
      taskType: 'project genesis',
      responseMode: 'ops',
    });
    const bundle = JSON.parse(artifacts.workspaceBundle);

    expect(bundle.project.vnDesign.routes).toHaveLength(0);
    expect(artifacts.codexTask).toContain('- project genesis');
    expect(artifacts.codexTask).toContain('taskType: project genesis');
  });

  it('downgrades project genesis to interactive refinement for non-starter projects', () => {
    const project = createBaseProject();
    project.bible.routes = [{ routeId: 'route-a', label: 'A', summary: '' } as any];

    const artifacts = buildPrepareForCodexArtifacts(project, {
      scopeType: 'project',
      taskType: 'project genesis',
      responseMode: 'ops',
    });
    const bundle = JSON.parse(artifacts.workspaceBundle);

    expect(bundle.project.vnDesign.routes).toHaveLength(1);
    expect(artifacts.codexTask).not.toContain('taskType: project genesis');
    expect(artifacts.codexTask).toContain('taskType: interactive refinement');
  });
});
