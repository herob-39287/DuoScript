import { SyncOperation, SyncCandidate } from '../../types';
import { normalizeJapanese, calculateSimilarity } from '../../utils/stringUtils';
import { SyncOperationZodSchema } from '../validation/schemas';

export const findMatchCandidates = (
  list: any[],
  targetId?: string,
  targetName?: string,
): SyncCandidate[] => {
  const results: SyncCandidate[] = [];
  const normTarget = targetName ? normalizeJapanese(targetName) : '';

  list.forEach((item) => {
    // Check ID first
    if (targetId && item.id === targetId) {
      const name =
        item.profile?.name || item.name || item.title || item.event || item.concept || 'Unknown';
      results.push({ id: item.id, name, confidence: 1.0, reason: 'sync.reason.id_match' });
      return;
    }

    if (!normTarget) return;

    // Check Name fields (handle new profile.name structure)
    const name = item.profile?.name || item.name || item.title || item.event || item.concept;
    if (name && normalizeJapanese(String(name)) === normTarget) {
      results.push({ id: item.id, name, confidence: 0.98, reason: 'sync.reason.name_match' });
      return;
    }

    // Check Aliases
    const aliases = item.profile?.aliases || item.aliases;
    if (Array.isArray(aliases)) {
      if (aliases.some((a: string) => normalizeJapanese(String(a)) === normTarget)) {
        results.push({ id: item.id, name, confidence: 0.95, reason: 'sync.reason.alias_match' });
        return;
      }
    }

    // Similarity
    if (name) {
      const sim = calculateSimilarity(normalizeJapanese(String(name)), normTarget);
      if (sim > 0.85) {
        results.push({
          id: item.id,
          name,
          confidence: 0.6 + sim * 0.2,
          reason: 'sync.reason.sim_match',
        });
      }
    }
  });

  return results.sort((a, b) => b.confidence - a.confidence);
};

export const findItemIdx = (list: any[], targetId?: string, targetName?: string): number => {
  if (targetId) {
    const idx = list.findIndex((i) => i.id === targetId);
    if (idx !== -1) return idx;
  }

  if (!targetName) return -1;
  const candidates = findMatchCandidates(list, targetId, targetName);
  if (candidates.length > 0 && candidates[0].confidence >= 0.98) {
    return list.findIndex((i) => i.id === candidates[0].id);
  }

  return -1;
};

/**
 * Validates a SyncOperation using Zod Schema.
 * Returns an array of error messages. Empty array implies valid.
 */
export const validateSyncOperation = (op: SyncOperation): string[] => {
  const result = SyncOperationZodSchema.safeParse(op);
  if (!result.success) {
    return result.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`);
  }

  const errors: string[] = [];
  if (op.op !== 'add' && !op.targetName && !op.targetId) {
    errors.push('targetName or targetId is required for updates/deletes');
  }
  return errors;
};

export const ensureScalar = (value: any, preferredField?: string): any => {
  if (value === null || value === undefined) return '';
  if (typeof value !== 'object') return value;
  if (Array.isArray(value)) return value;

  // Modified: Check if preferred field exists and is scalar OR array
  if (preferredField && value[preferredField] !== undefined) {
    const target = value[preferredField];
    if (typeof target !== 'object' || Array.isArray(target)) {
      return target;
    }
  }

  // Handle nested profile/state fields for Characters
  if (value.profile && value.profile.name) return value.profile.name;
  if (value.state && value.state.internalState) return value.state.internalState;

  // Added array fields like traits, motifs, etc.
  const commonFields = [
    'text',
    'content',
    'value',
    'description',
    'summary',
    'name',
    'event',
    'motivation',
    'personality',
    'concept',
    'title',
    'traits',
    'motifs',
    'connections',
    'relations',
    'memberIds',
  ];
  for (const f of commonFields) {
    if (value[f] !== undefined) {
      const val = value[f];
      if (typeof val !== 'object' || Array.isArray(val)) return val;
    }
  }

  try {
    const keys = Object.keys(value);
    // Modified: Unwrap single key if scalar or array
    if (keys.length === 1) {
      const val = value[keys[0]];
      if (typeof val !== 'object' || Array.isArray(val)) return val;
    }
    return JSON.stringify(value);
  } catch (e) {
    return '[Object]';
  }
};
