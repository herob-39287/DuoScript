import React, { useState } from 'react';
import {
  Layers,
  Clock,
  GitBranch,
  Target,
  Link2,
  User,
  Search,
  AlertCircle,
  MessageSquare,
  Plus,
  Edit2,
  Trash2,
} from 'lucide-react';
import {
  useUIDispatch,
  useBibleDispatch,
  useManuscript,
  usePlotPlan,
  useCharacters,
  useGeography,
  useKnowledge,
} from '../../../contexts/StoryContext';
import * as Actions from '../../../store/actions';
import { Badge } from '../../ui/DesignSystem';
import { ItemEditorModal, ItemType } from '../ItemEditorModal';
import { WorldBible, BibleArrayKeys } from '../../../types';

export const TimelineTab: React.FC = () => {
  const plot = usePlotPlan();
  const characters = useCharacters();
  const geography = useGeography();
  const knowledge = useKnowledge();
  const bibleDispatch = useBibleDispatch();
  const uiDispatch = useUIDispatch();
  const chapters = useManuscript();

  const [editor, setEditor] = useState<{ isOpen: boolean; type: ItemType; initialData?: any }>({
    isOpen: false,
    type: 'timeline',
  });

  const getEntityName = (id: string) => {
    const char = characters?.find((c) => c.id === id);
    if (char) return char.profile.name;
    const item = knowledge?.keyItems.find((i) => i.id === id);
    if (item) return item.name;
    const loc = geography?.locations.find((l) => l.id === id);
    if (loc) return loc.name;
    const org = geography?.organizations.find((o) => o.id === id);
    if (org) return org.name;
    return 'Unknown Entity';
  };

  const handleConsultForeshadowing = (title: string, type: 'clue' | 'payoff') => {
    const text =
      type === 'clue'
        ? `伏線「${title}」について、読者に気づかせるためのさりげない手がかり(Clues)を考えたいです。`
        : `伏線「${title}」の回収(Payoff)方法について相談したいです。`;

    uiDispatch(Actions.setPendingMsg(text));
  };

  const openEditor = (type: ItemType, initialData?: any) => {
    setEditor({ isOpen: true, type, initialData });
  };

  const handleDelete = (type: ItemType, id: string, name: string) => {
    uiDispatch(
      Actions.openDialog({
        isOpen: true,
        type: 'confirm',
        title: '項目の削除',
        message: `「${name}」を削除してもよろしいですか？`,
        onConfirm: () => {
          const pathMap: Record<ItemType, keyof WorldBible | ''> = {
            timeline: 'timeline',
            foreshadowing: 'foreshadowing',
            thread: 'storyThreads',
            structure: 'storyStructure',
            law: '',
            location: '',
            organization: '',
            item: '',
            entry: '',
            race: '',
            bestiary: '',
            ability: '',
            volume: '',
            chapter: '',
            theme: '',
          };
          const path = pathMap[type];
          if (!path) return;

          bibleDispatch(Actions.manipulateBibleList(path as BibleArrayKeys, 'delete', id));
          uiDispatch(Actions.closeDialog());
        },
      }),
    );
  };

  const handleSave = (data: any) => {
    const pathMap: Record<ItemType, keyof WorldBible | ''> = {
      timeline: 'timeline',
      foreshadowing: 'foreshadowing',
      thread: 'storyThreads',
      structure: 'storyStructure',
      law: '',
      location: '',
      organization: '',
      item: '',
      entry: '',
      race: '',
      bestiary: '',
      ability: '',
      volume: '',
      chapter: '',
      theme: '',
    };
    const path = pathMap[editor.type];
    if (!path) return;

    if (data.id) {
      // Update
      bibleDispatch(
        Actions.manipulateBibleList(path as BibleArrayKeys, 'update', data.id, undefined, data),
      );
    } else {
      // Create
      const newItem = { ...data, id: crypto.randomUUID() };
      bibleDispatch(Actions.manipulateBibleList(path as BibleArrayKeys, 'add', undefined, newItem));
    }
  };

  if (!plot) return null;

  return (
    <div className="space-y-8 animate-fade-in max-w-5xl mx-auto">
      {/* Story Structure */}
      <div className="space-y-4">
        <div className="flex justify-between items-end">
          <h3 className="text-[10px] font-black text-stone-600 uppercase tracking-widest flex items-center gap-2">
            <Layers size={14} /> Structure / 構成フェーズ
          </h3>
          <button
            onClick={() => openEditor('structure')}
            className="p-1.5 bg-stone-800 hover:bg-orange-600 hover:text-white text-stone-500 rounded-lg transition-all"
          >
            <Plus size={14} />
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          {plot.storyStructure.length === 0 ? (
            <div className="col-span-full p-6 border border-dashed border-stone-800 rounded-2xl text-center text-stone-600 text-[10px]">
              構成はまだ定義されていません。
            </div>
          ) : (
            plot.storyStructure.map((phase) => (
              <div
                key={phase.id}
                className="p-4 bg-stone-900/40 border border-white/5 rounded-2xl space-y-2 relative group hover:border-orange-500/20 transition-all"
              >
                <div className="text-[10px] font-black text-orange-400 uppercase tracking-widest">
                  {phase.name}
                </div>
                <div className="text-[11px] text-stone-300 font-serif">{phase.summary}</div>
                <div className="text-[9px] text-stone-500 font-serif italic">
                  Goal: {phase.goal}
                </div>
                <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                  <button
                    onClick={() => openEditor('structure', phase)}
                    className="p-1 bg-stone-800 text-stone-500 hover:text-white rounded"
                  >
                    <Edit2 size={10} />
                  </button>
                  <button
                    onClick={() => handleDelete('structure', phase.id, phase.name)}
                    className="p-1 bg-stone-800 text-stone-500 hover:text-rose-400 rounded"
                  >
                    <Trash2 size={10} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Chronology */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex justify-between items-end">
            <h3 className="text-[10px] font-black text-stone-600 uppercase tracking-widest flex items-center gap-2">
              <Clock size={14} /> Chronology / 年表
            </h3>
            <button
              onClick={() => openEditor('timeline')}
              className="p-1.5 bg-stone-800 hover:bg-orange-600 hover:text-white text-stone-500 rounded-lg transition-all"
            >
              <Plus size={14} />
            </button>
          </div>
          <div className="relative border-l border-white/10 ml-3 space-y-6 pl-6 py-2">
            {plot.timeline.length === 0 ? (
              <div className="text-stone-600 text-[10px] italic">イベントはありません。</div>
            ) : (
              plot.timeline.map((event) => (
                <div key={event.id} className="relative group">
                  <div className="absolute -left-[29px] top-1.5 w-3 h-3 rounded-full bg-stone-800 border-2 border-stone-950 group-hover:bg-orange-500 transition-colors" />
                  <div className="space-y-1 pr-12">
                    <span className="text-[9px] font-black text-orange-400 uppercase tracking-widest block">
                      {event.timeLabel}
                    </span>
                    <h4 className="text-[12px] font-bold text-stone-200">{event.event}</h4>
                    <p className="text-[10px] text-stone-400 font-serif leading-relaxed">
                      {event.description}
                    </p>

                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      {event.status === 'Hypothesis' && (
                        <span className="text-[8px] bg-indigo-500/20 text-indigo-300 px-1 rounded">
                          Hypothesis
                        </span>
                      )}
                      {event.involvedCharacterIds && event.involvedCharacterIds.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {event.involvedCharacterIds.map((eid) => (
                            <Badge
                              key={eid}
                              color="stone"
                              className="flex items-center gap-1 opacity-70"
                            >
                              <User size={8} /> {getEntityName(eid)}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="absolute top-0 right-0 flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                      <button
                        onClick={() => openEditor('timeline', event)}
                        className="p-1.5 bg-stone-800 text-stone-500 hover:text-white rounded"
                      >
                        <Edit2 size={12} />
                      </button>
                      <button
                        onClick={() => handleDelete('timeline', event.id, event.event)}
                        className="p-1.5 bg-stone-800 text-stone-500 hover:text-rose-400 rounded"
                      >
                        <Trash2 size={12} />
                      </button>
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
            <div className="flex justify-between items-end">
              <h3 className="text-[10px] font-black text-stone-600 uppercase tracking-widest flex items-center gap-2">
                <GitBranch size={14} /> Threads / 伏線スレッド
              </h3>
              <button
                onClick={() => openEditor('thread')}
                className="p-1.5 bg-stone-800 hover:bg-orange-600 hover:text-white text-stone-500 rounded-lg transition-all"
              >
                <Plus size={14} />
              </button>
            </div>
            <div className="space-y-2">
              {plot.storyThreads.map((thread) => {
                // ビートを章順にソート（chapters配列のインデックスを利用）
                const sortedBeats = (thread.beats || []).sort((a, b) => {
                  const idxA = chapters.findIndex((c) => c.id === a.chapterId);
                  const idxB = chapters.findIndex((c) => c.id === b.chapterId);
                  const safeA = idxA === -1 ? 9999 : idxA;
                  const safeB = idxB === -1 ? 9999 : idxB;
                  return safeA - safeB;
                });

                return (
                  <div
                    key={thread.id}
                    className="p-3 bg-stone-900/40 border border-white/5 rounded-xl relative group hover:bg-stone-900/60 transition-all"
                  >
                    <div className="flex justify-between pr-8 mb-1">
                      <span className="text-[10px] font-bold text-stone-300">{thread.title}</span>
                      <span
                        className={`text-[8px] px-1 rounded uppercase ${thread.status === 'Resolved' ? 'text-emerald-500' : 'text-orange-500'}`}
                      >
                        {thread.status}
                      </span>
                    </div>
                    <p className="text-[9px] text-stone-500 font-serif leading-tight">
                      {thread.shortSummary}
                    </p>

                    {sortedBeats.length > 0 && (
                      <div className="mt-3 space-y-1.5 border-t border-white/5 pt-2">
                        {sortedBeats.map((beat, i) => {
                          const chapterIndex = chapters.findIndex((c) => c.id === beat.chapterId);
                          const chapterTitle =
                            chapterIndex !== -1 ? chapters[chapterIndex].title : '未割当';

                          return (
                            <div key={i} className="flex gap-2 items-start text-[9px] group/beat">
                              <span className="px-1.5 py-0.5 bg-stone-800 rounded text-stone-500 shrink-0 font-mono">
                                {chapterIndex !== -1 ? `Ch.${chapterIndex + 1}` : '---'}
                              </span>
                              <div className="flex flex-col min-w-0">
                                {chapterIndex !== -1 && (
                                  <span className="text-[8px] text-stone-600 truncate">
                                    {chapterTitle}
                                  </span>
                                )}
                                <span className="text-stone-400 font-serif leading-tight group-hover/beat:text-stone-200 transition-colors">
                                  {beat.eventDescription}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                      <button
                        onClick={() => openEditor('thread', thread)}
                        className="p-1 bg-stone-800 text-stone-500 hover:text-white rounded"
                      >
                        <Edit2 size={10} />
                      </button>
                      <button
                        onClick={() => handleDelete('thread', thread.id, thread.title)}
                        className="p-1 bg-stone-800 text-stone-500 hover:text-rose-400 rounded"
                      >
                        <Trash2 size={10} />
                      </button>
                    </div>
                  </div>
                );
              })}
              {plot.storyThreads.length === 0 && (
                <div className="text-stone-600 text-[10px] italic">スレッドはありません。</div>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex justify-between items-end">
              <h3 className="text-[10px] font-black text-stone-600 uppercase tracking-widest flex items-center gap-2">
                <Target size={14} /> Foreshadowing / 伏線リスト
              </h3>
              <button
                onClick={() => openEditor('foreshadowing')}
                className="p-1.5 bg-stone-800 hover:bg-orange-600 hover:text-white text-stone-500 rounded-lg transition-all"
              >
                <Plus size={14} />
              </button>
            </div>
            <div className="space-y-3">
              {plot.foreshadowing.map((item) => (
                <div
                  key={item.id}
                  className="p-3 bg-stone-900/40 border border-white/5 rounded-xl space-y-2 group relative"
                >
                  <div className="flex justify-between items-start pr-12">
                    <span className="text-[10px] font-bold text-stone-300">{item.title}</span>
                    <span
                      className={`text-[8px] px-1 rounded uppercase ${item.status === 'Resolved' ? 'text-emerald-500' : 'text-stone-500'}`}
                    >
                      {item.status}
                    </span>
                  </div>
                  <p className="text-[9px] text-stone-500 font-serif truncate">
                    {item.description}
                  </p>

                  {(item.clues?.length > 0 || item.redHerrings?.length > 0) && (
                    <div className="grid grid-cols-1 gap-1.5 pt-2 border-t border-white/5">
                      {item.clues?.length > 0 && (
                        <div className="flex gap-2 items-start">
                          <Search size={10} className="text-emerald-500 mt-0.5 shrink-0" />
                          <div className="flex-1">
                            <div className="text-[8px] font-black text-emerald-500 uppercase tracking-widest">
                              Clues
                            </div>
                            <ul className="text-[9px] text-stone-400 font-serif list-disc list-inside">
                              {item.clues.map((c, i) => (
                                <li key={i}>{c}</li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      )}
                      {item.redHerrings?.length > 0 && (
                        <div className="flex gap-2 items-start">
                          <AlertCircle size={10} className="text-rose-500 mt-0.5 shrink-0" />
                          <div className="flex-1">
                            <div className="text-[8px] font-black text-rose-500 uppercase tracking-widest">
                              Misleads
                            </div>
                            <ul className="text-[9px] text-stone-400 font-serif list-disc list-inside">
                              {item.redHerrings.map((c, i) => (
                                <li key={i}>{c}</li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-all bg-stone-900/80 rounded backdrop-blur">
                    <button
                      onClick={() => openEditor('foreshadowing', item)}
                      className="p-1 text-stone-500 hover:text-white"
                    >
                      <Edit2 size={12} />
                    </button>
                    <button
                      onClick={() => handleDelete('foreshadowing', item.id, item.title)}
                      className="p-1 text-stone-500 hover:text-rose-400"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>

                  <div className="flex gap-2 pt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => handleConsultForeshadowing(item.title, 'clue')}
                      className="flex-1 py-1.5 bg-stone-800 hover:bg-stone-700 rounded text-[9px] text-stone-400 hover:text-white flex items-center justify-center gap-1 transition-colors"
                    >
                      <Search size={10} /> 手がかり相談
                    </button>
                    <button
                      onClick={() => handleConsultForeshadowing(item.title, 'payoff')}
                      className="flex-1 py-1.5 bg-stone-800 hover:bg-stone-700 rounded text-[9px] text-stone-400 hover:text-white flex items-center justify-center gap-1 transition-colors"
                    >
                      <MessageSquare size={10} /> 回収案相談
                    </button>
                  </div>

                  {item.relatedEntityIds && item.relatedEntityIds.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-1 border-t border-white/5">
                      {item.relatedEntityIds.map((eid) => (
                        <Badge key={eid} color="stone" className="flex items-center gap-1">
                          <Link2 size={8} /> {getEntityName(eid)}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              {plot.foreshadowing.length === 0 && (
                <div className="text-stone-600 text-[10px] italic">伏線リストはありません。</div>
              )}
            </div>
          </div>
        </div>
      </div>

      <ItemEditorModal
        isOpen={editor.isOpen}
        type={editor.type}
        initialData={editor.initialData}
        onClose={() => setEditor({ ...editor, isOpen: false })}
        onSave={handleSave}
      />
    </div>
  );
};
