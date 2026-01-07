
import { 
  SyncOperation, HistoryEntry, WorldBible, ChapterLog, Character, Foreshadowing,
  SyncPath
} from '../../types';
import { ensureScalar, findItemIdx } from './utils';
import { sanitize, isString } from '../gemini/utils';

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
  private mergeCharacterData(char: Character, data: any) {
    if (!data) return;
    
    const profile = data.profile || {};
    const state = data.state || {};
    const p = char.profile;
    const s = char.state;

    // Use sanitization to prevent overwriting with undefined/null
    // Also support flat keys directly from AI output
    p.name = sanitize(profile.name || data.name, isString, p.name);
    p.aliases = profile.aliases || data.aliases || p.aliases;
    p.role = profile.role || data.role || p.role;
    p.description = sanitize(profile.description || data.description, isString, p.description);
    // Map 'summary' from AI/Input to 'shortSummary' in model
    p.shortSummary = sanitize(profile.shortSummary || profile.summary || data.shortSummary || data.summary, isString, p.shortSummary);
    
    p.appearance = sanitize(profile.appearance || data.appearance, isString, p.appearance);
    p.personality = sanitize(profile.personality || data.personality, isString, p.personality);
    p.background = sanitize(profile.background || data.background, isString, p.background);
    p.motivation = sanitize(profile.motivation || data.motivation, isString, p.motivation);
    p.flaw = sanitize(profile.flaw || data.flaw, isString, p.flaw);
    p.arc = sanitize(profile.arc || data.arc, isString, p.arc);
    
    if (Array.isArray(profile.traits || data.traits)) {
      p.traits = profile.traits || data.traits;
    }

    if (data.voice || profile.voice) {
      p.voice = { ...p.voice, ...(profile.voice || data.voice) };
    }

    s.location = sanitize(state.location || data.location, isString, s.location);
    s.health = sanitize(state.health || data.health, isString, s.health);
    s.currentGoal = sanitize(state.currentGoal || data.currentGoal, isString, s.currentGoal);
    s.internalState = sanitize(state.internalState || data.internalState, isString, s.internalState);
    s.socialStanding = sanitize(state.socialStanding || data.socialStanding, isString, s.socialStanding);

    if (Array.isArray(data.relationships)) {
      data.relationships.forEach((rel: any) => {
        if (!rel.targetId) return;
        const existingIdx = char.relationships.findIndex(r => r.targetId === rel.targetId);
        if (existingIdx !== -1) {
          char.relationships[existingIdx] = { ...char.relationships[existingIdx], ...rel };
        } else {
          char.relationships.push({
            targetId: rel.targetId,
            type: rel.type || 'Other',
            strength: typeof rel.strength === 'number' ? rel.strength : 0,
            description: rel.description || '',
            lastChangedAt: 'Sync'
          });
        }
      });
    }
  }

  apply(ctx: SyncContext, op: SyncOperation) {
    if (op.path !== 'characters') throw new Error("Invalid path for CharacterStrategy");
    const nextBible = { ...ctx.bible };
    const characters = [...(nextBible.characters || [])];
    
    let targetName = "名もなき登場人物";
    let oldVal: any = null;
    let newVal: any = null;

    // op.op が 'add' の場合は検索をスキップして強制的に新規作成ルートへ
    const idx = op.op === 'add' ? -1 : findItemIdx(characters, op.targetId, op.targetName);
    const incoming = (op.value as any) || {};

    if (idx === -1 && op.op !== 'delete') {
      const newChar: Character = {
        id: crypto.randomUUID(),
        profile: {
          name: ensureScalar(incoming.profile?.name || incoming.name || op.targetName || "新キャラクター"),
          aliases: incoming.profile?.aliases || incoming.aliases || [],
          role: incoming.profile?.role || incoming.role || 'Supporting',
          description: incoming.profile?.description || incoming.description || '',
          shortSummary: incoming.profile?.shortSummary || incoming.profile?.summary || incoming.shortSummary || incoming.summary || '',
          appearance: incoming.profile?.appearance || incoming.appearance || '',
          personality: incoming.profile?.personality || incoming.personality || '',
          background: incoming.profile?.background || incoming.background || '',
          voice: incoming.profile?.voice || incoming.voice || { 
            firstPerson: '私', secondPerson: 'あなた', speechStyle: 'Casual', catchphrases: [], forbiddenWords: [] 
          },
          traits: incoming.profile?.traits || incoming.traits || [],
          motivation: incoming.profile?.motivation || incoming.motivation || '',
          flaw: incoming.profile?.flaw || incoming.flaw || '',
          arc: incoming.profile?.arc || incoming.arc || ''
        },
        state: {
          location: incoming.state?.location || incoming.location || '不明',
          health: incoming.state?.health || incoming.health || '良好',
          currentGoal: incoming.state?.currentGoal || incoming.currentGoal || '',
          socialStanding: incoming.state?.socialStanding || incoming.socialStanding || '',
          internalState: incoming.state?.internalState || incoming.internalState || '平常'
        },
        relationships: incoming.relationships || [],
        history: [],
        isPrivate: false
      };
      this.mergeCharacterData(newChar, incoming);
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
        
        if (op.field) {
          const parts = op.field.split('.');
          let targetObj: any = current;
          for (let i = 0; i < parts.length - 1; i++) {
            if (!targetObj[parts[i]]) targetObj[parts[i]] = {};
            targetObj = targetObj[parts[i]];
          }
          const leafKey = parts[parts.length - 1];
          // Use ensureScalar to unwrap wrapped values (e.g. { name: "Bob" } -> "Bob")
          targetObj[leafKey] = ensureScalar(op.value, leafKey);
        } else {
          this.mergeCharacterData(current, incoming);
        }

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

export class ForeshadowingStrategy implements SyncStrategy {
  apply(ctx: SyncContext, op: SyncOperation) {
    if (op.path !== 'foreshadowing') throw new Error("Invalid path for ForeshadowingStrategy");
    const nextBible = { ...ctx.bible };
    const items = [...(nextBible.foreshadowing || [])];
    
    let targetName = ensureScalar(op.targetName) || "伏線";
    let oldVal: any = null;
    let newVal: any = null;

    const idx = op.op === 'add' ? -1 : findItemIdx(items, op.targetId, op.targetName);
    const incoming = (op.value as any) || {};

    if (idx === -1 && op.op !== 'delete') {
      // Create new
      const newItem: Foreshadowing = {
        id: crypto.randomUUID(),
        title: incoming.title || targetName,
        description: incoming.description || "",
        shortSummary: incoming.shortSummary || "",
        status: incoming.status || 'Open',
        priority: incoming.priority || 'Medium',
        clues: incoming.clues || [],
        redHerrings: incoming.redHerrings || [],
        relatedEntityIds: incoming.relatedEntityIds || [],
        relatedThreadId: incoming.relatedThreadId,
        relatedThemeId: incoming.relatedThemeId
      };
      items.push(newItem);
      newVal = newItem;
      targetName = newItem.title;
    } else if (idx !== -1) {
      const current = { ...items[idx] };
      oldVal = { ...items[idx] };
      targetName = current.title;

      if (op.op === 'delete') {
        items.splice(idx, 1);
        newVal = "DELETED";
      } else {
        // Merge logic specialized for arrays
        if (incoming.title) current.title = incoming.title;
        if (incoming.description) current.description = incoming.description;
        if (incoming.status) current.status = incoming.status;
        if (incoming.priority) current.priority = incoming.priority;
        
        // Append arrays instead of overwrite if not empty, unless explicitly set
        if (incoming.clues && Array.isArray(incoming.clues)) {
           // 重複排除して追加
           const set = new Set([...current.clues, ...incoming.clues]);
           current.clues = Array.from(set);
        }
        if (incoming.redHerrings && Array.isArray(incoming.redHerrings)) {
           const set = new Set([...current.redHerrings, ...incoming.redHerrings]);
           current.redHerrings = Array.from(set);
        }
        if (incoming.relatedEntityIds && Array.isArray(incoming.relatedEntityIds)) {
           const set = new Set([...current.relatedEntityIds, ...incoming.relatedEntityIds]);
           current.relatedEntityIds = Array.from(set);
        }

        newVal = current;
        items[idx] = newVal;
      }
    }

    nextBible.foreshadowing = items;
    return { nextBible, nextChapters: ctx.chapters, targetName: String(targetName), oldValue: oldVal, newValue: newVal };
  }

  revert(ctx: SyncContext, history: HistoryEntry) {
    const nextBible = { ...ctx.bible };
    const items = [...(nextBible.foreshadowing || [])];
    
    if (history.opType === 'delete') {
      items.push(history.oldValue);
    } else if (history.oldValue === null || history.opType === 'add') {
      const idx = items.findIndex((i: any) => i.id === history.newValue?.id);
      if (idx !== -1) items.splice(idx, 1);
    } else {
      const idx = items.findIndex((i: any) => i.id === history.oldValue?.id);
      if (idx !== -1) items[idx] = history.oldValue;
    }
    
    nextBible.foreshadowing = items;
    return { nextBible, nextChapters: ctx.chapters };
  }
}

export class CollectionStrategy implements SyncStrategy {
  private getNamingField(path: string): string {
    switch (path) {
      case 'timeline': return 'event';
      case 'themes': return 'concept';
      case 'laws':
      case 'locations':
      case 'organizations':
      case 'races':
      case 'bestiary':
      case 'abilities':
      case 'keyItems': return 'name';
      case 'foreshadowing':
      case 'entries':
      case 'storyThreads':
      case 'storyStructure':
      case 'volumes':
      case 'chapters': return 'title';
      default: return 'title';
    }
  }

  apply(ctx: SyncContext, op: SyncOperation) {
    const isBiblePath = op.path !== 'chapters';
    const nextBible = { ...ctx.bible };
    const nextChapters = [...ctx.chapters];
    
    const collection = isBiblePath 
      ? [...((nextBible as any)[op.path] || [])]
      : nextChapters;

    const namingField = this.getNamingField(op.path);
    let targetName = ensureScalar(op.targetName) || "対象項目";
    let oldVal: any = null;
    let newVal: any = null;

    // op.op が 'add' の場合は検索をスキップして新規追加ルートへ。これにより同名でも別IDで作成される
    const idx = op.op === 'add' ? -1 : findItemIdx(collection, op.targetId, op.targetName);
    const incomingValue = (op.value as any) || {};

    if (idx === -1 && op.op !== 'delete') {
      const newItem: any = { id: crypto.randomUUID(), updatedAt: Date.now() };
      Object.assign(newItem, incomingValue);
      
      if (!newItem[namingField] && op.targetName) {
        newItem[namingField] = op.targetName;
      } else if (!newItem[namingField]) {
        newItem[namingField] = incomingValue.name || incomingValue.title || incomingValue.event || incomingValue.concept || "無題";
      }
      
      collection.push(newItem);
      targetName = newItem[namingField] || targetName;
      newVal = newItem;
    } else if (idx !== -1) {
      const current = { ...collection[idx] };
      targetName = current[namingField] || targetName;

      if (op.op === 'delete') {
        oldVal = current;
        collection.splice(idx, 1);
        newVal = "DELETED";
      } else {
        oldVal = { ...current };
        
        if (op.field) {
          // Use ensureScalar to unwrap wrapped values
          current[op.field] = ensureScalar(op.value, op.field);
        } else {
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
    const collection = isBiblePath ? [...((nextBible as any)[history.path] || [])] : nextChapters;
    const namingField = this.getNamingField(history.path);
    
    if (history.opType === 'delete') {
      collection.push(history.oldValue);
    } else if (history.oldValue === null || history.opType === 'add') {
      const idx = collection.findIndex((i: any) => (i.id === history.targetId) || i[namingField] === history.targetName);
      if (idx !== -1) collection.splice(idx, 1);
    } else {
      const idx = collection.findIndex((i: any) => (i.id === history.targetId) || i[namingField] === history.targetName);
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
  foreshadowing: new ForeshadowingStrategy(),
  entries: new CollectionStrategy(),
  volumes: new CollectionStrategy(),
  chapters: new CollectionStrategy(),
  nexusBranches: new CollectionStrategy()
};
