
import React, { useState } from 'react';
import { useCharacters, useNotificationDispatch, useBible, useBibleDispatch, useMetadataDispatch, useMetadata, useManuscript, useNeuralSync } from '../../../contexts/StoryContext';
import { simulateBranch } from '../../../services/geminiService';
import * as Actions from '../../../store/actions';
import { NexusBranch } from '../../../types';
import { Card, Button, Badge } from '../../ui/DesignSystem';
import { GitBranch, Sparkles, Clock, AlertTriangle, ArrowRight, Trash2, RefreshCw } from 'lucide-react';

export const NexusTab: React.FC = () => {
  const bible = useBible();
  const bibleDispatch = useBibleDispatch();
  const meta = useMetadata();
  const metaDispatch = useMetadataDispatch();
  const chapters = useManuscript();
  const sync = useNeuralSync();
  const characters = useCharacters();
  const { addLog } = useNotificationDispatch();

  const [hypothesis, setHypothesis] = useState('');
  const [isSimulating, setIsSimulating] = useState(false);
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null);

  const activeBranch = bible.nexusBranches.find(b => b.id === selectedBranchId) || bible.nexusBranches[0];

  const handleSimulate = async () => {
    if (!hypothesis.trim() || isSimulating) return;
    setIsSimulating(true);
    addLog('info', 'Analysis', '因果律の分岐を計算中...');

    try {
      const result = await simulateBranch(
        hypothesis,
        { meta, bible, chapters, sync } as any,
        (u) => metaDispatch(Actions.trackUsage(u)),
        addLog
      );
      
      const newBranches = [result, ...bible.nexusBranches];
      bibleDispatch(Actions.updateBible({ nexusBranches: newBranches }));
      setSelectedBranchId(result.id);
      setHypothesis('');
      addLog('success', 'Analysis', '新たな世界線が観測されました。');
    } catch (e) {
      addLog('error', 'Analysis', 'シミュレーションに失敗しました。');
    } finally {
      setIsSimulating(false);
    }
  };

  const handleDelete = (id: string) => {
    const updated = bible.nexusBranches.filter(b => b.id !== id);
    bibleDispatch(Actions.updateBible({ nexusBranches: updated }));
    if (selectedBranchId === id) setSelectedBranchId(null);
  };

  return (
   <div className="space-y-6 animate-fade-in h-full flex flex-col max-w-6xl mx-auto">
      <div className="flex justify-between items-end shrink-0">
        <div>
          <h3 className="text-xl md:text-2xl font-display font-black text-white italic">Neural Nexus</h3>
          <p className="text-[10px] text-stone-500 font-serif mt-1">「もしも」の世界線を観測し、物語の可能性を探索します。</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 min-h-0">
        {/* Input & List Column */}
        <div className="lg:col-span-4 flex flex-col gap-4 min-h-0">
           <Card variant="glass" padding="md" className="space-y-4 shrink-0">
              <label className="text-[10px] font-black text-indigo-400 uppercase tracking-widest flex items-center gap-2">
                <Sparkles size={12}/> What If Scenario
              </label>
              <textarea 
                value={hypothesis}
                onChange={e => setHypothesis(e.target.value)}
                placeholder="例: もし主人公が最初の戦いで敗北していたら？"
                className="w-full bg-stone-950/50 border border-white/10 rounded-xl p-3 text-[11px] text-stone-200 outline-none focus:border-indigo-500/50 h-24 resize-none font-serif leading-relaxed"
              />
              <Button 
                onClick={handleSimulate} 
                isLoading={isSimulating} 
                disabled={!hypothesis.trim()}
                variant="indigo" 
                className="w-full"
                icon={<GitBranch size={14}/>}
              >
                シミュレート
              </Button>
           </Card>

           <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2 pr-2">
              {bible.nexusBranches.length === 0 && (
                <div className="text-center py-8 text-stone-600 text-[10px] italic border border-dashed border-stone-800 rounded-xl">
                  観測された分岐はありません。
                </div>
              )}
              {bible.nexusBranches.map(branch => (
                <div 
                  key={branch.id} 
                  onClick={() => setSelectedBranchId(branch.id)}
                  className={`p-3 rounded-xl border cursor-pointer transition-all group relative ${selectedBranchId === branch.id ? 'bg-indigo-900/20 border-indigo-500/40 shadow-lg' : 'bg-stone-900/40 border-white/5 hover:bg-stone-800'}`}
                >
                   <div className="text-[8px] font-mono text-stone-500 mb-1">{new Date(branch.timestamp).toLocaleDateString()}</div>
                   <div className="text-[11px] font-bold text-stone-200 line-clamp-2 leading-relaxed">"{branch.hypothesis}"</div>
                   
                   <button 
                     onClick={(e) => { e.stopPropagation(); handleDelete(branch.id); }}
                     className="absolute top-2 right-2 p-1.5 text-stone-600 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-opacity"
                   >
                     <Trash2 size={12}/>
                   </button>
                </div>
              ))}
           </div>
        </div>

        {/* Visualizer & Detail Column */}
        <div className="lg:col-span-8 flex flex-col min-h-0 relative">
           <div className="flex-1 glass-bright rounded-[2rem] border border-white/5 relative overflow-hidden flex flex-col">
              {/* Background Visuals */}
              <div className="absolute inset-0 flex items-center justify-center opacity-20 pointer-events-none">
                 <div className="relative w-[500px] h-[500px]">
                    <svg className="w-full h-full animate-[spin_60s_linear_infinite]">
                       <circle cx="250" cy="250" r="200" fill="none" stroke="#6366f1" strokeWidth="0.5" strokeDasharray="4 2" />
                       <circle cx="250" cy="250" r="150" fill="none" stroke="#d68a6d" strokeWidth="0.5" strokeDasharray="10 10" />
                    </svg>
                    {characters.slice(0, 5).map((char, i) => {
                       const angle = (i / 5) * 2 * Math.PI;
                       const x = Math.cos(angle) * 200 + 250;
                       const y = Math.sin(angle) * 200 + 250;
                       return (
                         <div key={char.id} className="absolute w-2 h-2 bg-stone-400 rounded-full" style={{ left: x, top: y }} />
                       );
                    })}
                 </div>
              </div>

              {activeBranch ? (
                <div className="relative z-10 p-6 md:p-8 flex-1 overflow-y-auto custom-scrollbar space-y-6">
                   <div className="space-y-2">
                      <Badge color="indigo">Active Branch View</Badge>
                      <h2 className="text-xl md:text-2xl font-display font-black text-white italic leading-tight">
                        "{activeBranch.hypothesis}"
                      </h2>
                   </div>

                   <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                         <div className="text-[10px] font-black text-rose-400 uppercase tracking-widest flex items-center gap-2">
                           <AlertTriangle size={12}/> Impact on Canon / 正史への影響
                         </div>
                         <div className="p-4 bg-rose-950/10 border border-rose-500/20 rounded-xl text-[11px] text-stone-300 font-serif leading-loose">
                            {activeBranch.impactOnCanon}
                         </div>
                      </div>
                      <div className="space-y-2">
                         <div className="text-[10px] font-black text-emerald-400 uppercase tracking-widest flex items-center gap-2">
                           <RefreshCw size={12}/> State Changes / 状態変化
                         </div>
                         <div className="p-4 bg-emerald-950/10 border border-emerald-500/20 rounded-xl text-[11px] text-stone-300 font-serif leading-loose">
                            {activeBranch.impactOnState}
                         </div>
                      </div>
                   </div>

                   <div className="space-y-2">
                      <div className="text-[10px] font-black text-indigo-400 uppercase tracking-widest flex items-center gap-2">
                        <Clock size={12}/> Alternate Timeline / 分岐した年表
                      </div>
                      <div className="space-y-2 border-l-2 border-indigo-500/20 ml-2 pl-4 py-2">
                         {activeBranch.alternateTimeline.map((event, i) => (
                           <div key={i} className="flex gap-3 items-start group">
                              <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-indigo-500/50 group-hover:bg-indigo-400 transition-colors shrink-0"/>
                              <p className="text-[11px] text-stone-400 font-serif leading-relaxed group-hover:text-stone-200 transition-colors">
                                {event}
                              </p>
                           </div>
                         ))}
                      </div>
                   </div>
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-stone-600 gap-4">
                   <GitBranch size={48} className="opacity-20"/>
                   <p className="text-[10px] font-black uppercase tracking-widest">Select a branch to view details</p>
                </div>
              )}
           </div>
        </div>
      </div>
   </div>
  );
};
