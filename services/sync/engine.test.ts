import { describe, it, expect } from 'vitest';
import { calculateSyncResult } from './engine';
import { SyncOperation, WorldBible, ChapterLog } from '../../types';

// Mock data helpers
const createMockBible = (): WorldBible => ({
  version: 1,
  setting: '',
  laws: [],
  grandArc: 'Original Arc',
  storyStructure: [],
  locations: [],
  organizations: [],
  themes: [],
  keyItems: [],
  storyThreads: [],
  races: [],
  bestiary: [],
  abilities: [],
  tone: '',
  volumes: [],
  characters: [],
  timeline: [],
  foreshadowing: [],
  entries: [],
  nexusBranches: [],
  integrityIssues: [],
  summaryBuffer: '',
  lastSummaryUpdate: 0,
});

const createMockOp = (path: string, value: any): SyncOperation => ({
  id: 'op-123',
  requestId: 'req-123',
  op: 'update',
  path: path as any,
  value,
  targetName: 'Target',
  rationale: 'Testing',
  evidence: 'Test',
  confidence: 1.0,
  status: 'proposal',
  baseVersion: 1,
  timestamp: Date.now(),
});

describe('calculateSyncResult', () => {
  it('should successfully update a scalar value (grandArc)', () => {
    const bible = createMockBible();
    const chapters: ChapterLog[] = [];
    const op = createMockOp('grandArc', 'New Grand Arc');

    const result = calculateSyncResult(bible, chapters, op, []);

    expect(result.nextBible.grandArc).toBe('New Grand Arc');
    expect(result.nextBible.version).toBe(2);
    expect(result.historyEntry.operationId).toBe(op.id);
    expect(result.historyEntry.oldValue).toBe('Original Arc');
    expect(result.historyEntry.newValue).toBe('New Grand Arc');
  });

  it('should throw error if operation is already committed', () => {
    const bible = createMockBible();
    const chapters: ChapterLog[] = [];
    const op = createMockOp('grandArc', 'New Grand Arc');
    const history = [{ operationId: 'op-123' }] as any[];

    expect(() => calculateSyncResult(bible, chapters, op, history)).toThrow(/already committed/);
  });

  it('should throw error if path has no strategy', () => {
    // スキーマバリデーションを通過するが、戦略が存在しないパスを想定（実際には型安全だが、ランタイムチェックとして）
    const bible = createMockBible();
    const chapters: ChapterLog[] = [];
    const op = createMockOp('invalidPath' as any, 'someVal');

    expect(() => calculateSyncResult(bible, chapters, op, [])).toThrow();
  });
});
