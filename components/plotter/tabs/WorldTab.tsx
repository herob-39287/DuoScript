import React, { useState } from 'react';
import {
  Globe,
  Feather,
  Scale,
  Map as MapIcon,
  Landmark,
  Users,
  Skull,
  Zap,
  Key,
  Book,
  ArrowRight,
  Handshake,
  Lightbulb,
} from 'lucide-react';
import {
  useBibleDispatch,
  useUIDispatch,
  useWorldFoundation,
  useGeography,
  useKnowledge,
} from '../../../contexts/StoryContext';
import * as Actions from '../../../store/actions';
import { WorldBible, WorldLaw, BibleArrayKeys } from '../../../types';
import { WorldSection } from '../parts/WorldSection';
import { ItemEditorModal, ItemType } from '../ItemEditorModal';
import { Badge } from '../../ui/DesignSystem';

export const WorldTab: React.FC = () => {
  const foundation = useWorldFoundation();
  const geography = useGeography();
  const knowledge = useKnowledge();
  const bibleDispatch = useBibleDispatch();
  const uiDispatch = useUIDispatch();

  const [editor, setEditor] = useState<{ isOpen: boolean; type: ItemType; initialData?: any }>({
    isOpen: false,
    type: 'law',
  });

  const handleConsult = (item: any, type: string) => {
    const name = item.name || item.title || item.concept || 'この項目';
    uiDispatch(Actions.setPendingMsg(`設定項目【${type}：${name}】について相談です。\n\n`));
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
            law: 'laws',
            location: 'locations',
            organization: 'organizations',
            item: 'keyItems',
            entry: 'entries',
            race: 'races',
            bestiary: 'bestiary',
            ability: 'abilities',
            theme: 'themes',
            timeline: '',
            foreshadowing: '',
            thread: '',
            structure: '',
            volume: '',
            chapter: '',
          };
          const path = pathMap[type];
          if (!path) return;

          // Use optimized list manipulation action
          bibleDispatch(Actions.manipulateBibleList(path as BibleArrayKeys, 'delete', id));
          uiDispatch(Actions.closeDialog());
        },
      }),
    );
  };

  const handleSave = (data: any) => {
    const pathMap: Record<ItemType, keyof WorldBible | ''> = {
      law: 'laws',
      location: 'locations',
      organization: 'organizations',
      item: 'keyItems',
      entry: 'entries',
      race: 'races',
      bestiary: 'bestiary',
      ability: 'abilities',
      theme: 'themes',
      timeline: '',
      foreshadowing: '',
      thread: '',
      structure: '',
      volume: '',
      chapter: '',
    };
    const path = pathMap[editor.type];
    if (!path) return;

    if (data.id) {
      // Update existing item using partial updates
      bibleDispatch(
        Actions.manipulateBibleList(path as BibleArrayKeys, 'update', data.id, undefined, data),
      );
    } else {
      // Create new item
      const newItem = { ...data, id: crypto.randomUUID() };
      bibleDispatch(Actions.manipulateBibleList(path as BibleArrayKeys, 'add', undefined, newItem));
    }
  };

  const getLocationName = (id: string) =>
    geography?.locations.find((l) => l.id === id)?.name || 'Unknown';
  const getOrgName = (id: string) =>
    geography?.organizations.find((o) => o.id === id)?.name || 'Unknown';

  if (!foundation || !geography || !knowledge) return null;

  return (
    <div className="space-y-8 animate-fade-in max-w-5xl mx-auto">
      {/* Setting & Tone */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-3">
          <h3 className="text-[10px] font-black text-stone-600 uppercase tracking-widest flex items-center gap-2">
            <Globe size={14} /> Setting / 舞台設定
          </h3>
          <textarea
            className="w-full bg-stone-900/40 border border-white/5 rounded-2xl p-4 text-[12px] text-stone-300 font-serif leading-relaxed h-32 focus:border-orange-500/30 outline-none resize-none"
            value={foundation.setting}
            onChange={(e) => bibleDispatch(Actions.updateBible({ setting: e.target.value }))}
            placeholder="世界の概略..."
          />
        </div>
        <div className="space-y-3">
          <h3 className="text-[10px] font-black text-stone-600 uppercase tracking-widest flex items-center gap-2">
            <Feather size={14} /> Tone / 文体・トーン
          </h3>
          <textarea
            className="w-full bg-stone-900/40 border border-white/5 rounded-2xl p-4 text-[12px] text-stone-300 font-serif leading-relaxed h-32 focus:border-orange-500/30 outline-none resize-none"
            value={foundation.tone}
            onChange={(e) => bibleDispatch(Actions.updateBible({ tone: e.target.value }))}
            placeholder="作品の雰囲気..."
          />
        </div>
      </div>

      {/* Laws & Themes */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <WorldSection
          title="Laws / 世界の理"
          icon={<Scale size={14} className="text-orange-400" />}
          items={foundation.laws}
          onAdd={() => openEditor('law')}
          onEdit={(item) => openEditor('law', item)}
          onDelete={(item) => handleDelete('law', item.id, item.name)}
          onConsult={(item) => handleConsult(item, '世界の理')}
          renderItem={(item: WorldLaw) => (
            <>
              <div className="flex justify-between items-start mb-1">
                <span className="text-[11px] font-bold text-stone-200">{item.name}</span>
                <span
                  className={`text-[8px] px-1.5 py-0.5 rounded uppercase font-black ${item.importance === 'Absolute' ? 'bg-rose-500/20 text-rose-400' : 'bg-stone-800 text-stone-500'}`}
                >
                  {item.type}
                </span>
              </div>
              <p className="text-[10px] text-stone-400 font-serif leading-relaxed">
                {item.description}
              </p>
            </>
          )}
        />
        <WorldSection
          title="Themes / テーマ"
          icon={<Lightbulb size={14} className="text-yellow-400" />}
          items={knowledge.themes}
          onAdd={() => openEditor('theme')}
          onEdit={(item) => openEditor('theme', item)}
          onDelete={(item) => handleDelete('theme', item.id, item.concept)}
          onConsult={(item) => handleConsult(item, 'テーマ')}
          renderItem={(item: any) => (
            <>
              <div className="flex justify-between items-start mb-1">
                <span className="text-[11px] font-bold text-stone-200">{item.concept}</span>
              </div>
              <p className="text-[10px] text-stone-400 font-serif leading-relaxed">
                {item.description}
              </p>
              {item.motifs && item.motifs.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {item.motifs.map((m: string, i: number) => (
                    <span
                      key={i}
                      className="text-[7px] px-1.5 py-0.5 bg-yellow-500/10 text-yellow-300 rounded border border-yellow-500/20"
                    >
                      {m}
                    </span>
                  ))}
                </div>
              )}
            </>
          )}
        />
      </div>

      {/* Locations */}
      <WorldSection
        title="Geography / 地理"
        icon={<MapIcon size={14} className="text-emerald-400" />}
        items={geography.locations}
        onAdd={() => openEditor('location')}
        onEdit={(item) => openEditor('location', item)}
        onDelete={(item) => handleDelete('location', item.id, item.name)}
        onConsult={(item) => handleConsult(item, '地理')}
        renderItem={(item: any) => (
          <>
            <div className="flex justify-between items-start mb-1">
              <span className="text-[11px] font-bold text-stone-200">{item.name}</span>
              <span className="text-[8px] bg-emerald-500/10 text-emerald-400 px-1.5 py-0.5 rounded uppercase font-black">
                {item.type}
              </span>
            </div>
            <p className="text-[10px] text-stone-400 font-serif leading-relaxed line-clamp-3 mb-2">
              {item.description}
            </p>
            {item.connections && item.connections.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1 border-t border-white/5 pt-1.5">
                {item.connections.slice(0, 3).map((c: any, i: number) => (
                  <Badge key={i} color="stone" className="flex items-center gap-1 opacity-70">
                    <ArrowRight size={8} /> {getLocationName(c.targetLocationId)}
                  </Badge>
                ))}
                {item.connections.length > 3 && (
                  <span className="text-[8px] text-stone-600">+{item.connections.length - 3}</span>
                )}
              </div>
            )}
          </>
        )}
      />

      {/* Organizations */}
      <WorldSection
        title="Organizations / 組織"
        icon={<Landmark size={14} className="text-indigo-400" />}
        items={geography.organizations}
        onAdd={() => openEditor('organization')}
        onEdit={(item) => openEditor('organization', item)}
        onDelete={(item) => handleDelete('organization', item.id, item.name)}
        onConsult={(item) => handleConsult(item, '組織')}
        renderItem={(item: any) => (
          <>
            <div className="flex justify-between items-start mb-1">
              <span className="text-[11px] font-bold text-stone-200">{item.name}</span>
              <span className="text-[8px] bg-indigo-500/10 text-indigo-400 px-1.5 py-0.5 rounded uppercase font-black">
                {item.type}
              </span>
            </div>
            <p className="text-[10px] text-stone-400 font-serif leading-relaxed line-clamp-3 mb-2">
              {item.description}
            </p>
            {item.relations && item.relations.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1 border-t border-white/5 pt-1.5">
                {item.relations.slice(0, 2).map((r: any, i: number) => (
                  <Badge
                    key={i}
                    color={
                      r.stance === 'Hostile' ? 'rose' : r.stance === 'Ally' ? 'emerald' : 'stone'
                    }
                    className="flex items-center gap-1 opacity-80"
                  >
                    <Handshake size={8} /> {getOrgName(r.targetOrganizationId)}
                  </Badge>
                ))}
              </div>
            )}
          </>
        )}
      />

      {/* Races, Bestiary, Abilities - Updated to show details */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <WorldSection
          title="Races / 種族"
          icon={<Users size={14} className="text-purple-400" />}
          items={knowledge.races}
          onAdd={() => openEditor('race')}
          onEdit={(item) => openEditor('race', item)}
          onDelete={(item) => handleDelete('race', item.id, item.name)}
          onConsult={(item) => handleConsult(item, '種族')}
          renderItem={(item: any) => (
            <>
              <div className="flex justify-between items-start mb-1">
                <span className="text-[11px] font-bold text-stone-200">{item.name}</span>
                {item.lifespan && (
                  <span className="text-[8px] bg-stone-800 text-stone-500 px-1.5 py-0.5 rounded font-mono">
                    {item.lifespan}
                  </span>
                )}
              </div>
              <p className="text-[10px] text-stone-400 font-serif leading-relaxed line-clamp-2">
                {item.description}
              </p>
              {item.traits && item.traits.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {item.traits.slice(0, 3).map((t: string, i: number) => (
                    <span
                      key={i}
                      className="text-[7px] px-1 py-0.5 bg-purple-500/10 text-purple-300 rounded border border-purple-500/20"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              )}
            </>
          )}
        />
        <WorldSection
          title="Bestiary / 生物"
          icon={<Skull size={14} className="text-rose-400" />}
          items={knowledge.bestiary}
          onAdd={() => openEditor('bestiary')}
          onEdit={(item) => openEditor('bestiary', item)}
          onDelete={(item) => handleDelete('bestiary', item.id, item.name)}
          onConsult={(item) => handleConsult(item, '魔物・生物')}
          renderItem={(item: any) => (
            <>
              <div className="flex justify-between items-start mb-1">
                <span className="text-[11px] font-bold text-stone-200">{item.name}</span>
                <span
                  className={`text-[8px] px-1.5 py-0.5 rounded uppercase font-black ${item.dangerLevel === 'Catastrophic' ? 'bg-rose-600 text-white' : item.dangerLevel === 'Deadly' ? 'bg-rose-500/20 text-rose-400' : 'bg-stone-800 text-stone-500'}`}
                >
                  {item.dangerLevel}
                </span>
              </div>
              <p className="text-[10px] text-stone-400 font-serif leading-relaxed line-clamp-2">
                {item.description}
              </p>
              {item.habitat && (
                <div className="text-[8px] text-stone-500 mt-1 flex items-center gap-1">
                  📍 {item.habitat}
                </div>
              )}
            </>
          )}
        />
        <WorldSection
          title="Magic / 能力"
          icon={<Zap size={14} className="text-yellow-400" />}
          items={knowledge.abilities}
          onAdd={() => openEditor('ability')}
          onEdit={(item) => openEditor('ability', item)}
          onDelete={(item) => handleDelete('ability', item.id, item.name)}
          onConsult={(item) => handleConsult(item, '能力・魔法')}
          renderItem={(item: any) => (
            <>
              <div className="flex justify-between items-start mb-1">
                <span className="text-[11px] font-bold text-stone-200">{item.name}</span>
                <span className="text-[8px] bg-yellow-500/10 text-yellow-400 px-1.5 py-0.5 rounded uppercase font-black">
                  {item.type}
                </span>
              </div>
              <p className="text-[10px] text-stone-400 font-serif leading-relaxed line-clamp-2">
                {item.description}
              </p>
              {item.cost && (
                <div className="text-[8px] text-stone-500 mt-1 flex items-center gap-1">
                  Cost: {item.cost}
                </div>
              )}
            </>
          )}
        />
      </div>

      {/* Items & Entries */}
      <WorldSection
        title="Key Items / 重要アイテム"
        icon={<Key size={14} className="text-amber-400" />}
        items={knowledge.keyItems}
        onAdd={() => openEditor('item')}
        onEdit={(item) => openEditor('item', item)}
        onDelete={(item) => handleDelete('item', item.id, item.name)}
        onConsult={(item) => handleConsult(item, '重要アイテム')}
        renderItem={(item: any) => (
          <>
            <div className="flex justify-between items-start mb-1">
              <span className="text-[11px] font-bold text-stone-200">{item.name}</span>
              <span className="text-[8px] bg-amber-500/10 text-amber-400 px-1.5 py-0.5 rounded uppercase font-black">
                {item.type}
              </span>
            </div>
            <p className="text-[10px] text-stone-400 font-serif leading-relaxed">
              {item.description}
            </p>
          </>
        )}
      />

      <WorldSection
        title="Encyclopedia / 用語集"
        icon={<Book size={14} className="text-stone-400" />}
        items={knowledge.entries}
        onAdd={() => openEditor('entry')}
        onEdit={(item) => openEditor('entry', item)}
        onDelete={(item) => handleDelete('entry', item.id, item.title)}
        onConsult={(item) => handleConsult(item, '用語')}
        renderItem={(item: any) => (
          <>
            <div className="flex justify-between items-start mb-1">
              <span className="text-[11px] font-bold text-stone-200">{item.title}</span>
              <span className="text-[8px] bg-stone-800 text-stone-500 px-1.5 py-0.5 rounded uppercase font-black">
                {item.category}
              </span>
            </div>
            <p className="text-[10px] text-stone-400 font-serif leading-relaxed line-clamp-3">
              {item.definition || item.content || item.description}
            </p>
          </>
        )}
      />

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
