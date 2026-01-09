
import { 
  Users, Globe, Anchor, Clock, Network, Database, MessageSquare, GitBranch, X
} from 'lucide-react';
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { ChatMessage, SyncOperation, GeminiContent, Artifact } from '../types';
import { chatWithArchitectStream, extractSettingsFromChat, detectSettingChange, generateCharacterPortrait, summarizeConversation } from '../services/geminiService';
import { saveArtifact } from '../services/storageService';
import { PromptBuilder } from '../services/gemini/promptBuilder';
import { 
  useNeuralSync, useUI, useMetadata, useManuscript,
  useMetadataDispatch, useBibleDispatch, useNeuralSyncDispatch, 
  useUIDispatch, useNotificationDispatch,
  useCharacters, useBible
} from '../contexts/StoryContext';
import * as Actions from '../store/actions';
import { calculateSyncResult } from '../services/bibleManager';
import { savePortrait as savePortraitToDB } from '../services/storageService';

// Sub-components
import { ArchitectChat } from './plotter/ArchitectChat';
import { NeuralSyncSidebar } from './plotter/NeuralSyncSidebar';
import { GrandArcTab } from './plotter/tabs/GrandArcTab';
import { CharactersTab } from './plotter/tabs/CharactersTab';
import { WorldTab } from './plotter/tabs/WorldTab';
import { TimelineTab } from './plotter/tabs/TimelineTab';
import { NexusTab } from './plotter/tabs/NexusTab';
import { ThinkingIndicator } from './ui/ThinkingIndicator';

