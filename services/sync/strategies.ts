
import { SyncOperation, HistoryEntry, WorldBible, ChapterLog, Character } from '../../types';
import { ensureScalar, findItemIdx } from './utils';

export interface SyncContext {
  bible: WorldBible;
  chapters: ChapterLog[];
  history: HistoryEntry[];
}

export interface SyncStrategy {
  apply(ctx: SyncContext, op: SyncOperation): {
    nextBible: WorldBible;
    nextChapters: ChapterLog[];
    targetName: string;
    oldValue: any;
    newValue: any;
  };
  revert(ctx: SyncContext, history: HistoryEntry): {
    nextBible: WorldBible;
    nextChapters: ChapterLog[];
  };
}

export class ScalarStrategy implements SyncStrategy {
  apply(ctx: SyncContext, op: SyncOperation) {
    const nextBible = { ...ctx.bible };
    const oldVal = (nextBible as any)[op.path];
    const newVal = ensureScalar(op.value, op.field);
    
    (nextBible as any)[op.path] = newVal;
    
    return {
      nextBible,
      nextChapters: ctx.chapters,
      targetName: op.path.toUpperCase(),
      oldValue: oldVal,
      newValue: newVal
    };
  }
  revert(ctx: SyncContext, history: HistoryEntry) {
    const nextBible = { ...ctx.bible };
    (nextBible as any)[history.path] = history.oldValue;
    return { nextBible, nextChapters: ctx.chapters };
  }
}

export class CharacterStrategy implements SyncStrategy {
  // Fields mapped to state
  private stateFields = ['location', 'health', 'currentGoal', 'socialStanding', 'internalState'];
  // Fields mapped to profile
  private profileFields = ['name', 'aliases', 'role', 'description', 'appearance', 'personality', 'background', 'traits', 'motivation', 'flaw', 'arc'];

  apply(ctx: SyncContext, op: SyncOperation) {
    const nextBible = { ...ctx.bible };
    const characters = [...(nextBible.characters || [])];
    
    let targetName = "名もなき登場人物";
    let oldVal: any = null;
    let newVal: any = null;

    const idx = findItemIdx(characters, op.targetId, op.targetName);
    const incoming = (typeof op.value === 'object' && op.value !== null) ? op.value : { content: op.value };

    // Helper to merge nested objects from incoming to character structure
    const mergeCharacterData = (char: Character, data: any) => {
        // Profile Merge
        if (data.profile) Object.assign(char.profile, data.profile);
        this.profileFields.forEach(k => {
            if (data[k] !== undefined) (char.profile as any)[k] = data[k];
        });
        if (data.voice) char.profile.voice = data.voice;
        
        // State Merge
        if (data.state) Object.assign(char.state, data.state);
        this.stateFields.forEach(k => {
            if (data[k] !== undefined) (char.state as any)[k] = data[k];
        });

        // Relationship Merge (Simplistic replace/append for now)
        if (Array.isArray(data.relationships)) {
            // Merge logic: update existing relationships by targetId, add new ones
            data.relationships.forEach((rel: any) => {
                const existingIdx = char.relationships.findIndex(r => r.targetId === rel.targetId);
                if (existingIdx !== -1) {
                    char.relationships[existingIdx] = { ...char.relationships[existingIdx], ...rel };
                } else {
                    char.relationships.push({
                         targetId: rel.targetId,
                         type: rel.type || 'Other',
                         strength: rel.strength || 0,
                         description: rel.description || '',
                         lastChangedAt: 'Sync'
                    });
                }
            });
        }
    };

    if (idx === -1 && op.op !== 'delete') {
      // Create New
      const newChar: Character = {
        id: crypto.randomUUID(),
        profile: {
            name: ensureScalar(incoming.name || incoming.profile?.name || op.targetName),
            aliases: incoming.aliases || [],
            role: incoming.role || 'Supporting',
            description: incoming.description || '',
            appearance: incoming.appearance || '',
            personality: incoming.personality || '',
            background: incoming.background || '',
            voice: incoming.voice || { 
                firstPerson: '私', secondPerson: 'あなた', speechStyle: 'Casual', catchphrases: [], forbiddenWords: [] 
            },
            traits: incoming.traits || [],
            motivation: incoming.motivation || '',
            flaw: incoming.flaw || '',
            arc: incoming.arc || ''
        },
        state: {
            location: incoming.location || incoming.state?.location || '不明',
            health: incoming.health || '良好',
            currentGoal: incoming.currentGoal || '',
            socialStanding: incoming.socialStanding || '',
            internalState: incoming.internalState || incoming.state?.internalState || '平常'
        },
        relationships: incoming.relationships || [],
        history: [],
        isPrivate: false
      };
      characters.push(newChar);
      targetName = newChar.profile.name;
      newVal = newChar;
    } else if (idx !== -1) {
      const current = { ...characters[idx], profile: { ...characters[idx].profile }, state: { ...characters[idx].state }, relationships: [...characters[idx].relationships] };
      targetName = current.profile.name;

      if (op.op === 'delete') {
        oldVal = current;
        characters.splice(idx, 1);
        newVal = "DELETED";
      } else {
        oldVal = JSON.parse(JSON.stringify(current)); // Deep copy for history
        
        if (op.field) {
          // Specific field update
          const val = ensureScalar(op.value, op.field);
          if (this.stateFields.includes(op.field)) {
             (current.state as any)[op.field] = val;
          } else if (this.profileFields.includes(op.field)) {
             (current.profile as any)[op.field] = val;
          } else if (op.field === 'voice') {
             current.profile.voice = { ...current.profile.voice, ...op.value };
          } else if (op.field === 'relationships') {
             // If specifically setting relationships array
             current.relationships = Array.isArray(op.value) ? op.value : current.relationships;
          }
        } else {
          // Merge update
          mergeCharacterData(current, incoming);
        }
        
        // Add History Event
        current.history.push({
            timestamp: Date.now(),
            diff: op.rationale || "Updated via NeuralSync"
        });

        newVal = current;
        characters[idx] = newVal;
      }
    }

    nextBible.characters = characters;
    return { nextBible, nextChapters: ctx.chapters, targetName: String(targetName), oldValue: oldVal, newValue: newVal };
  }

