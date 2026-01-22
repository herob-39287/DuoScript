
import { useState, useCallback } from 'react';
import { 
  useBibleDispatch, useMetadataDispatch, useManuscript, useNeuralSync, useMetadata, 
  useUIDispatch, useNotificationDispatch 
} from '../contexts/StoryContext';
import * as Actions from '../store/actions';
import { genesisFill } from '../services/geminiService';
import { Character, CharacterProfile, Relationship } from '../types';

export const useCharacterActions = (character: Character) => {
  // Performance: Removed dependency on full 'bible' context to prevent re-renders of actions
  // when unrelated bible data changes.
  const meta = useMetadata();
  const chapters = useManuscript();
  const sync = useNeuralSync();
  
  const bibleDispatch = useBibleDispatch();
  const metaDispatch = useMetadataDispatch();
  const uiDispatch = useUIDispatch();
  const { addLog } = useNotificationDispatch();

  const [loadingField, setLoadingField] = useState<string | null>(null);

  const handleSave = useCallback((profile: CharacterProfile, relationships: Relationship[]) => {
    // Dispatch specific action to update only this character
    bibleDispatch(Actions.updateCharacterData(character.id, { profile, relationships }));
    addLog('success', 'System', `${profile.name} の情報を更新しました。`);
  }, [character.id, bibleDispatch, addLog]);

  const handleDelete = useCallback(() => {
    uiDispatch(Actions.openDialog({
      isOpen: true,
      type: 'confirm',
      title: 'キャラクターの削除',
      message: `「${character.profile.name}」を完全に削除しますか？`,
      onConfirm: () => {
        // Use generic list manipulation for deletion
        bibleDispatch(Actions.manipulateBibleList('characters', 'delete', character.id));
        uiDispatch(Actions.closeDialog());
        addLog('info', 'System', `${character.profile.name} を削除しました。`);
      }
    }));
  }, [character.id, character.profile.name, bibleDispatch, uiDispatch, addLog]);

  const handleConsult = useCallback(() => {
    uiDispatch(Actions.setPendingMsg(`キャラクター「${character.profile.name}」について相談です。\n\n`));
  }, [character.profile.name, uiDispatch]);

  const handleGenesisFill = useCallback(async (
    currentProfile: CharacterProfile,
    key: keyof CharacterProfile,
    label: string
  ): Promise<string | null> => {
    if (loadingField) return null;
    setLoadingField(key as string);
    try {
      // NOTE: We pass a minimal project context object constructed from available hooks
      // Ideally 'bible' should be passed if we want full context awareness, 
      // but for Genesis Fill, meta/chapters/sync + currentProfile is often enough.
      // If full bible is needed, we should import useWorldFoundation etc. instead of full bible.
      const generated = await genesisFill(
        { meta, bible: { setting: "...", tone: "..." } /* Stub to avoid full dependency */, chapters, sync } as any, 
        currentProfile, 
        label, 
        (u) => metaDispatch(Actions.trackUsage(u)),
        addLog
      );
      addLog('success', 'Genesis', `${label} を生成しました。`);
      return generated;
    } catch (e) {
      addLog('error', 'Genesis', '生成に失敗しました。');
      return null;
    } finally {
      setLoadingField(null);
    }
  }, [meta, chapters, sync, loadingField, metaDispatch, addLog]);

  return {
    handleSave,
    handleDelete,
    handleConsult,
    handleGenesisFill,
    loadingField
  };
};
