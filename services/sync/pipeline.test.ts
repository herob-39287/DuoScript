import { describe, it, expect } from 'vitest';
import { runSyncPipeline } from './pipeline';
import { applySyncBatch } from './engine';
import { StoryProject, WorldBible, ChapterLog } from '../../types';

// --- Mock Data Helpers ---

const createMockProject = (): StoryProject => {
  const bible: WorldBible = {
    version: 1,
    setting: 'Test World',
    laws: [],
    grandArc: 'Original Arc',
    storyStructure: [],
    locations: [{ id: 'loc-1', name: '王都', description: '首都', type: 'City' }],
    organizations: [],
    themes: [],
    keyItems: [],
    storyThreads: [],
    races: [],
    bestiary: [],
    abilities: [],
    tone: 'Serious',
    volumes: [],
    characters: [
      {
        id: 'char-1',
        profile: {
          name: 'アリス',
          role: 'Protagonist',
          description: '主人公',
          aliases: ['アリ', '赤の魔女'],
          traits: [],
          appearance: '',
          personality: '',
          background: '',
          motivation: '',
          flaw: '',
          arc: '',
          voice: {
            firstPerson: '',
            secondPerson: '',
            speechStyle: 'Casual',
            catchphrases: [],
            forbiddenWords: [],
          },
          shortSummary: '',
        },
        state: {
          location: '王都',
          internalState: 'Normal',
          currentGoal: '',
          health: '',
          socialStanding: '',
        },
        relationships: [],
        history: [],
        isPrivate: false,
      },
    ],
    timeline: [],
    foreshadowing: [],
    routes: [],
    revealPlans: [],
    stateAxes: [],
    branchPolicies: [],
    entries: [],
    nexusBranches: [],
    integrityIssues: [],
    summaryBuffer: '',
    lastSummaryUpdate: 0,
  };

  const chapters: ChapterLog[] = [
    {
      id: 'ch-1',
      title: '第一章',
      summary: '始まり',
      content: '',
      scenes: [],
      beats: [],
      strategy: { milestones: [], forbiddenResolutions: [], characterArcProgress: '', pacing: '' },
      status: 'Idea',
      wordCount: 0,
      draftVersion: 0,
      involvedCharacterIds: [],
      updatedAt: 0,
    },
  ];

  return {
    meta: {
      id: 'proj-1',
      title: 'Test',
      author: 'Me',
      genre: '',
      createdAt: 0,
      updatedAt: 0,
      schemaVersion: 1,
      language: 'ja',
      tokenUsage: [],
      violationCount: 0,
      violationHistory: [],
      preferences: {} as any,
    },
    bible,
    chapters,
    sync: { chatHistory: [], pendingChanges: [], quarantine: [], history: [] },
  };
};

// --- Test Suites ---

