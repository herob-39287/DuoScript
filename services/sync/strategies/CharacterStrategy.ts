import { SyncStrategy, SyncContext } from './types';
import { SyncOperation, HistoryEntry, Character } from '../../../types';
import { findItemIdx } from '../utils';
import { CharacterSyncSchema } from '../../validation/schemas';
import { z } from 'zod';

export class CharacterStrategy implements SyncStrategy {
  private mergeCharacterData(char: Character, data: z.infer<typeof CharacterSyncSchema>) {
    if (!data) return;

    const profile = data.profile || {};
    const state = data.state || {};
    const p = char.profile;
    const s = char.state;

    // Direct mapping from validated Zod object
    if (data.name) p.name = data.name;
    if (profile.name) p.name = profile.name;

    if (profile.aliases) p.aliases = profile.aliases;
    if (profile.role || data.role) p.role = (profile.role || data.role) as any;

    if (profile.description) p.description = profile.description;
    else if (data.description) p.description = data.description;

    if (profile.shortSummary) p.shortSummary = profile.shortSummary;
    else if (data.summary) p.shortSummary = data.summary;

    if (profile.appearance) p.appearance = profile.appearance;
    if (profile.personality) p.personality = profile.personality;
    if (profile.background) p.background = profile.background;
    if (profile.motivation) p.motivation = profile.motivation;
    if (profile.flaw) p.flaw = profile.flaw;
    if (profile.arc) p.arc = profile.arc;
    if (profile.traits) p.traits = profile.traits;

    if (profile.voice) {
      p.voice = { ...p.voice, ...profile.voice } as any;
    }

    if (state.location || data.location) s.location = state.location || data.location || s.location;
    if (state.health) s.health = state.health;
    if (state.currentGoal) s.currentGoal = state.currentGoal;
    if (state.internalState) s.internalState = state.internalState;
    if (state.socialStanding) s.socialStanding = state.socialStanding;

    if (data.relationships) {
      data.relationships.forEach((rel) => {
        const targetId = rel.targetId || rel.targetCharacterId;
        if (!targetId) return;

        const existingIdx = char.relationships.findIndex((r) => r.targetId === targetId);
        if (existingIdx !== -1) {
          const existing = char.relationships[existingIdx];
          char.relationships[existingIdx] = {
            ...existing,
            type: (rel.type || existing.type) as any,
            strength: rel.strength ?? existing.strength,
            description: rel.description || existing.description,
            lastChangedAt: 'Sync',
          };
        } else {
          char.relationships.push({
            targetId: targetId,
            type: (rel.type || 'Other') as any,
            strength: rel.strength || 0,
            description: rel.description || '',
            lastChangedAt: 'Sync',
          });
        }
      });
    }
  }

  apply(ctx: SyncContext, op: SyncOperation) {
    if (op.path !== 'characters') throw new Error('Invalid path for CharacterStrategy');
    const nextBible = { ...ctx.bible };
    const characters = [...(nextBible.characters || [])];

    // Zod Validation
    const parsed = CharacterSyncSchema.safeParse(op.value);
    if (!parsed.success) {
      throw new Error(`Invalid character data: ${parsed.error.message}`);
    }
    const incoming = parsed.data;

    let targetName = '名もなき登場人物';
    let oldVal: any = null;
    let newVal: any = null;

    const idx = op.op === 'add' ? -1 : findItemIdx(characters, op.targetId, op.targetName);

    if (idx === -1 && op.op !== 'delete') {
      const newChar: Character = {
        id: crypto.randomUUID(),
        profile: {
          name: incoming.profile?.name || incoming.name || op.targetName || '新キャラクター',
          aliases: incoming.profile?.aliases || [],
          role: (incoming.profile?.role || incoming.role || 'Supporting') as any,
          description: incoming.profile?.description || incoming.description || '',
          shortSummary:
            incoming.profile?.shortSummary || incoming.summary || '',
          appearance: incoming.profile?.appearance || '',
          personality: incoming.profile?.personality || '',
          background: incoming.profile?.background || '',
          voice: {
            firstPerson: '私',
            secondPerson: 'あなた',
            speechStyle: 'Casual',
            catchphrases: [],
            forbiddenWords: [],
          },
          traits: incoming.profile?.traits || [],
          motivation: incoming.profile?.motivation || '',
          flaw: incoming.profile?.flaw || '',
          arc: incoming.profile?.arc || '',
        },
        state: {
          location: incoming.state?.location || incoming.location || '不明',
          health: incoming.state?.health || '良好',
          currentGoal: incoming.state?.currentGoal || '',
          socialStanding: incoming.state?.socialStanding || '',
          internalState: incoming.state?.internalState || '平常',
        },
        relationships: [],
        history: [],
        isPrivate: false,
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
        newVal = 'DELETED';
      } else {
        oldVal = JSON.parse(JSON.stringify(characters[idx]));

        if (op.field) {
          // Manual field update fallback
          const parts = op.field.split('.');
          let targetObj: any = current;
          for (let i = 0; i < parts.length - 1; i++) {
            if (!targetObj[parts[i]]) targetObj[parts[i]] = {};
            targetObj = targetObj[parts[i]];
          }
          const leafKey = parts[parts.length - 1];
          targetObj[leafKey] = op.value;
        } else {
          this.mergeCharacterData(current, incoming);
        }

        current.history.push({
          timestamp: Date.now(),
          diff: op.rationale || 'Updated via NeuralSync',
        });
        newVal = current;
        characters[idx] = newVal;
      }
    }

    nextBible.characters = characters;
    return {
      nextBible,
      nextChapters: ctx.chapters,
      targetName: String(targetName),
      oldValue: oldVal,
      newValue: newVal,
    };
  }

  revert(ctx: SyncContext, history: HistoryEntry) {
    const nextBible = { ...ctx.bible };
    const characters = [...(nextBible.characters || [])];
    if (history.opType === 'delete') {
      characters.push(history.oldValue);
    } else if (history.oldValue === null || history.opType === 'add') {
      const idx = characters.findIndex((c) => c.profile.name === history.targetName);
      if (idx !== -1) characters.splice(idx, 1);
    } else {
      const idx = characters.findIndex((c) => c.profile.name === history.targetName);
      if (idx !== -1) {
        characters[idx] = history.oldValue;
      }
    }
    nextBible.characters = characters;
    return { nextBible, nextChapters: ctx.chapters };
  }
}
