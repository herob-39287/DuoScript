import React, { useState, useMemo } from 'react';
import {
  Search,
  User,
  MapPin,
  Package,
  Book,
  ChevronRight,
  X,
  Reply,
  FileText,
} from 'lucide-react';
import { useBible } from '../../contexts/StoryContext';
import { normalizeJapanese, calculateSimilarity } from '../../utils/stringUtils';

interface MiniBibleProps {
  onInsert?: (text: string) => void;
  className?: string;
}

type TabType = 'all' | 'char' | 'loc' | 'item' | 'entry';

export const MiniBible: React.FC<MiniBibleProps> = ({ onInsert, className = '' }) => {
  const bible = useBible();
  const [query, setQuery] = useState('');
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [selectedItem, setSelectedItem] = useState<{
    id: string;
    type: string;
    name: string;
    data: any;
  } | null>(null);

  const allItems = useMemo(() => {
    const list = [
      ...bible.characters.map((c) => ({ id: c.id, name: c.profile.name, type: 'char', data: c })),
      ...bible.locations.map((l) => ({ id: l.id, name: l.name, type: 'loc', data: l })),
      ...bible.keyItems.map((k) => ({ id: k.id, name: k.name, type: 'item', data: k })),
      ...bible.entries.map((e) => ({ id: e.id, name: e.title, type: 'entry', data: e })),
    ];
    return list;
  }, [bible]);

  const filteredItems = useMemo(() => {
    let base = allItems;
    if (activeTab !== 'all') {
      base = base.filter((i) => i.type === activeTab);
    }

    if (!query.trim()) return base;

    const normQ = normalizeJapanese(query);
    return base.filter((i) => {
      const normName = normalizeJapanese(i.name);
      return normName.includes(normQ) || calculateSimilarity(normName, normQ) > 0.6;
    });
  }, [allItems, activeTab, query]);

  const handleInsert = (text: string) => {
    if (onInsert) onInsert(text);
  };

  const renderDetail = () => {
    if (!selectedItem) return null;
    const { data, type } = selectedItem;

    let content = <></>;
    let plainDescription = '';

    if (type === 'char') {
      plainDescription = data.profile.description || '';
      content = (
        <div className="space-y-3">
          <div className="text-[10px] text-stone-400">
            {data.profile.shortSummary || data.profile.description}
          </div>
          <div className="grid grid-cols-2 gap-2 text-[10px]">
            <div className="p-2 bg-stone-800 rounded">
              <span className="block text-stone-500 text-[8px]">一人称</span>
              {data.profile.voice?.firstPerson || '-'}
            </div>
            <div className="p-2 bg-stone-800 rounded">
              <span className="block text-stone-500 text-[8px]">二人称</span>
              {data.profile.voice?.secondPerson || '-'}
            </div>
          </div>
          <div className="text-[10px] text-stone-400 font-serif whitespace-pre-wrap">
            {data.profile.appearance}
          </div>
        </div>
      );
    } else if (type === 'loc') {
      plainDescription = data.description || '';
      content = (
        <div className="space-y-3">
          <div className="text-[10px] text-stone-400 font-serif whitespace-pre-wrap">
            {data.description}
          </div>
          {data.connections && data.connections.length > 0 && (
            <div className="text-[9px] text-stone-500">接続: {data.connections.length}箇所</div>
          )}
        </div>
      );
    } else {
      plainDescription = data.description || data.definition || data.content || '';
      content = (
        <div className="text-[10px] text-stone-400 font-serif whitespace-pre-wrap">
          {plainDescription}
        </div>
      );
    }

    return (
      <div className="absolute inset-0 bg-stone-900 z-10 flex flex-col animate-fade-in">
        <div className="flex items-center justify-between p-4 border-b border-white/5 bg-stone-800/50">
          <span className="font-bold text-sm text-white truncate pr-2">{selectedItem.name}</span>
          <button
            onClick={() => setSelectedItem(null)}
            className="text-stone-500 hover:text-white shrink-0"
          >
            <X size={16} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">{content}</div>
        {onInsert && (
          <div className="p-3 border-t border-white/5 flex gap-2 shrink-0 bg-stone-900/90 backdrop-blur">
            <button
              onClick={() => handleInsert(selectedItem.name)}
              className="flex-1 py-3 bg-stone-800 hover:bg-stone-700 text-stone-300 hover:text-white rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all"
            >
              <Reply size={14} className="scale-x-[-1]" /> 名前を挿入
            </button>
            {plainDescription && (
              <button
                onClick={() => handleInsert(plainDescription)}
                className="flex-1 py-3 bg-stone-800 hover:bg-stone-700 text-stone-300 hover:text-white rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all"
              >
                <FileText size={14} /> 詳細を挿入
              </button>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={`flex flex-col h-full bg-stone-900/40 relative ${className}`}>
      {selectedItem ? (
        renderDetail()
      ) : (
        <>
          <div className="p-3 border-b border-white/5 space-y-3 shrink-0">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-2.5 text-stone-500" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search Bible..."
                className="w-full bg-stone-950 border border-white/10 rounded-xl pl-9 pr-3 py-2 text-xs text-stone-200 outline-none focus:border-orange-500/50"
              />
            </div>
            <div className="flex gap-1 overflow-x-auto no-scrollbar pb-1">
              {[
                { id: 'all', icon: null, label: 'All' },
                { id: 'char', icon: <User size={10} />, label: 'Char' },
                { id: 'loc', icon: <MapPin size={10} />, label: 'Loc' },
                { id: 'item', icon: <Package size={10} />, label: 'Item' },
                { id: 'entry', icon: <Book size={10} />, label: 'Ref' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as TabType)}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest whitespace-nowrap transition-colors ${activeTab === tab.id ? 'bg-orange-600/20 text-orange-400' : 'bg-stone-800 text-stone-500 hover:text-stone-300'}`}
                >
                  {tab.icon} {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
            {filteredItems.map((item, i) => (
              <div
                key={`${item.type}-${item.id}`}
                className="w-full flex items-center p-1 hover:bg-white/5 rounded-xl group transition-all border border-transparent hover:border-white/5"
              >
                <button
                  onClick={() => setSelectedItem(item)}
                  className="flex-1 flex items-center justify-between p-2 text-left"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`p-1.5 rounded-lg shrink-0 ${item.type === 'char' ? 'bg-indigo-500/10 text-indigo-400' : item.type === 'loc' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-stone-800 text-stone-500'}`}
                    >
                      {item.type === 'char' && <User size={12} />}
                      {item.type === 'loc' && <MapPin size={12} />}
                      {item.type === 'item' && <Package size={12} />}
                      {item.type === 'entry' && <Book size={12} />}
                    </div>
                    <span className="text-[11px] text-stone-300 font-medium group-hover:text-white truncate">
                      {item.name}
                    </span>
                  </div>
                  <ChevronRight
                    size={14}
                    className="text-stone-700 group-hover:text-stone-400 ml-2 shrink-0"
                  />
                </button>

                {onInsert && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleInsert(item.name);
                    }}
                    className="p-2 mr-1 text-stone-600 hover:text-orange-400 hover:bg-stone-800 rounded-lg transition-colors"
                    title="名前を挿入"
                  >
                    <Reply size={14} className="scale-x-[-1]" />
                  </button>
                )}
              </div>
            ))}
            {filteredItems.length === 0 && (
              <div className="text-center py-8 text-stone-600 text-[10px] italic">
                No results found.
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};
