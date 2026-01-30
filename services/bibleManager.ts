import { WorldBible, ChapterLog, SyncOperation, HistoryEntry } from '../types';
import {
  calculateSyncResult,
  applySyncBatch,
  calculateRevertResult,
  getCurrentValueForDiff,
} from './sync/engine';
import { validateSyncOperation, findMatchCandidates } from './sync/utils';
import { normalizeProject } from './schema/normalizer';

// Re-export logic from the new engine and existing modules
export {
  calculateSyncResult,
  applySyncBatch,
  calculateRevertResult,
  getCurrentValueForDiff,
  normalizeProject,
  findMatchCandidates,
  validateSyncOperation,
};