  revert(ctx: SyncContext, history: HistoryEntry) {
    const nextBible = { ...ctx.bible };
    const characters = [...(nextBible.characters || [])];
    
    if (history.opType === 'delete') {
      characters.push(history.oldValue);
    } else if (history.oldValue === null || history.opType === 'add') {
      const idx = characters.findIndex(c => c.profile.name === history.targetName);
      if (idx !== -1) characters.splice(idx, 1);
    } else {
      const idx = characters.findIndex(c => c.profile.name === history.targetName);
      if (idx !== -1) {
        characters[idx] = history.oldValue;
      }
    }
    nextBible.characters = characters;
    return { nextBible, nextChapters: ctx.chapters };
  }
}

export class CollectionStrategy implements SyncStrategy {
  apply(ctx: SyncContext, op: SyncOperation) {
    const isBiblePath = op.path !== 'chapters';
    const nextBible = { ...ctx.bible };
    const nextChapters = [...ctx.chapters];
    
    const collection = isBiblePath 
      ? [...((nextBible as any)[op.path] || [])]
      : nextChapters;

    let targetName = ensureScalar(op.targetName) || "対象項目";
    let oldVal: any = null;
    let newVal: any = null;

    const idx = findItemIdx(collection, op.targetId, op.targetName);
    const incomingValue = (typeof op.value === 'object' && op.value !== null) ? op.value : { content: op.value };

    if (idx === -1 && op.op !== 'delete') {
      const newItem: any = { id: crypto.randomUUID(), updatedAt: Date.now() };
      Object.keys(incomingValue).forEach(k => {
        newItem[k] = incomingValue[k];
      });

      if (!newItem.title && !newItem.event && !newItem.name && !newItem.concept && op.targetName) {
        if (op.path === 'timeline') newItem.event = ensureScalar(op.targetName);
        else if (op.path === 'themes') newItem.concept = ensureScalar(op.targetName);
        else newItem.title = ensureScalar(op.targetName);
      }
      collection.push(newItem);
      targetName = newItem.title || newItem.event || newItem.name || newItem.concept || targetName;
      newVal = newItem;
    } else if (idx !== -1) {
      const current = { ...collection[idx] };
      targetName = current.title || current.event || current.name || current.concept || targetName;

      if (op.op === 'delete') {
        oldVal = current;
        collection.splice(idx, 1);
        newVal = "DELETED";
      } else {
        oldVal = { ...current };
        if (op.field) {
          current[op.field] = incomingValue[op.field] !== undefined ? incomingValue[op.field] : incomingValue;
        } else {
          if (Array.isArray(incomingValue.aliases)) {
             incomingValue.aliases = Array.from(new Set([...(current.aliases || []), ...incomingValue.aliases]));
          }
          Object.assign(current, incomingValue);
        }
        current.updatedAt = Date.now();
        newVal = current;
        collection[idx] = newVal;
      }
    }

    if (isBiblePath) {
      (nextBible as any)[op.path] = collection;
      return { nextBible, nextChapters: ctx.chapters, targetName: String(targetName), oldValue: oldVal, newValue: newVal };
    } else {
      return { nextBible, nextChapters: collection, targetName: String(targetName), oldValue: oldVal, newValue: newVal };
    }
  }

  revert(ctx: SyncContext, history: HistoryEntry) {
    const isBiblePath = history.path !== 'chapters';
    const nextBible = { ...ctx.bible };
    const nextChapters = [...ctx.chapters];
    
    const collection = isBiblePath 
      ? [...((nextBible as any)[history.path] || [])]
      : nextChapters;
    
    if (history.opType === 'delete') {
      collection.push(history.oldValue);
    } else if (history.oldValue === null) {
      const idx = collection.findIndex((i: any) => (i.title || i.event || i.name || i.concept) === history.targetName);
      if (idx !== -1) collection.splice(idx, 1);
    } else {
      const idx = collection.findIndex((i: any) => (i.title || i.event || i.name || i.concept) === history.targetName);
      if (idx !== -1) {
        collection[idx] = history.oldValue;
      }
    }

    if (isBiblePath) {
      (nextBible as any)[history.path] = collection;
    } else {
      return { nextBible, nextChapters: collection };
    }
    return { nextBible, nextChapters: ctx.chapters };
  }
}

export const STRATEGY_MAP: Record<string, SyncStrategy> = {
  setting: new ScalarStrategy(),
  tone: new ScalarStrategy(),
  grandArc: new ScalarStrategy(),
  laws: new CollectionStrategy(), 
  storyStructure: new CollectionStrategy(), 
  locations: new CollectionStrategy(), 
  organizations: new CollectionStrategy(),
  themes: new CollectionStrategy(), 
  keyItems: new CollectionStrategy(), 
  storyThreads: new CollectionStrategy(), 
  races: new CollectionStrategy(),
  bestiary: new CollectionStrategy(),
  abilities: new CollectionStrategy(),
  characters: new CharacterStrategy(),
  timeline: new CollectionStrategy(),
  foreshadowing: new CollectionStrategy(),
  entries: new CollectionStrategy(),
  nexusBranches: new CollectionStrategy(),
  volumes: new CollectionStrategy(),
  chapters: new CollectionStrategy()
};
