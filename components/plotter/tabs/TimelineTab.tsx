
import React from 'react';
import { Layers, Clock, GitBranch, Target, Link2, User, Search, AlertCircle, MessageSquare } from 'lucide-react';
import { useBible, useUIDispatch } from '../../../contexts/StoryContext';
import * as Actions from '../../../store/actions';
import { Badge } from '../../ui/DesignSystem';

export const TimelineTab: React.FC = () => {
  const bible = useBible();
  const uiDispatch = useUIDispatch();

  const getEntityName = (id: string) => {
    const char = bible.characters.find(c => c.id === id);
    if(char) return char.profile.name;
    const item = bible.keyItems.find(i => i.id === id);
    if(item) return item.name;
    const loc = bible.locations.find(l => l.id === id);
    if(loc) return loc.name;
    const org = bible.organizations.find(o => o.id === id);
    if(org) return org.name;
    return "Unknown Entity";
  };

  const handleConsultForeshadowing = (title: string, type: 'clue' | 'payoff') => {
    const text = type === 'clue' 
      ? `伏線「${title}」について、読者に気づかせるためのさりげない手がかり(Clues)を考えたいです。`
      : `伏線「${title}」の回収(Payoff)方法について相談したいです。`;
    
    uiDispatch(Actions.setPendingMsg(text));
  };

  return (
    <div className="space-y-8 animate-fade-in max-w-5xl mx-auto">
        {/* Story Structure */}
        <div className="space-y-4">
            <h3 className="text-[10px] font-black text-stone-600 uppercase tracking-widest flex items-center gap-2"><Layers size={14}/> Structure / 構成フェーズ</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                {bible.storyStructure.length === 0 ? (
                    <div className="col-span-full p-6 border border-dashed border-stone-800 rounded-2xl text-center text-stone-600 text-[10px]">構成はまだ定義されていません。</div>
                ) : (
                    bible.storyStructure.map((phase) => (
                        <div key={phase.id} className="p-4 bg-stone-900/40 border border-white/5 rounded-2xl space-y-2">
                            <div className="text-[10px] font-black text-orange-400 uppercase tracking-widest">{phase.name}</div>
                            <div className="text-[11px] text-stone-300 font-serif">{phase.summary}</div>
                            <div className="text-[9px] text-stone-500 font-serif italic">Goal: {phase.goal}</div>
                        </div>
                    ))
                )}
            </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Chronology */}
            <div className="lg:col-span-2 space-y-4">
                <h3 className="text-[10px] font-black text-stone-600 uppercase tracking-widest flex items-center gap-2"><Clock size={14}/> Chronology / 年表</h3>
                <div className="relative border-l border-white/10 ml-3 space-y-6 pl-6 py-2">
                    {bible.timeline.length === 0 ? (
                        <div className="text-stone-600 text-[10px] italic">イベントはありません。</div>
                    ) : (
                        bible.timeline.map((event) => (
                            <div key={event.id} className="relative group">
                                <div className="absolute -left-[29px] top-1.5 w-3 h-3 rounded-full bg-stone-800 border-2 border-stone-950 group-hover:bg-orange-500 transition-colors"/>
                                <div className="space-y-1">
                                    <span className="text-[9px] font-black text-orange-400 uppercase tracking-widest block">{event.timeLabel}</span>
                                    <h4 className="text-[12px] font-bold text-stone-200">{event.event}</h4>
                                    <p className="text-[10px] text-stone-400 font-serif leading-relaxed">{event.description}</p>
                                    
                                    <div className="flex flex-wrap items-center gap-2 pt-1">
                                      {event.status === 'Hypothesis' && <span className="text-[8px] bg-indigo-500/20 text-indigo-300 px-1 rounded">Hypothesis</span>}
                                      {event.involvedCharacterIds && event.involvedCharacterIds.length > 0 && (
                                        <div className="flex flex-wrap gap-1">
                                          {event.involvedCharacterIds.map(eid => (
                                            <Badge key={eid} color="stone" className="flex items-center gap-1 opacity-70">
                                              <User size={8} /> {getEntityName(eid)}
                                            </Badge>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Threads & Foreshadowing */}
            <div className="space-y-8">
                 <div className="space-y-4">
                    <h3 className="text-[10px] font-black text-stone-600 uppercase tracking-widest flex items-center gap-2"><GitBranch size={14}/> Threads / 伏線スレッド</h3>
                    <div className="space-y-2">
                        {bible.storyThreads.map((thread) => (
                            <div key={thread.id} className="p-3 bg-stone-900/40 border border-white/5 rounded-xl">
                                <div className="flex justify-between">
                                    <span className="text-[10px] font-bold text-stone-300">{thread.title}</span>
                                    <span className={`text-[8px] px-1 rounded uppercase ${thread.status === 'Resolved' ? 'text-emerald-500' : 'text-orange-500'}`}>{thread.status}</span>
                                </div>
                            </div>
                        ))}
                        {bible.storyThreads.length === 0 && <div className="text-stone-600 text-[10px] italic">スレッドはありません。</div>}
                    </div>
                 </div>

                 <div className="space-y-4">
                    <h3 className="text-[10px] font-black text-stone-600 uppercase tracking-widest flex items-center gap-2"><Target size={14}/> Foreshadowing / 伏線リスト</h3>
                    <div className="space-y-3">
                        {bible.foreshadowing.map((item) => (
                            <div key={item.id} className="p-3 bg-stone-900/40 border border-white/5 rounded-xl space-y-2 group">
                                <div className="flex justify-between items-start">
                                    <span className="text-[10px] font-bold text-stone-300">{item.title}</span>
                                    <span className={`text-[8px] px-1 rounded uppercase ${item.status === 'Resolved' ? 'text-emerald-500' : 'text-stone-500'}`}>{item.status}</span>
                                </div>
                                <p className="text-[9px] text-stone-500 font-serif truncate">{item.description}</p>
                                
                                {(item.clues?.length > 0 || item.redHerrings?.length > 0) && (
                                  <div className="grid grid-cols-1 gap-1.5 pt-2 border-t border-white/5">
                                    {item.clues?.length > 0 && (
                                      <div className="flex gap-2 items-start">
                                        <Search size={10} className="text-emerald-500 mt-0.5 shrink-0"/>
                                        <div className="flex-1">
                                          <div className="text-[8px] font-black text-emerald-500 uppercase tracking-widest">Clues</div>
                                          <ul className="text-[9px] text-stone-400 font-serif list-disc list-inside">
                                            {item.clues.map((c, i) => <li key={i}>{c}</li>)}
                                          </ul>
                                        </div>
                                      </div>
                                    )}
                                    {item.redHerrings?.length > 0 && (
                                      <div className="flex gap-2 items-start">
                                        <AlertCircle size={10} className="text-rose-500 mt-0.5 shrink-0"/>
                                        <div className="flex-1">
                                          <div className="text-[8px] font-black text-rose-500 uppercase tracking-widest">Misleads</div>
                                          <ul className="text-[9px] text-stone-400 font-serif list-disc list-inside">
                                            {item.redHerrings.map((c, i) => <li key={i}>{c}</li>)}
                                          </ul>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                )}

                                <div className="flex gap-2 pt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                   <button 
                                     onClick={() => handleConsultForeshadowing(item.title, 'clue')}
                                     className="flex-1 py-1.5 bg-stone-800 hover:bg-stone-700 rounded text-[9px] text-stone-400 hover:text-white flex items-center justify-center gap-1 transition-colors"
                                   >
                                     <Search size={10}/> 手がかり相談
                                   </button>
                                   <button 
                                     onClick={() => handleConsultForeshadowing(item.title, 'payoff')}
                                     className="flex-1 py-1.5 bg-stone-800 hover:bg-stone-700 rounded text-[9px] text-stone-400 hover:text-white flex items-center justify-center gap-1 transition-colors"
                                   >
                                     <MessageSquare size={10}/> 回収案相談
                                   </button>
                                </div>

                                {item.relatedEntityIds && item.relatedEntityIds.length > 0 && (
                                  <div className="flex flex-wrap gap-1 pt-1 border-t border-white/5">
                                    {item.relatedEntityIds.map(eid => (
                                      <Badge key={eid} color="stone" className="flex items-center gap-1">
                                        <Link2 size={8} /> {getEntityName(eid)}
                                      </Badge>
                                    ))}
                                  </div>
                                )}
                            </div>
                        ))}
                        {bible.foreshadowing.length === 0 && <div className="text-stone-600 text-[10px] italic">伏線リストはありません。</div>}
                    </div>
                 </div>
            </div>
        </div>
    </div>
  );
};
