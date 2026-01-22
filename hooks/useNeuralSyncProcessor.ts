
import { useState, useEffect, useRef } from 'react';
import { 
  useNeuralSync, useMetadata, useBible, useManuscript, 
  useNeuralSyncDispatch, useMetadataDispatch, useNotificationDispatch 
} from '../contexts/StoryContext';
import { PromptBuilder } from '../services/gemini/promptBuilder';
import { detectSettingChange, extractSettingsFromChat } from '../services/geminiService';
import * as Actions from '../store/actions';
import { GeminiContent } from '../types';

export const useNeuralSyncProcessor = (isTyping: boolean) => {
  const sync = useNeuralSync();
  const meta = useMetadata();
  const bible = useBible();
  const chapters = useManuscript();
  const syncDispatch = useNeuralSyncDispatch();
  const metaDispatch = useMetadataDispatch();
  const { addLog } = useNotificationDispatch();

  const [isSyncing, setIsSyncing] = useState(false);
  const [showSyncPanel, setShowSyncPanel] = useState(false);
  const [lastSyncedId, setLastSyncedId] = useState<string | null>(null);
  const isInitializedRef = useRef(false);

  const { chatHistory, conversationMemory } = sync;

  // Initialization: Set cursor to end of history on mount to avoid reprocessing old chats
  useEffect(() => {
    if (!isInitializedRef.current) {
      if (chatHistory.length > 0) {
        setLastSyncedId(chatHistory[chatHistory.length - 1].id);
      }
      isInitializedRef.current = true;
    }
  }, [chatHistory]);

  // Background Consumer Loop
  useEffect(() => {
    // Only run if initialized, not currently typing (waiting for full response), and not already syncing
    if (!isInitializedRef.current || isTyping || isSyncing) return;

    // Determine pending messages
    let startIndex = 0;
    if (lastSyncedId) {
      const idx = chatHistory.findIndex(m => m.id === lastSyncedId);
      if (idx !== -1) startIndex = idx + 1;
    }

    // Nothing new to sync
    if (startIndex >= chatHistory.length) return;

    const pendingMessages = chatHistory.slice(startIndex);
    const userMessages = pendingMessages.filter(m => m.role === 'user');

    // If no user messages in the pending batch (e.g. only system/AI messages), just advance cursor
    if (userMessages.length === 0) {
      setLastSyncedId(pendingMessages[pendingMessages.length - 1].id);
      return;
    }

    const runBackgroundSync = async () => {
      const currentBatchLastId = pendingMessages[pendingMessages.length - 1].id;
      const combinedInput = userMessages.map(m => m.content).join("\n").trim();

      if (!combinedInput) {
        setLastSyncedId(currentBatchLastId);
        return;
      }

      setIsSyncing(true);
      try {
        // Create a snapshot of history up to the point we are processing
        const targetHistoryIndex = chatHistory.findIndex(m => m.id === currentBatchLastId);
        const processingHistory = chatHistory.slice(0, targetHistoryIndex + 1);
        
        const historyContent: GeminiContent[] = PromptBuilder.buildCompressedHistory({ ...sync, chatHistory: processingHistory });

        // 1. Detect Intent
        // Background process, so no visual thinking phase update for user to avoid distraction
        const detection = await detectSettingChange(combinedInput, (u) => metaDispatch(Actions.trackUsage(u)), addLog);

        if (detection.hasChangeIntent) {
          addLog('info', 'NeuralSync', 'バックグラウンドで設定抽出を実行中...');
          
          // 2. Extract Settings
          const extraction = await extractSettingsFromChat(
            historyContent, 
            { meta, bible, chapters, sync } as any, 
            conversationMemory || "", 
            detection, 
            (u) => metaDispatch(Actions.trackUsage(u)), 
            addLog
          );
          
          if (extraction.readyOps.length > 0) {
            syncDispatch(Actions.addPendingOps(extraction.readyOps));
            addLog('success', 'NeuralSync', `${extraction.readyOps.length}件の変更提案を抽出しました。`);
            if (window.innerWidth < 1280) setShowSyncPanel(true);
          }
        }
        
        // 3. Update Cursor
        setLastSyncedId(currentBatchLastId);

      } catch (e: any) {
        console.error("Background Sync Failed", e);
        // Even on error, we advance cursor to prevent infinite retry loops on bad input
        setLastSyncedId(currentBatchLastId);
      } finally {
        setIsSyncing(false);
      }
    };

    runBackgroundSync();

  }, [chatHistory, isTyping, isSyncing, lastSyncedId, sync, meta, bible, chapters, conversationMemory, metaDispatch, syncDispatch, addLog]);

  return {
    isSyncing,
    showSyncPanel,
    setShowSyncPanel
  };
};
