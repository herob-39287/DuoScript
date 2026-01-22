
import { useState } from 'react';
import { 
  useBible, useManuscript, useMetadata, useCharacters, 
  useBibleDispatch, useNeuralSyncDispatch, useMetadataDispatch, useNotificationDispatch, useNeuralSync
} from '../contexts/StoryContext';
import * as Actions from '../store/actions';
import { SyncOperation } from '../types';
import { calculateSyncResult } from '../services/bibleManager';
import { generateCharacterPortrait } from '../services/geminiService';
import { savePortrait as savePortraitToDB } from '../services/storageService';

export const usePlotterActions = () => {
  const bible = useBible();
  const chapters = useManuscript();
  const meta = useMetadata();
  const characters = useCharacters();
  const sync = useNeuralSync();
  
  const bibleDispatch = useBibleDispatch();
  const syncDispatch = useNeuralSyncDispatch();
  const metaDispatch = useMetadataDispatch();
  const { addLog } = useNotificationDispatch();

  const [generatingCharId, setGeneratingCharId] = useState<string | null>(null);

  const handleApplyOp = async (op: SyncOperation) => {
    try {
      await new Promise(resolve => setTimeout(resolve, 50));
      const { nextBible, nextChapters, historyEntry } = calculateSyncResult(bible, chapters, op, sync.history);
      bibleDispatch(Actions.applySyncOp(nextBible, nextChapters, historyEntry));
      syncDispatch(Actions.addHistoryEntry(historyEntry));
      syncDispatch(Actions.removePendingOp(op.id));
      addLog('success', 'NeuralSync', `設定を更新しました: ${historyEntry.targetName || op.path}`);
    } catch (e: any) {
      addLog('error', 'NeuralSync', `適用エラー: ${e.message}`);
      
      if (e.message.includes("Integrity Error") || e.message.includes("Target ID")) {
        syncDispatch(Actions.updatePendingOp(op.id, {
          targetId: undefined,
          targetName: op.targetName || "Unknown",
          status: 'needs_resolution',
          resolutionHint: "対象が見つかりません。再検索してください。"
        }));
      }
    }
  };

  const handleGenPortrait = async (charId: string) => {
    const char = characters.find(c => c.id === charId);
    if (!char || generatingCharId) return;
    setGeneratingCharId(charId);
    addLog('info', 'Artist', `${char.profile.name} の肖像画を描いています...`);
    try {
      const base64 = await generateCharacterPortrait(char, { meta, bible } as any, (u) => metaDispatch(Actions.trackUsage(u)), addLog);
      
      // Save full image data to IndexedDB
      await savePortraitToDB(meta.id, char.id, base64);
      
      // Update state with just the ID (Reference), triggers UI reload via usePortrait
      // The previous implementation stored base64 here, which we avoid now.
      const updatedChar = { ...char, imageUrl: char.id };
      const nextChars = bible.characters.map(c => c.id === charId ? updatedChar : c);
      bibleDispatch(Actions.updateBible({ characters: nextChars }));
      
      addLog('success', 'Artist', '肖像画が完成しました。');
    } catch (e) {
      addLog('error', 'Artist', '肖像画の生成に失敗しました。');
    } finally {
      setGeneratingCharId(null);
    }
  };

  return {
    handleApplyOp,
    handleGenPortrait,
    generatingCharId
  };
};
