
import { SyncOperation, SyncCandidate } from '../../types';
import { normalizeJapanese, calculateSimilarity } from '../../utils/stringUtils';

export const findMatchCandidates = (
  list: any[], 
  targetId?: string, 
  targetName?: string
): SyncCandidate[] => {
  const results: SyncCandidate[] = [];
  const normTarget = targetName ? normalizeJapanese(targetName) : '';

  list.forEach(item => {
    // Check ID first
    if (targetId && item.id === targetId) {
      const name = item.profile?.name || item.name || item.title || item.event || item.concept || "Unknown";
      results.push({ id: item.id, name, confidence: 1.0, reason: 'IDマッチ' });
      return;
    }

    if (!normTarget) return;

    // Check Name fields (handle new profile.name structure)
    const name = item.profile?.name || item.name || item.title || item.event || item.concept;
    if (name && normalizeJapanese(String(name)) === normTarget) {
        results.push({ id: item.id, name, confidence: 0.98, reason: '名称完全一致' });
        return;
    }

    // Check Aliases
    const aliases = item.profile?.aliases || item.aliases;
    if (Array.isArray(aliases)) {
      if (aliases.some((a: string) => normalizeJapanese(String(a)) === normTarget)) {
        results.push({ id: item.id, name, confidence: 0.95, reason: '別名一致' });
        return;
      }
    }

    // Similarity
    if (name) {
      const sim = calculateSimilarity(normalizeJapanese(String(name)), normTarget);
      if (sim > 0.85) {
        results.push({ id: item.id, name, confidence: 0.6 + (sim * 0.2), reason: '類似名称' });
      }
    }
  });

  return results.sort((a, b) => b.confidence - a.confidence);
};

export const findItemIdx = (list: any[], targetId?: string, targetName?: string): number => {
  if (targetId) {
    const idx = list.findIndex(i => i.id === targetId);
    if (idx !== -1) return idx;
  }
  
  if (!targetName) return -1;
  const candidates = findMatchCandidates(list, targetId, targetName);
  if (candidates.length > 0 && candidates[0].confidence >= 0.98) {
    return list.findIndex(i => i.id === candidates[0].id);
  }
  
  return -1;
};

export const validateSyncOperation = (op: SyncOperation): string[] => {
  const errors: string[] = [];
  if (!op.path) errors.push("path is required");
  if (!op.op) errors.push("op is required");
  if (op.op !== 'add' && !op.targetName && !op.targetId) errors.push("targetName or targetId is required for updates/deletes");
  if (op.value === undefined) errors.push("value is required");
  return errors;
};

export const ensureScalar = (value: any, preferredField?: string): any => {
  if (value === null || value === undefined) return "";
  if (typeof value !== 'object') return value;
  if (Array.isArray(value)) return value;

  if (preferredField && value[preferredField] !== undefined && typeof value[preferredField] !== 'object') {
    return value[preferredField];
  }

  // Handle nested profile/state fields for Characters
  if (value.profile && value.profile.name) return value.profile.name;
  if (value.state && value.state.internalState) return value.state.internalState;

  const commonFields = ['text', 'content', 'value', 'description', 'summary', 'name', 'event', 'motivation', 'personality', 'concept', 'title'];
  for (const f of commonFields) {
    if (value[f] !== undefined && typeof value[f] !== 'object') {
      return value[f];
    }
  }

  try {
    const keys = Object.keys(value);
    if (keys.length === 1 && typeof value[keys[0]] !== 'object') return String(value[keys[0]]);
    return JSON.stringify(value);
  } catch (e) {
    return "[Object]";
  }
};
