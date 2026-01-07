
import React from 'react';
import { GitBranch, Check, X } from 'lucide-react';
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

  return (
    <aside className={`flex flex-col bg-stone-900/40 ${className}`}>
       <div className="p-4 border-b border-white/5 bg-stone-900/60 backdrop-blur-md flex items-center justify-between shrink-0">
          <span className="text-[10px] font-black text-stone-500 uppercase tracking-widest flex items-center gap-2">
             Neural Sync Status
          </span>
          {onClose && (
            <button onClick={onClose} className="p-1 hover:bg-stone-800 rounded-lg text-stone-500 transition-colors">
              <X size={16} />
            </button>
          )}
       </div>
       
       <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-6">
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
