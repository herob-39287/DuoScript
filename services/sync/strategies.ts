
import { 
  SyncOperation, HistoryEntry, WorldBible, ChapterLog, Character,
  SyncPath
} from '../../types';
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
    // op.value is a string for setting/tone/grandArc as per Discriminated Union
    const newVal = typeof op.value === 'string' ? op.value : ensureScalar(op.value, op.field);
    
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
  private stateFields = ['location', 'health', 'currentGoal', 'socialStanding', 'internalState'];
  private profileFields = ['name', 'aliases', 'role', 'description', 'appearance', 'personality', 'background', 'traits', 'motivation', 'flaw', 'arc'];

  apply(ctx: SyncContext, op: SyncOperation) {
    if (op.path !== 'characters') throw new Error("Invalid path for CharacterStrategy");
    const nextBible = { ...ctx.bible };
    const characters = [...(nextBible.characters || [])];
    
    let targetName = "名もなき登場人物";
    let oldVal: any = null;
    let newVal: any = null;

    const idx = findItemIdx(characters, op.targetId, op.targetName);
    const incoming = op.value;

    const mergeCharacterData = (char: Character, data: Partial<Character>) => {
        if (data.profile) Object.assign(char.profile, data.profile);
        if (data.state) Object.assign(char.state, data.state);
        if (Array.isArray(data.relationships)) {
            data.relationships.forEach((rel) => {
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
      const newChar: Character = {
        id: crypto.randomUUID(),
        profile: {
            name: ensureScalar(incoming.profile?.name || op.targetName),
            aliases: incoming.profile?.aliases || [],
            role: incoming.profile?.role || 'Supporting',
            description: incoming.profile?.description || '',
            appearance: incoming.profile?.appearance || '',
            personality: incoming.profile?.personality || '',
            background: incoming.profile?.background || '',
            voice: incoming.profile?.voice || { 
                firstPerson: '私', secondPerson: 'あなた', speechStyle: 'Casual', catchphrases: [], forbiddenWords: [] 
            },
            traits: incoming.profile?.traits || [],
            motivation: incoming.profile?.motivation || '',
            flaw: incoming.profile?.flaw || '',
            arc: incoming.profile?.arc || ''
        },
        state: {
            location: incoming.state?.location || '不明',
            health: incoming.state?.health || '良好',
            currentGoal: incoming.state?.currentGoal || '',
            socialStanding: incoming.state?.socialStanding || '',
            internalState: incoming.state?.internalState || '平常'
        },
        relationships: incoming.relationships || [],
        history: [],
        isPrivate: false
      };
      characters.push(newChar);
      targetName = newChar.profile.name;
      newVal = newChar;
    } else if (idx !== -1) {
      const current = JSON.parse(JSON.stringify(characters[idx])) as Character;
      targetName = current.profile.name;

      if (op.op === 'delete') {
        oldVal = current;
        characters.splice(idx, 1);
        newVal = "DELETED";
      } else {
        oldVal = JSON.parse(JSON.stringify(characters[idx]));
        mergeCharacterData(current, incoming);
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
    const incomingValue = op.value as any;

    if (idx === -1 && op.op !== 'delete') {
      const newItem: any = { id: crypto.randomUUID(), updatedAt: Date.now() };
      Object.assign(newItem, incomingValue);
      if (!newItem.title && !newItem.event && !newItem.name && !newItem.concept && op.targetName) {
        if (op.path === 'timeline') newItem.event = op.targetName;
        else if (op.path === 'themes') newItem.concept = op.targetName;
        else newItem.title = op.targetName;
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
        Object.assign(current, incomingValue);
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
    const collection = isBiblePath ? [...((nextBible as any)[history.path] || [])] : nextChapters;
    
    if (history.opType === 'delete') {
      collection.push(history.oldValue);
    } else if (history.oldValue === null) {
      const idx = collection.findIndex((i: any) => (i.title || i.event || i.name || i.concept) === history.targetName);
      if (idx !== -1) collection.splice(idx, 1);
    } else {
      const idx = collection.findIndex((i: any) => (i.title || i.event || i.name || i.concept) === history.targetName);
      if (idx !== -1) collection[idx] = history.oldValue;
    }
    if (isBiblePath) (nextBible as any)[history.path] = collection;
    else return { nextBible, nextChapters: collection };
    return { nextBible, nextChapters: ctx.chapters };
  }
}

export const STRATEGY_MAP: Record<SyncPath, SyncStrategy> = {
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
  volumes: new CollectionStrategy(),
  chapters: new CollectionStrategy(),
  nexusBranches: new CollectionStrategy()
};
