
import React from 'react';
import { ChevronDown, ChevronUp, X, ArrowRight } from 'lucide-react';
import { SyncOperation, WorldBible } from '../../types';
import { VisualDiff } from './VisualDiff';
import { getCurrentValueForDiff } from '../../services/bibleManager';

interface ProposalItemProps {
  op: SyncOperation;
  bible: WorldBible;
  isExpanded: boolean;
  onToggle: () => void;
  onAccept: () => void;
  onReject: () => void;
}

export const ProposalItem = React.memo(({ op, bible, isExpanded, onToggle, onAccept, onReject }: ProposalItemProps) => {
  const currentValue = getCurrentValueForDiff(bible, op.path, op.targetName, op.field);
  return (
    <div className={`glass-bright rounded-2xl border transition-all ${isExpanded ? 'border-orange-500/40 shadow-2xl' : 'border-white/5'}`}>
      <button onClick={onToggle} className="w-full p-4 flex items-center justify-between text-left">
        <div className="flex-1 min-w-0 pr-4">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[7px] font-black text-orange-400 bg-orange-400/10 px-1.5 py-0.5 rounded uppercase">{op.path}</span>
            <span className="text-[7px] font-black text-stone-500 uppercase">{op.op}</span>
          </div>
          <div className="text-[11px] font-bold text-stone-100 truncate">{op.targetName} {op.field && <span className="text-stone-600 ml-1">({op.field})</span>}</div>
        </div>
        {isExpanded ? <ChevronUp size={14} className="text-stone-600"/> : <ChevronDown size={14} className="text-stone-600"/>}
      </button>
      {isExpanded && (
        <div className="px-4 pb-4 space-y-4 animate-fade-in border-t border-white/5 pt-4 overflow-hidden">
          <div className="space-y-3">
             <span className="text-[8px] font-black text-stone-600 uppercase tracking-widest">変更のプレビュー (Diff)</span>
             <VisualDiff oldVal={currentValue} newVal={op.value} />
          </div>
          <div className="p-3 bg-stone-950/40 rounded-xl space-y-2">
            <span className="text-[8px] font-black text-emerald-400 uppercase tracking-widest">アーキテクトの論理</span>
            <p className="text-[10px] text-stone-400 font-serif italic leading-relaxed">{op.rationale}</p>
          </div>
          <div className="flex gap-2 pt-2">
            <button onClick={onReject} className="flex-1 py-3 bg-stone-800 text-stone-400 hover:text-white rounded-xl text-[9px] font-black uppercase transition-colors"><X size={14}/></button>
            <button onClick={onAccept} className="flex-1 py-3 bg-orange-600 text-white rounded-xl text-[9px] font-black uppercase shadow-lg shadow-orange-950/20 active:scale-95 flex items-center justify-center gap-2">適用する <ArrowRight size={14}/></button>
          </div>
        </div>
      )}
    </div>
  );
});
