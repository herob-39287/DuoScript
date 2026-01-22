
import { ChevronDown, ChevronUp, X, ArrowRight, AlertCircle, Search, User, Globe, Check, Plus, Beaker } from 'lucide-react';
import React, { useState, useMemo, useCallback } from 'react';
import { SyncOperation, WorldBible, ChapterLog } from '../../types';
import { VisualDiff } from './VisualDiff';
import { getCurrentValueForDiff } from '../../services/bibleManager';
import { useNeuralSyncDispatch, useMetadata } from '../../contexts/StoryContext';
import * as Actions from '../../store/actions';
import { Styles, Txt } from '../ui/DesignSystem';
import { t } from '../../utils/i18n';

interface ProposalItemProps {
  op: SyncOperation;
  bible: WorldBible;
  chapters: ChapterLog[];
  isExpanded: boolean;
  onToggle: () => void;
  onAccept: () => void | Promise<void>;
  onReject: () => void;
}

export const ProposalItem = React.memo(({ op, bible, chapters, isExpanded, onToggle, onAccept, onReject }: ProposalItemProps) => {
  const syncDispatch = useNeuralSyncDispatch();
  const { preferences: { uiLanguage: lang } } = useMetadata();
  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isApplying, setIsApplying] = useState(false);

  const currentValue = getCurrentValueForDiff(bible, chapters, op.path, op.targetName, op.field);
  const isSemanticInvalid = op.status === 'needs_resolution';
  const isHypothetical = !!op.isHypothetical;
  
  // 伏線アクションの判定
  const isForeshadowingAction = op.path === 'foreshadowing';
  let foreshadowingActionType: 'plant' | 'progress' | 'payoff' | 'misc' = 'misc';
  if (isForeshadowingAction) {
    if (op.op === 'add') foreshadowingActionType = 'plant';
    else if ((op.value as any)?.status === 'Resolved') foreshadowingActionType = 'payoff';
    else if ((op.value as any)?.clues?.length > 0 || (op.value as any)?.redHerrings?.length > 0) foreshadowingActionType = 'progress';
  }

  const allPossibleTargets = useMemo(() => {
    const list = op.path === 'chapters' ? chapters : (bible as any)[op.path];
    if (!Array.isArray(list)) return [];
    return list.map((item: any) => ({
      id: item.id,
      name: item.name || item.title || item.event || "Unnamed",
      type: op.path
    }));
  }, [bible, chapters, op.path]);

  const filteredTargets = useMemo(() => {
    if (!searchQuery.trim()) return allPossibleTargets.slice(0, 5);
    return allPossibleTargets.filter(t => t.name.toLowerCase().includes(searchQuery.toLowerCase())).slice(0, 10);
  }, [allPossibleTargets, searchQuery]);

  const resolveId = useCallback((id: string) => {
    if (!id) return undefined;
    const char = bible.characters.find(c => c.id === id);
    if (char) return char.profile.name;
    const item = bible.keyItems.find(i => i.id === id);
    if (item) return item.name;
    const loc = bible.locations.find(l => l.id === id);
    if (loc) return loc.name;
    const org = bible.organizations.find(o => o.id === id);
    if (org) return org.name;
    const entry = bible.entries.find(e => e.id === id);
    if (entry) return entry.title;
    return undefined;
  }, [bible]);

  const handleSelectCandidate = (candId: string, candName: string) => {
    syncDispatch(Actions.updatePendingOp(op.id, {
      targetId: candId,
      targetName: candName,
      status: 'proposal',
      resolutionHint: undefined
    }));
    setIsSearching(false);
  };

  const handleSetAsNew = () => {
    syncDispatch(Actions.updatePendingOp(op.id, {
      op: 'add',
      status: 'proposal',
      resolutionHint: undefined
    }));
    setIsSearching(false);
  };

  const handleAccept = async () => {
    if (isApplying) return;
    setIsApplying(true);
    try {
      await onAccept();
    } finally {
      setIsApplying(false);
    }
  };

  const renderTargetName = () => {
    if (typeof op.targetName === 'string') return op.targetName;
    if (op.targetName === null || op.targetName === undefined) return "---";
    const obj = op.targetName as any;
    return String(obj.name || obj.title || obj.event || "[Object]");
  };

  return (
    <div className={`glass-bright rounded-2xl border transition-all ${isExpanded ? (isHypothetical ? 'border-indigo-500/40 shadow-[0_10px_40px_-10px_rgba(99,102,241,0.3)]' : 'border-orange-500/40 shadow-2xl') : 'border-white/5'} ${isSemanticInvalid ? 'border-rose-500/40' : ''}`}>
      <button onClick={onToggle} className="w-full p-4 flex items-center justify-between text-left">
        <div className="flex-1 min-w-0 pr-4">
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-[7px] font-black px-1.5 py-0.5 rounded uppercase ${isHypothetical ? 'bg-indigo-500/20 text-indigo-400' : (isSemanticInvalid ? 'bg-rose-500/10 text-rose-400' : 'bg-orange-400/10 text-orange-400')}`}>
              {t(`path.${op.path}`, lang)} {isHypothetical && '(Nexus)'}
            </span>
            <span className="text-[7px] font-black text-stone-500 uppercase">{op.op}</span>
            {isSemanticInvalid && <AlertCircle size={10} className="text-rose-400 animate-pulse" />}
            {isHypothetical && <Beaker size={10} className="text-indigo-400" />}
            {isForeshadowingAction && (
              <>
                {foreshadowingActionType === 'plant' && <span className="text-[7px] font-black bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded uppercase">Plant 🌱</span>}
                {foreshadowingActionType === 'payoff' && <span className="text-[7px] font-black bg-purple-500/20 text-purple-400 px-1.5 py-0.5 rounded uppercase">Payoff 💥</span>}
                {foreshadowingActionType === 'progress' && <span className="text-[7px] font-black bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded uppercase">Clue 🔍</span>}
              </>
            )}
          </div>
          <div className={`text-[11px] font-bold truncate ${isHypothetical ? 'text-indigo-200' : (isSemanticInvalid ? 'text-rose-200' : 'text-stone-100')}`}>
            {renderTargetName()} {op.field && <span className="text-stone-600 ml-1">({op.field})</span>}
          </div>
        </div>
        {isExpanded ? <ChevronUp size={14} className="text-stone-600"/> : <ChevronDown size={14} className="text-stone-600"/>}
      </button>

      {isExpanded && (
        <div className="px-4 pb-4 space-y-4 animate-fade-in border-t border-white/5 pt-4 overflow-hidden">
          {isHypothetical && (
            <div className="p-3 bg-indigo-500/5 border border-indigo-500/10 rounded-xl space-y-1">
              <div className={`${Styles.text.labelSm} text-indigo-400 flex items-center gap-1`}><Beaker size={10}/> {t('sync.nexus.title', lang)}</div>
              <Txt variant="bodySm" className="text-indigo-300/70 italic">{t('sync.nexus.desc', lang)}</Txt>
            </div>
          )}

          {isSemanticInvalid && (
             <div className="space-y-3">
               <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl space-y-1">
                 <div className={`${Styles.text.labelSm} text-rose-400 flex items-center gap-1`}><AlertCircle size={10}/> {t('sync.status.needs_resolution', lang)}</div>
                 <Txt variant="bodySm" className="text-rose-200 italic">{op.resolutionHint || t('sync.msg.unidentified', lang)}</Txt>
               </div>

               <div className="space-y-2">
                 <div className="flex items-center justify-between">
                   <Txt variant="labelSm">{t('sync.action.link', lang)}</Txt>
                   <button onClick={() => setIsSearching(!isSearching)} className="text-[9px] font-black text-orange-400 hover:text-white uppercase tracking-widest flex items-center gap-1 transition-colors">
                     {isSearching ? <X size={10}/> : <Search size={10}/>} {isSearching ? t('sync.action.close', lang) : t('sync.action.search', lang)}
                   </button>
                 </div>

                 {isSearching ? (
                   <div className="space-y-2 animate-fade-in">
                     <input 
                       autoFocus
                       value={searchQuery}
                       onChange={e => setSearchQuery(e.target.value)}
                       placeholder={t('sync.placeholder.search', lang)}
                       className="w-full bg-stone-950 border border-white/10 rounded-xl px-3 py-2 text-[10px] text-white outline-none focus:border-orange-500/40"
                     />
                     <div className="max-h-32 overflow-y-auto no-scrollbar space-y-1">
                       {filteredTargets.map(t => (
                         <button key={t.id} onClick={() => handleSelectCandidate(t.id, t.name)} className="w-full text-left p-2 hover:bg-white/5 rounded-lg flex items-center justify-between group">
                           <div className="flex items-center gap-2">
                             {t.type === 'characters' ? <User size={10} className="text-stone-600"/> : <Globe size={10} className="text-stone-600"/>}
                             <span className="text-[10px] text-stone-300 group-hover:text-white">{t.name}</span>
                           </div>
                           <Check size={10} className="text-emerald-500 opacity-0 group-hover:opacity-100"/>
                         </button>
                       ))}
                       <button onClick={handleSetAsNew} className="w-full text-left p-2 hover:bg-orange-600/10 rounded-lg flex items-center gap-2 group border border-dashed border-stone-800">
                          <Plus size={10} className="text-orange-400"/>
                          <span className="text-[10px] text-orange-400">{t('sync.action.add_new', lang)}</span>
                       </button>
                     </div>
                   </div>
                 ) : (
                   <div className="grid grid-cols-1 gap-1">
                     {(op.candidates || []).map(cand => (
                       <button key={cand.id} onClick={() => handleSelectCandidate(cand.id, cand.name)} className="flex items-center justify-between p-3 bg-stone-900 border border-white/5 rounded-xl hover:border-orange-500/30 transition-all group">
                         <div className="flex flex-col">
                           <span className="text-[10px] font-bold text-stone-200 text-left">{cand.name}</span>
                           <span className={Styles.text.labelXxs}>{t(cand.reason, lang) || cand.reason} ({t('sync.label.confidence', lang)}: {Math.round(cand.confidence * 100)}%)</span>
                         </div>
                         <ArrowRight size={12} className="text-stone-700 group-hover:text-orange-400 group-hover:translate-x-1 transition-all"/>
                       </button>
                     ))}
                     <button onClick={handleSetAsNew} className="p-3 border border-dashed border-stone-800 rounded-xl text-[9px] font-black text-stone-600 hover:text-orange-400 hover:border-orange-500/20 text-center uppercase tracking-widest transition-all">{t('sync.action.create_new', lang)}</button>
                   </div>
                 )}
               </div>
             </div>
          )}

          <div className="space-y-3">
             <Txt variant="labelSm">{t('sync.label.preview', lang)}</Txt>
             <VisualDiff oldVal={currentValue} newVal={op.value} resolver={resolveId} />
          </div>

          <div className="p-3 bg-stone-950/40 rounded-xl space-y-2">
            <span className={`${Styles.text.labelSm} ${isHypothetical ? 'text-indigo-400' : 'text-emerald-400'}`}>{t('sync.label.rationale', lang)}</span>
            <Txt variant="bodySm" className="italic">{String(op.rationale || "")}</Txt>
          </div>

          <div className="flex gap-2 pt-2">
            <button onClick={onReject} className="flex-1 py-3 bg-stone-800 text-stone-400 hover:text-white rounded-xl text-[9px] font-black uppercase transition-colors"><X size={14}/></button>
            <button 
              onClick={handleAccept} 
              disabled={isSemanticInvalid || isApplying}
              className={`flex-1 py-3 rounded-xl text-[9px] font-black uppercase shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2 ${isSemanticInvalid || isApplying ? 'bg-stone-800 text-stone-600 cursor-not-allowed' : (isHypothetical ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-900/40' : 'bg-orange-600 text-white hover:bg-orange-500 shadow-orange-950/20')}`}
            >
              {isApplying ? <span className="animate-spin">...</span> : <>{isHypothetical ? t('sync.btn.fix', lang) : t('sync.btn.apply', lang)} <ArrowRight size={14}/></>}
            </button>
          </div>
        </div>
      )}
    </div>
  );
});