const PlotterView: React.FC = () => {
  const meta = useMetadata();
  const metaDispatch = useMetadataDispatch();
  const bibleDispatch = useBibleDispatch();
  const chapters = useManuscript();
  const sync = useNeuralSync();
  const syncDispatch = useNeuralSyncDispatch();
  
  const characters = useCharacters();
  const bible = useBible(); 

  const ui = useUI();
  const uiDispatch = useUIDispatch();
  const { plotterTab: activeTab, pendingMsg, isContextActive, thinkingPhase } = ui;
  const { addLog } = useNotificationDispatch();

  const { chatHistory, archivedChat, conversationMemory, pendingChanges, history: bibleHistory } = sync;

  // Ref to track latest sync state to avoid stale closures in async handlers
  const syncRef = useRef(sync);
  useEffect(() => {
    syncRef.current = sync;
  }, [sync]);

  const [mobileMode, setMobileMode] = useState<'chat' | 'bible'>('bible');
  const [showSyncPanel, setShowSyncPanel] = useState(false);

  const displayHistory = useMemo(() => {
    return [...(archivedChat || []), ...chatHistory];
  }, [archivedChat, chatHistory]);

  const sortedPendingChanges = useMemo(() => {
    return [...pendingChanges].sort((a, b) => (Number(b.timestamp) || 0) - (Number(a.timestamp) || 0));
  }, [pendingChanges]);

  const TABS = [
    { id: 'grandArc', label: '構想・あらすじ', icon: <Anchor size={16} /> },
    { id: 'characters', label: '登場人物', icon: <Users size={16} /> },
    { id: 'world', label: '世界観・設定', icon: <Globe size={16} /> },
    { id: 'timeline', label: '年表・伏線', icon: <Clock size={16} /> },
    { id: 'nexus', label: 'Nexus (関係図)', icon: <Network size={16} /> },
  ];

  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [generatingCharId, setGeneratingCharId] = useState<string | null>(null);

  // --- Neural Sync Queue Logic ---
  const [lastSyncedId, setLastSyncedId] = useState<string | null>(null);
  const isInitializedRef = useRef(false);

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

  // --- Main Chat Handler ---

  useEffect(() => {
    if (pendingMsg) {
      setInput(pendingMsg);
      setMobileMode('chat');
      uiDispatch(Actions.setPendingMsg(null));
    }
  }, [pendingMsg, uiDispatch]);

  const handleSendMessage = async () => {
    if (!input.trim() || isTyping) return;
    
    // 1. Update UI immediately
    const userMsg: ChatMessage = { id: crypto.randomUUID(), role: 'user', content: input, timestamp: Date.now(), kind: 'dialogue' };
    
    // NOTE: syncDispatch triggers a state update, but the 'chatHistory' variable in this closure remains stale.
    // We must pass the new list manually to the next dispatch for UI continuity, 
    // but for the API call, we should rely on the ref or careful construction.
    const newChatHistory = [...chatHistory, userMsg];
    syncDispatch(Actions.setChatHistory(newChatHistory));
    
    setInput('');
    setIsTyping(true);
    uiDispatch(Actions.setThinkingPhase("Consulting RAG..."));

    try {
      // 2. Build API Context
      const currentSyncState = syncRef.current;
      const historyContent: GeminiContent[] = PromptBuilder.buildCompressedHistory(currentSyncState);
      
      const aiMsgId = crypto.randomUUID();
      const initialAiMsg: ChatMessage = { id: aiMsgId, role: 'model', content: '', timestamp: Date.now(), kind: 'dialogue' };
      
      let currentHistory = [...newChatHistory, initialAiMsg];
      syncDispatch(Actions.setChatHistory(currentHistory));

      uiDispatch(Actions.setThinkingPhase("Architect Reasoning..."));

      const stream = chatWithArchitectStream(
        historyContent, 
        userMsg.content, 
        { meta, bible, chapters, sync: currentSyncState } as any, 
        currentSyncState.conversationMemory || "", 
        meta.preferences.allowSearch, 
        (u) => metaDispatch(Actions.trackUsage(u)),
        addLog,
        isContextActive
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
      if (currentHistory.length > 10) {
         // Background task, no indicator needed
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
              syncDispatch(Actions.consolidateChat(newMem, 5));
              addLog('info', 'System', '対話記憶を長期メモリに統合しました。');
           })
           .catch(() => {});
      }

    } catch (e: any) {
      addLog('error', 'Architect', `応答の生成に失敗しました: ${e.message}`);
    } finally {
      setIsTyping(false);
      uiDispatch(Actions.setThinkingPhase(null));
    }
  };

  const handleApplyOp = async (op: SyncOperation) => {
    try {
      await new Promise(resolve => setTimeout(resolve, 50));
      const { nextBible, nextChapters, historyEntry } = calculateSyncResult(bible, chapters, op, bibleHistory);
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
      const updatedChar = { ...char, imageUrl: base64 };
      const nextChars = bible.characters.map(c => c.id === charId ? updatedChar : c);
      bibleDispatch(Actions.updateBible({ characters: nextChars }));
      savePortraitToDB(meta.id, char.id, base64);
      addLog('success', 'Artist', '肖像画が完成しました。');
    } catch (e) {
      addLog('error', 'Artist', '肖像画の生成に失敗しました。');
    } finally {
      setGeneratingCharId(null);
    }
  };

  return (
    <div className="h-full flex flex-col md:flex-row overflow-hidden bg-stone-950 pt-safe relative">
      <ThinkingIndicator phase={thinkingPhase} />
      
      <div className="md:hidden fixed top-[calc(env(safe-area-inset-top)+1rem)] right-4 z-[100] flex bg-stone-900/80 backdrop-blur rounded-full border border-white/10 p-1 shadow-2xl">
         <button 
           onClick={() => setMobileMode('bible')} 
           className={`p-2.5 rounded-full transition-all ${mobileMode === 'bible' ? 'bg-orange-600 text-white' : 'text-stone-500'}`}
         >
           <Database size={18}/>
         </button>
         <button 
           onClick={() => setMobileMode('chat')} 
           className={`p-2.5 rounded-full transition-all ${mobileMode === 'chat' ? 'bg-orange-600 text-white' : 'text-stone-500'}`}
         >
           <MessageSquare size={18}/>
         </button>
      </div>

      <ArchitectChat 
        mobileMode={mobileMode}
        isSyncing={isSyncing}
        displayHistory={displayHistory}
        input={input}
        setInput={setInput}
        isTyping={isTyping}
        onSendMessage={handleSendMessage}
      />

      <div className={`${mobileMode === 'bible' ? 'flex' : 'hidden md:flex'} flex-1 flex flex-col bg-stone-950 relative overflow-hidden h-full`}>
        <header className="h-16 border-b border-white/5 flex items-center px-4 gap-2 md:gap-4 shrink-0 bg-stone-900/20 backdrop-blur-sm justify-between">
           <div className="flex items-center gap-2 overflow-x-auto no-scrollbar mask-gradient-right">
             {TABS.map(tab => (
               <button 
                 key={tab.id}
                 onClick={() => uiDispatch(Actions.setPlotterTab(tab.id))}
                 className={`flex items-center gap-2 px-3 md:px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeTab === tab.id ? 'bg-orange-600 text-white shadow-lg shadow-orange-900/20' : 'text-stone-500 hover:text-stone-300 hover:bg-white/5'}`}
               >
                 {tab.icon} <span className="hidden sm:inline">{tab.label}</span>
               </button>
             ))}
           </div>
           
           {pendingChanges.length > 0 && (
             <button 
               onClick={() => setShowSyncPanel(!showSyncPanel)}
               className={`xl:hidden flex items-center gap-2 px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap border ${showSyncPanel ? 'bg-orange-500/10 text-orange-400 border-orange-500/30' : 'bg-stone-800 text-stone-400 border-transparent animate-pulse'}`}
             >
               <GitBranch size={14} />
               <span className="bg-orange-500 text-stone-900 px-1.5 rounded-full text-[9px]">{pendingChanges.length}</span>
             </button>
           )}
        </header>

        <div className="flex-1 flex overflow-hidden relative">
          <main className="flex-1 overflow-y-auto custom-scrollbar p-4 md:p-8 space-y-8 pb-32 md:pb-8">
             {activeTab === 'grandArc' && <GrandArcTab />}
             {activeTab === 'characters' && <CharactersTab onGeneratePortrait={handleGenPortrait} generatingCharId={generatingCharId} />}
             {activeTab === 'world' && <WorldTab />}
             {activeTab === 'timeline' && <TimelineTab />}
             {activeTab === 'nexus' && <NexusTab />}
          </main>
          
          <div className="hidden xl:flex w-80 border-l border-white/5 bg-stone-900/40 flex-col shrink-0">
             <NeuralSyncSidebar 
               pendingChanges={pendingChanges}
               sortedPendingChanges={sortedPendingChanges}
               bible={bible}
               chapters={chapters}
               onApplyOp={handleApplyOp}
               className="h-full"
             />
          </div>

          {showSyncPanel && (
            <div className="xl:hidden absolute inset-0 z-50 flex justify-end bg-stone-950/50 backdrop-blur-sm animate-fade-in">
               <div className="w-full sm:w-80 h-full shadow-2xl animate-slide-in-right">
                  <NeuralSyncSidebar 
                    pendingChanges={pendingChanges}
                    sortedPendingChanges={sortedPendingChanges}
                    bible={bible}
                    chapters={chapters}
                    onApplyOp={handleApplyOp}
                    className="h-full bg-stone-900 border-l border-white/10"
                    onClose={() => setShowSyncPanel(false)}
                  />
               </div>
            </div>
          )}
        </div>
      </div>
      <style>{`
        .mask-gradient-right { mask-image: linear-gradient(to right, black 90%, transparent 100%); }
        .animate-slide-in-right { animation: slideInRight 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        @keyframes slideInRight { from { transform: translateX(100%); } to { transform: translateX(0); } }
      `}</style>
    </div>
  );
};

export default PlotterView;
