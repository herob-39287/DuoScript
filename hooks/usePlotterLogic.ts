import { useState, useMemo } from 'react';
import {
  useNeuralSync,
  useUI,
  useUIDispatch,
  useManuscript,
  useBible,
  useMetadata,
} from '../contexts/StoryContext';
import * as Actions from '../store/actions';
import { useNeuralSyncProcessor } from './useNeuralSyncProcessor';
import { useArchitectChat } from './useArchitectChat';
import { usePlotterActions } from './usePlotterActions';

export const usePlotterLogic = () => {
  // Contexts
  const sync = useNeuralSync();
  const chapters = useManuscript();
  const bible = useBible();
  const ui = useUI();
  const uiDispatch = useUIDispatch();
  const {
    preferences: { uiLanguage: lang },
  } = useMetadata();

  const { plotterTab: activeTab, thinkingPhase } = ui;
  const { pendingChanges } = sync;

  // --- Sub Hooks ---

  const chat = useArchitectChat();
  const plotterActions = usePlotterActions();
  const syncProcessor = useNeuralSyncProcessor(chat.isTyping);

  // --- UI Local State ---

  const [isMobileChatOpen, setIsMobileChatOpen] = useState(false);

  // --- Derived State ---

  const sortedPendingChanges = useMemo(() => {
    return [...pendingChanges].sort(
      (a, b) => (Number(b.timestamp) || 0) - (Number(a.timestamp) || 0),
    );
  }, [pendingChanges]);

  // --- Handlers ---

  const setTab = (tabId: string) => {
    uiDispatch(Actions.setPlotterTab(tabId));
  };

  const toggleMobileChat = () => setIsMobileChatOpen(!isMobileChatOpen);
  const toggleSyncPanel = () => syncProcessor.setShowSyncPanel(!syncProcessor.showSyncPanel);

  return {
    state: {
      activeTab,
      thinkingPhase,
      lang,
      isMobileChatOpen,
      showSyncPanel: syncProcessor.showSyncPanel,
      isSyncing: syncProcessor.isSyncing,
      input: chat.input,
      isTyping: chat.isTyping,
      displayHistory: chat.displayHistory,
      generatingCharId: plotterActions.generatingCharId,
    },
    data: {
      sync,
      chapters,
      bible,
      sortedPendingChanges,
      pendingChanges,
    },
    actions: {
      setTab,
      setInput: chat.setInput,
      sendMessage: chat.handleSendMessage,
      toggleMobileChat,
      toggleSyncPanel,
      applyOp: plotterActions.handleApplyOp,
      genPortrait: plotterActions.handleGenPortrait,
      closeMobileChat: () => setIsMobileChatOpen(false),
      closeSyncPanel: () => syncProcessor.setShowSyncPanel(false),
    },
  };
};
