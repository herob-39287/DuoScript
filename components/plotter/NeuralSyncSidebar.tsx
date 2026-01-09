
import React, { useState } from 'react';
import { GitBranch, Check, X, Info, User, Map, Layers, Target } from 'lucide-react';
import { SyncOperation, WorldBible, ChapterLog } from '../../types';
import { ProposalItem } from './ProposalItem';
import { useNeuralSyncDispatch } from '../../contexts/StoryContext';
import * as Actions from '../../store/actions';

interface NeuralSyncSidebarProps {
  pendingChanges: SyncOperation[];
  sortedPendingChanges: SyncOperation[];
  bible: WorldBible;
  chapters: ChapterLog[];
  onApplyOp: (op: SyncOperation) => void;
  className?: string;
  onClose?: () => void;
}

export const NeuralSyncSidebar: React.FC<NeuralSyncSidebarProps> = ({
  pendingChanges,
  sortedPendingChanges,
  bible,
  chapters,
  onApplyOp,
  className = "",
  onClose
}) => {
  const syncDispatch = useNeuralSyncDispatch();
  const [showGuide, setShowGuide] = useState(false);

  return (
    <aside className={`flex flex-col bg-stone-900/40 ${className}`}>
       <div className="p-4 border-b border-white/5 bg-stone-900/60 backdrop-blur-md flex items-center justify-between shrink-0">
          <span className="text-[10px] font-black text-stone-500 uppercase tracking-widest flex items-center gap-2">
             Neural Sync Status
          </span>
          <div className="flex items-center gap-1">
            <button 
              onClick={() => setShowGuide(!showGuide)} 
              className={`p-1 rounded-lg transition-colors ${showGuide ? 'bg-indigo-500/20 text-indigo-400' : 'hover:bg-stone-800 text-stone-500'}`}
              title="同期ロジックの解説"
            >
              <Info size={16} />
            </button>
            {onClose && (
              <button onClick={onClose} className="p-1 hover:bg-stone-800 rounded-lg text-stone-500 transition-colors">
                <X size={16} />
              </button>
            )}
          </div>
       </div>
       
       <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-6">
         {showGuide && (
           <div className="space-y-3 animate-fade-in bg-stone-950/30 p-3 rounded-xl border border-white/5 mb-4">
             <h4 className="text-[9px] font-black text-stone-400 uppercase tracking-widest border-b border-white/5 pb-2 mb-2">Sync Logic Guide</h4>
             
             <div className="space-y-2">
               <div className="flex gap-2 items-start">
                 <div className="mt-0.5 p-1 bg-stone-800 rounded text-sky-400"><User size={10}/></div>
                 <div>
                   <div className="text-[9px] font-bold text-stone-300">Entities (存在)</div>
                   <p className="text-[8px] text-stone-500 leading-relaxed">キャラクターや組織。一時的な「状態(State)」と永続的な「進化(Profile)」を区別して抽出します。</p>
                 </div>
               </div>
               <div className="flex gap-2 items-start">
                 <div className="mt-0.5 p-1 bg-stone-800 rounded text-emerald-400"><Map size={10}/></div>
                 <div>
                   <div className="text-[9px] font-bold text-stone-300">Foundation (基盤)</div>
                   <p className="text-[8px] text-stone-500 leading-relaxed">場所、アイテム、理。所有権の移動や、場所の状態変化（破壊・復興）を追跡します。</p>
                 </div>
               </div>
               <div className="flex gap-2 items-start">
                 <div className="mt-0.5 p-1 bg-stone-800 rounded text-orange-400"><Layers size={10}/></div>
                 <div>
                   <div className="text-[9px] font-bold text-stone-300">Narrative (物語)</div>
                   <p className="text-[8px] text-stone-500 leading-relaxed">
                     <span className="text-orange-300 block">Grand Arc:</span> 物語全体のあらすじ・背骨。<br/>
                     <span className="text-orange-300 block mt-0.5">Structure:</span> 起承転結などの抽象的な構成。<br/>
                     <span className="text-orange-300 block mt-0.5">Chapters:</span> 具体的な章割り。
                   </p>
                 </div>
               </div>
               <div className="flex gap-2 items-start">
                 <div className="mt-0.5 p-1 bg-stone-800 rounded text-purple-400"><Target size={10}/></div>
                 <div>
                   <div className="text-[9px] font-bold text-stone-300">Foreshadowing (伏線)</div>
                   <p className="text-[8px] text-stone-500 leading-relaxed">伏線の設置(Plant)、手がかり(Progress)、回収(Payoff)のサイクルを管理します。</p>
                 </div>
               </div>
             </div>
           </div>
         )}

         <div className="space-y-3">
           <div className="flex items-center justify-between">
             <span className="text-[9px] font-black text-orange-400 uppercase tracking-widest flex items-center gap-2"><GitBranch size={10}/> 変更の提案 ({pendingChanges.length})</span>
           </div>
           {sortedPendingChanges.length === 0 ? (
             <div className="p-6 text-center border border-dashed border-stone-800 rounded-2xl">
               <Check size={16} className="text-emerald-500/50 mx-auto mb-2"/>
               <p className="text-[10px] text-stone-600 font-serif">全て同期されています。</p>
             </div>
           ) : (
             sortedPendingChanges.map((op) => (
               <ProposalItem 
                 key={op.id} 
                 op={op} 
                 bible={bible} 
                 chapters={chapters} 
                 isExpanded={true} 
                 onToggle={() => {}} 
                 onAccept={() => onApplyOp(op)} 
                 onReject={() => syncDispatch(Actions.removePendingOp(op.id))} 
               />
             ))
           )}
         </div>
       </div>
    </aside>
  );
};
