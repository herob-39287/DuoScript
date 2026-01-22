
import { useState, useEffect, useRef, useMemo } from 'react';
import { 
  useNeuralSync, useUI, useMetadata, useManuscript, useBible,
  useNeuralSyncDispatch, useMetadataDispatch, useUIDispatch, useNotificationDispatch 
} from '../contexts/StoryContext';
import * as Actions from '../store/actions';
import { PromptBuilder } from '../services/gemini/promptBuilder';
import { chatWithArchitectStream, summarizeConversation, identifyRelevantEntities } from '../services/geminiService';
import { ChatMessage, GeminiContent } from '../types';

export const useArchitectChat = () => {
  const meta = useMetadata();
  const metaDispatch = useMetadataDispatch();
  const bible = useBible();
  const chapters = useManuscript();
  const sync = useNeuralSync();
  const syncDispatch = useNeuralSyncDispatch();
  const ui = useUI();
  const uiDispatch = useUIDispatch();
  const { addLog } = useNotificationDispatch();

  const { chatHistory, archivedChat, conversationMemory } = sync;
  const { pendingMsg, isContextActive } = ui;

  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  // Ref to track latest sync state to avoid stale closures in async handlers
  const syncRef = useRef(sync);
  useEffect(() => {
    syncRef.current = sync;
  }, [sync]);

  // Handle external pending messages (e.g. from "Consult" buttons)
  useEffect(() => {
    if (pendingMsg) {
      setInput(pendingMsg);
      // Removed setMobileMode logic from here as it is now handled by PlotterView
      uiDispatch(Actions.setPendingMsg(null));
    }
  }, [pendingMsg, uiDispatch]);

  const displayHistory = useMemo(() => {
    return [...(archivedChat || []), ...chatHistory];
  }, [archivedChat, chatHistory]);

  const handleSendMessage = async () => {
    if (!input.trim() || isTyping) return;
    
    // 1. Update UI immediately
    const userMsg: ChatMessage = { id: crypto.randomUUID(), role: 'user', content: input, timestamp: Date.now(), kind: 'dialogue' };
    
    // Optimistic update
    const newChatHistory = [...chatHistory, userMsg];
    syncDispatch(Actions.setChatHistory(newChatHistory));
    
    setInput('');
    setIsTyping(true);

    try {
      // 2. Build API Context
      const currentSyncState = syncRef.current;
      const historyContent: GeminiContent[] = PromptBuilder.buildCompressedHistory(currentSyncState);
      
      const aiMsgId = crypto.randomUUID();
      const initialAiMsg: ChatMessage = { id: aiMsgId, role: 'model', content: '', timestamp: Date.now(), kind: 'dialogue' };
      
      let currentHistory = [...newChatHistory, initialAiMsg];
      syncDispatch(Actions.setChatHistory(currentHistory));

      // 3. RAG Pre-calculation (if needed)
      let relevantIds: string[] = [];
      if (isContextActive) {
        uiDispatch(Actions.setThinkingPhase("Consulting RAG..."));
        
        const contextText = historyContent.map(h => h.parts[0].text).join("\n") + "\n" + userMsg.content;
        try {
          relevantIds = await identifyRelevantEntities(
            contextText,
            { meta, bible, chapters, sync: currentSyncState } as any,
            (u) => metaDispatch(Actions.trackUsage(u)),
            addLog
          );
        } catch (e) {
          console.warn("RAG failed", e);
        }
      }

      uiDispatch(Actions.setThinkingPhase("Architect Reasoning..."));

      const stream = chatWithArchitectStream(
        historyContent, 
        userMsg.content, 
        { meta, bible, chapters, sync: currentSyncState } as any, 
        currentSyncState.conversationMemory || "", 
        meta.preferences.allowSearch, 
        (u) => metaDispatch(Actions.trackUsage(u)),
        addLog,
        isContextActive,
        relevantIds
      );

      let accumulatedText = "";
      let accumulatedSources: any[] = [];
      let firstChunk = true;

      for await (const chunk of stream) {
        if (firstChunk) {
          uiDispatch(Actions.setThinkingPhase(null));
          firstChunk = false;
        }
        accumulatedText += chunk.text;
        if (chunk.sources) accumulatedSources = chunk.sources;
        
        const updatedAiMsg = { ...initialAiMsg, content: accumulatedText, sources: accumulatedSources };
        currentHistory = [...newChatHistory, updatedAiMsg];
        syncDispatch(Actions.setChatHistory(currentHistory));
      }

      // Summarization Check
      if (currentHistory.length > 6) {
         const fullHistoryForSummary: GeminiContent[] = [
           ...historyContent, 
           { role: 'user', parts: [{ text: userMsg.content }] }, 
           { role: 'model', parts: [{ text: accumulatedText }] }
         ];
         summarizeConversation(
           currentSyncState.conversationMemory || "", 
           fullHistoryForSummary, 
           (u) => metaDispatch(Actions.trackUsage(u)), 
           () => {}
         ).then(newMem => {
              syncDispatch(Actions.consolidateChat(newMem, 2));
              addLog('info', 'System', '対話記憶を長期メモリに統合しました。');
           })
           .catch(() => {});
      }

    } catch (e: any) {
      if (e.message?.includes("SAFETY_BLOCK")) {
        const warningMsg: ChatMessage = { 
          id: crypto.randomUUID(), 
          role: 'model', 
          content: '⚠️ 安全ガイドラインにより、この応答はブロックされました。別の表現で試すか、話題を変更してください。', 
          timestamp: Date.now(), 
          kind: 'system_note' 
        };
        syncDispatch(Actions.setChatHistory([...newChatHistory, warningMsg]));
        addLog('error', 'Safety', 'Safety Policy Triggered');
      } else {
        addLog('error', 'Architect', `応答の生成に失敗しました: ${e.message}`);
      }
    } finally {
      setIsTyping(false);
      uiDispatch(Actions.setThinkingPhase(null));
    }
  };

  return {
    input,
    setInput,
    isTyping,
    handleSendMessage,
    displayHistory
  };
};