describe('Neural Sync Pipeline Integration', () => {
  // Case 1: 正常系 - Markdownコードブロックからの抽出とID解決
  it('should parse valid JSON from Markdown block and resolve existing IDs', () => {
    const project = createMockProject();
    const aiOutput = `
      Here is the extracted data based on the conversation.
      \`\`\`json
      [
        {
          "op": "update",
          "path": "characters",
          "targetName": "アリス",
          "value": { 
            "state": { "internalState": "Anxious", "location": "Dark Forest" } 
          },
          "rationale": "Alice entered the forest and feels scared."
        },
        {
          "op": "update",
          "path": "locations",
          "targetName": "王都",
          "value": { "description": "Attacked by dragons" },
          "rationale": "Event trigger"
        }
      ]
      \`\`\`
    `;

    const result = runSyncPipeline(aiOutput, 'Test', project, false);

    expect(result.readyOps).toHaveLength(2);
    expect(result.quarantineItems).toHaveLength(0);

    // Character Op Verification
    const charOp = result.readyOps.find((op) => op.path === 'characters');
    expect(charOp).toBeDefined();
    expect(charOp?.targetId).toBe('char-1'); // Should resolve "アリス" to "char-1"
    expect(charOp?.value?.state?.internalState).toBe('Anxious');

    // Location Op Verification
    const locOp = result.readyOps.find((op) => op.path === 'locations');
    expect(locOp).toBeDefined();
    expect(locOp?.targetId).toBe('loc-1'); // Should resolve "王都" to "loc-1"
  });

  // Case 2: 準正常系 - エイリアス（別名）による解決
  it('should resolve IDs using aliases', () => {
    const project = createMockProject();
    const aiOutput = `
      \`\`\`json
      [{
        "op": "update",
        "path": "characters",
        "targetName": "赤の魔女", 
        "value": { "profile": { "description": "Known as the Red Witch." } },
        "rationale": "Alias usage"
      }]
      \`\`\`
    `;

    const result = runSyncPipeline(aiOutput, 'Test', project, false);
    const op = result.readyOps[0] as {
      value?: { type?: string };
      targetId?: string;
      confidence?: number;
    };

    expect(op.targetId).toBe('char-1'); // "赤の魔女" is in aliases of Alice
    expect(op.confidence).toBeGreaterThan(0.9);
  });

  // Case 3: 異常系 - 壊れたJSONの修復
  it('should repair and parse truncated JSON', () => {
    const project = createMockProject();
    // 途中で切れている、末尾カンマがあるなどの不正JSON
    const aiOutput = `[
      {
        "op": "add",
        "path": "keyItems",
        "targetName": "古びた鍵",
        "value": { "description": "錆びている", "type": "Tool" },
        "rationale": "Found under the mat"
      },
    `; // Missing closing bracket

    const result = runSyncPipeline(aiOutput, 'Test', project, false);

    expect(result.readyOps).toHaveLength(1);
    const op = result.readyOps[0];
    expect(op.path).toBe('keyItems');
    expect(op.targetName).toBe('古びた鍵');
    expect((op.value as { type?: string } | undefined)?.type).toBe('Tool');
  });

  // Case 4: バリデーション - 必須フィールド欠落
  it('should quarantine operations missing required fields', () => {
    const project = createMockProject();
    const aiOutput = `[
      {
        "op": "update",
        "path": "characters",
        "value": { "some": "data" },
        "rationale": "Missing targetName"
      },
      {
        "targetName": "Unknown",
        "value": {},
        "rationale": "Missing path and op"
      }
    ]`;

    const result = runSyncPipeline(aiOutput, 'Test', project, false);

    expect(result.readyOps).toHaveLength(0);
    expect(result.quarantineItems).toHaveLength(2);
    expect(result.quarantineItems[0].error).toMatch(/targetName or targetId is required/);
    expect(result.quarantineItems[1].error).toMatch(/path/);
  });

  // Case 5: 解決 - 未知の対象（新規追加 vs 曖昧）
  it('should handle unknown targets correctly', () => {
    const project = createMockProject();
    const aiOutput = `[
      {
        "op": "update",
        "path": "characters",
        "targetName": "ボブ", 
        "value": { "role": "Antagonist" },
        "rationale": "New enemy appearing"
      },
      {
        "op": "add",
        "path": "characters",
        "targetName": "チャーリー",
        "value": { "role": "Minor" },
        "rationale": "New villager"
      }
    ]`;

    const result = runSyncPipeline(aiOutput, 'Test', project, false);
    expect(result.readyOps).toHaveLength(2);

    // Update for unknown item -> needs_resolution (Maybe typo or deleted item)
    const updateOp = result.readyOps.find((op) => op.targetName === 'ボブ');
    expect(updateOp?.status).toBe('needs_resolution');
    expect(updateOp?.targetId).toBeUndefined();

    // Add for unknown item -> proposal (Clean add)
    const addOp = result.readyOps.find((op) => op.targetName === 'チャーリー');
    expect(addOp?.status).toBe('proposal');
  });

  // Case 6: 適用 - エンジンによるState更新
  it('should apply extracted operations to update the Bible state', () => {
    const project = createMockProject();

    // 1. Pipeline: Extract
    const aiOutput = `[
      {
        "op": "update",
        "path": "grandArc",
        "value": "The story takes a dark turn.",
        "rationale": "Plot update",
        "targetName": "Grand Arc"
      },
      {
        "op": "add",
        "path": "foreshadowing",
        "targetName": "裏切り者の影",
        "value": { 
          "description": "Someone is leaking info", 
          "status": "Open",
          "clues": ["Missing documents"]
        },
        "rationale": "Mystery setup"
      }
    ]`;

    const { readyOps } = runSyncPipeline(aiOutput, 'Test', project, false);
    expect(readyOps).toHaveLength(2);

    // 2. Engine: Apply
    const applyResult = applySyncBatch(project.bible, project.chapters, readyOps);

    expect(applyResult.success).toBe(true);

    // Verify Grand Arc update
    expect(applyResult.nextBible.grandArc).toBe('The story takes a dark turn.');
    expect(applyResult.nextBible.version).toBe(project.bible.version + 2); // 2 operations

    // Verify Foreshadowing addition
    expect(applyResult.nextBible.foreshadowing).toHaveLength(1);
    expect(applyResult.nextBible.foreshadowing[0].title).toBe('裏切り者の影');
    expect(applyResult.nextBible.foreshadowing[0].clues).toContain('Missing documents');
  });
});
