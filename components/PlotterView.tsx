
import { Users, Globe, Anchor, Clock, Network, GitBranch, MessageSquare, ChevronDown } from 'lucide-react';
import React from 'react';
import { usePlotterLogic } from '../hooks/usePlotterLogic';
import { t } from '../utils/i18n';

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
  const { state, data, actions } = usePlotterLogic();

  const TABS = [
    { id: 'grandArc', label: t('plotter.tab.grand_arc', state.lang), icon: <Anchor size={16} /> },
    { id: 'characters', label: t('plotter.tab.characters', state.lang), icon: <Users size={16} /> },
    { id: 'world', label: t('plotter.tab.world', state.lang), icon: <Globe size={16} /> },
    { id: 'timeline', label: t('plotter.tab.timeline', state.lang), icon: <Clock size={16} /> },
    { id: 'nexus', label: t('plotter.tab.nexus', state.lang), icon: <Network size={16} /> },
  ];

  return (
    <div className="h-full flex flex-col md:flex-row overflow-hidden bg-stone-950 pt-safe relative">
      <ThinkingIndicator phase={state.thinkingPhase} />
      
      {/* Mobile Chat Toggle FAB */}
      <div className="md:hidden fixed bottom-24 right-4 z-[80]">
         <button 
           onClick={actions.toggleMobileChat} 
           className={`p-4 rounded-full shadow-2xl transition-all active:scale-95 flex items-center justify-center relative ${state.isMobileChatOpen ? 'bg-stone-800 text-stone-400' : 'bg-orange-600 text-white shadow-orange-900/40'}`}
         >
           {state.isMobileChatOpen ? <ChevronDown size={24}/> : <MessageSquare size={24}/>}
           {!state.isMobileChatOpen && state.isTyping && (
             <span className="absolute -top-1 -right-1 flex h-3 w-3">
               <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75"></span>
               <span className="relative inline-flex rounded-full h-3 w-3 bg-sky-500"></span>
             </span>
           )}
         </button>
      </div>

      {/* Desktop Chat Sidebar */}
      <ArchitectChat 
        className="hidden md:flex w-[400px] lg:w-[480px] border-r border-white/5 bg-stone-900/40"
        isSyncing={state.isSyncing}
        displayHistory={state.displayHistory}
        input={state.input}
        setInput={actions.setInput}
        isTyping={state.isTyping}
        onSendMessage={actions.sendMessage}
      />

      {/* Mobile Chat Overlay (BottomSheet) */}
      <div 
        className={`md:hidden fixed inset-x-0 bottom-20 z-[90] transition-transform duration-300 ease-out flex flex-col shadow-[0_-10px_40px_-10px_rgba(0,0,0,0.5)] rounded-t-3xl overflow-hidden border-t border-white/10 glass-bright ${state.isMobileChatOpen ? 'translate-y-0 h-[60vh]' : 'translate-y-[120%]'}`}
      >
        <ArchitectChat 
          className="w-full h-full"
          isSyncing={state.isSyncing}
          displayHistory={state.displayHistory}
          input={state.input}
          setInput={actions.setInput}
          isTyping={state.isTyping}
          onSendMessage={actions.sendMessage}
          onClose={actions.closeMobileChat}
        />
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col bg-stone-950 relative overflow-hidden h-full">
        <header className="h-16 border-b border-white/5 flex items-center px-4 gap-2 md:gap-4 shrink-0 bg-stone-900/20 backdrop-blur-sm justify-between">
           <div className="flex items-center gap-2 overflow-x-auto no-scrollbar mask-gradient-right">
             {TABS.map(tab => (
               <button 
                 key={tab.id}
                 onClick={() => actions.setTab(tab.id)}
                 className={`flex items-center gap-2 px-3 md:px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${state.activeTab === tab.id ? 'bg-orange-600 text-white shadow-lg shadow-orange-900/20' : 'text-stone-500 hover:text-stone-300 hover:bg-white/5'}`}
               >
                 {tab.icon} <span className="hidden sm:inline">{tab.label}</span>
               </button>
             ))}
           </div>
           
           {data.pendingChanges.length > 0 && (
             <button 
               onClick={actions.toggleSyncPanel}
               className={`xl:hidden flex items-center gap-2 px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap border ${state.showSyncPanel ? 'bg-orange-500/10 text-orange-400 border-orange-500/30' : 'bg-stone-800 text-stone-400 border-transparent animate-pulse'}`}
             >
               <GitBranch size={14} />
               <span className="bg-orange-500 text-stone-900 px-1.5 rounded-full text-[9px]">{data.pendingChanges.length}</span>
             </button>
           )}
        </header>

        <div className="flex-1 flex overflow-hidden relative">
          <main className="flex-1 overflow-y-auto custom-scrollbar p-4 md:p-8 space-y-8 pb-32 md:pb-8">
             {state.activeTab === 'grandArc' && <GrandArcTab />}
             {state.activeTab === 'characters' && <CharactersTab onGeneratePortrait={actions.genPortrait} generatingCharId={state.generatingCharId} />}
             {state.activeTab === 'world' && <WorldTab />}
             {state.activeTab === 'timeline' && <TimelineTab />}
             {state.activeTab === 'nexus' && <NexusTab />}
          </main>
          
          <div className="hidden xl:flex w-80 border-l border-white/5 bg-stone-900/40 flex-col shrink-0">
             <NeuralSyncSidebar 
               pendingChanges={data.pendingChanges}
               sortedPendingChanges={data.sortedPendingChanges}
               bible={data.bible}
               chapters={data.chapters}
               onApplyOp={actions.applyOp}
               className="h-full"
             />
          </div>

          {state.showSyncPanel && (
            <div className="xl:hidden absolute inset-0 z-[100] flex justify-end bg-stone-950/50 backdrop-blur-sm animate-fade-in">
               <div className="w-full sm:w-80 h-full shadow-2xl animate-slide-in-right">
                  <NeuralSyncSidebar 
                    pendingChanges={data.pendingChanges}
                    sortedPendingChanges={data.sortedPendingChanges}
                    bible={data.bible}
                    chapters={data.chapters}
                    onApplyOp={actions.applyOp}
                    className="h-full bg-stone-900 border-l border-white/10"
                    onClose={actions.closeSyncPanel}
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
