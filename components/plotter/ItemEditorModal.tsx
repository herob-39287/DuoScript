
import React, { useState, useEffect } from 'react';
import { X, Save } from 'lucide-react';
import { Button } from '../ui/DesignSystem';

export type ItemType = 
  | 'law' | 'location' | 'organization' | 'item' | 'entry' 
  | 'race' | 'bestiary' | 'ability' 
  | 'timeline' | 'foreshadowing' | 'thread' | 'structure' | 'volume' | 'chapter';

interface ItemEditorModalProps {
  isOpen: boolean;
  type: ItemType;
  initialData?: any;
  onClose: () => void;
  onSave: (data: any) => void;
}

const TYPE_LABELS: Record<ItemType, string> = {
  law: '世界の理 (Law)',
  location: '場所・地理 (Location)',
  organization: '組織 (Organization)',
  item: '重要アイテム (Key Item)',
  entry: '用語・設定 (Entry)',
  race: '種族 (Race)',
  bestiary: '魔物・生物 (Bestiary)',
  ability: '魔法・能力 (Ability)',
  timeline: '年表イベント (Event)',
  foreshadowing: '伏線 (Foreshadowing)',
  thread: '物語スレッド (Thread)',
  structure: '構成フェーズ (Phase)',
  volume: '巻 (Volume)',
  chapter: '章 (Chapter)'
};

export const ItemEditorModal: React.FC<ItemEditorModalProps> = ({ isOpen, type, initialData, onClose, onSave }) => {
  const [data, setData] = useState<any>({});

  useEffect(() => {
    if (isOpen) {
      setData(initialData || {});
    }
  }, [isOpen, initialData]);

  if (!isOpen) return null;

  const handleChange = (key: string, value: any) => {
    setData((prev: any) => ({ ...prev, [key]: value }));
  };

  const handleArrayChange = (key: string, value: string) => {
    // Split by comma and trim
    const array = value.split(',').map(s => s.trim()).filter(Boolean);
    setData((prev: any) => ({ ...prev, [key]: array }));
  };

  const handleSave = () => {
    onSave(data);
    onClose();
  };

  const renderFields = () => {
    switch (type) {
      case 'law':
        return (
          <>
            <Field label="名前" value={data.name} onChange={v => handleChange('name', v)} placeholder="例: 等価交換の法則" />
            <Select label="種類" value={data.type || 'Physics'} onChange={v => handleChange('type', v)} options={['Physics', 'Magic', 'Social', 'Divine', 'Taboo']} />
            <Select label="重要度" value={data.importance || 'Flexible'} onChange={v => handleChange('importance', v)} options={['Absolute', 'Flexible', 'Conditional']} />
            <TextArea label="説明" value={data.description} onChange={v => handleChange('description', v)} />
          </>
        );
      case 'location':
        return (
          <>
            <Field label="名前" value={data.name} onChange={v => handleChange('name', v)} />
            <Select label="種類" value={data.type || 'City'} onChange={v => handleChange('type', v)} options={['Continent', 'Country', 'City', 'Region', 'Spot', 'Building']} />
            <TextArea label="説明" value={data.description} onChange={v => handleChange('description', v)} />
          </>
        );
      case 'organization':
        return (
          <>
            <Field label="名前" value={data.name} onChange={v => handleChange('name', v)} />
            <Select label="種類" value={data.type || 'Guild'} onChange={v => handleChange('type', v)} options={['Guild', 'Government', 'Cult', 'Party', 'Company']} />
            <TextArea label="説明" value={data.description} onChange={v => handleChange('description', v)} />
          </>
        );
      case 'item':
        return (
          <>
            <Field label="名前" value={data.name} onChange={v => handleChange('name', v)} />
            <Select label="種類" value={data.type || 'Tool'} onChange={v => handleChange('type', v)} options={['Weapon', 'Tool', 'Relic', 'Evidence']} />
            <TextArea label="説明" value={data.description} onChange={v => handleChange('description', v)} />
            <TextArea label="仕組み・効果" value={data.mechanics} onChange={v => handleChange('mechanics', v)} placeholder="具体的な機能や魔法的効果..." />
          </>
        );
      case 'entry':
        return (
          <>
            <Field label="タイトル" value={data.title} onChange={v => handleChange('title', v)} />
            <Select label="カテゴリ" value={data.category || 'Terminology'} onChange={v => handleChange('category', v)} options={['History', 'Culture', 'Technology', 'Magic', 'Geography', 'Lore', 'Terminology']} />
            <TextArea label="定義・内容" value={data.definition || data.content} onChange={v => { handleChange('definition', v); handleChange('content', v); }} />
            <Field label="タグ (カンマ区切り)" value={(data.tags || []).join(', ')} onChange={v => handleArrayChange('tags', v)} />
          </>
        );
      case 'race':
        return (
          <>
            <Field label="種族名" value={data.name} onChange={v => handleChange('name', v)} />
            <Field label="寿命" value={data.lifespan} onChange={v => handleChange('lifespan', v)} placeholder="例: 約300年" />
            <Field label="特徴 (カンマ区切り)" value={(data.traits || []).join(', ')} onChange={v => handleArrayChange('traits', v)} placeholder="例: 夜目, 俊敏, 魔力耐性" />
            <TextArea label="説明" value={data.description} onChange={v => handleChange('description', v)} />
          </>
        );
      case 'bestiary':
        return (
          <>
            <Field label="名前" value={data.name} onChange={v => handleChange('name', v)} />
            <Select label="種類" value={data.type || 'Beast'} onChange={v => handleChange('type', v)} options={['Beast', 'Plant', 'Monster', 'Spirit']} />
            <Select label="危険度" value={data.dangerLevel || 'Caution'} onChange={v => handleChange('dangerLevel', v)} options={['Safe', 'Caution', 'Deadly', 'Catastrophic']} />
            <Field label="生息地" value={data.habitat} onChange={v => handleChange('habitat', v)} />
            <Field label="ドロップ品 (カンマ区切り)" value={(data.dropItems || []).join(', ')} onChange={v => handleArrayChange('dropItems', v)} />
            <TextArea label="説明" value={data.description} onChange={v => handleChange('description', v)} />
          </>
        );
      case 'ability':
        return (
          <>
            <Field label="名前" value={data.name} onChange={v => handleChange('name', v)} />
            <Select label="タイプ" value={data.type || 'Magic'} onChange={v => handleChange('type', v)} options={['Magic', 'Skill', 'Tech', 'Divine']} />
            <Field label="代償・コスト" value={data.cost} onChange={v => handleChange('cost', v)} placeholder="例: MP, 生命力, 触媒" />
            <TextArea label="効果・仕組み" value={data.mechanics} onChange={v => handleChange('mechanics', v)} />
            <TextArea label="背景・説明" value={data.description} onChange={v => handleChange('description', v)} />
          </>
        );
      case 'timeline':
        return (
          <>
            <Field label="時期 (Time Label)" value={data.timeLabel} onChange={v => handleChange('timeLabel', v)} placeholder="例: 聖暦1024年" />
            <Field label="出来事" value={data.event} onChange={v => handleChange('event', v)} />
            <Select label="重要度" value={data.importance || 'Minor'} onChange={v => handleChange('importance', v)} options={['Minor', 'Major', 'Climax']} />
            <Select label="ステータス" value={data.status || 'Canon'} onChange={v => handleChange('status', v)} options={['Canon', 'Plan', 'Hypothesis']} />
            <TextArea label="詳細" value={data.description} onChange={v => handleChange('description', v)} />
          </>
        );
      case 'foreshadowing':
        return (
          <>
            <Field label="伏線タイトル" value={data.title} onChange={v => handleChange('title', v)} />
            <Select label="ステータス" value={data.status || 'Open'} onChange={v => handleChange('status', v)} options={['Open', 'Resolved', 'Stale']} />
            <Select label="優先度" value={data.priority || 'Medium'} onChange={v => handleChange('priority', v)} options={['Low', 'Medium', 'High', 'Critical']} />
            <TextArea label="内容" value={data.description} onChange={v => handleChange('description', v)} />
            <TextArea label="手がかり (Clues / カンマ区切り)" value={(data.clues || []).join(', ')} onChange={v => handleArrayChange('clues', v)} />
            <TextArea label="ミスリード (Red Herrings / カンマ区切り)" value={(data.redHerrings || []).join(', ')} onChange={v => handleArrayChange('redHerrings', v)} />
          </>
        );
      case 'thread':
        return (
          <>
            <Field label="スレッド名" value={data.title} onChange={v => handleChange('title', v)} />
            <Select label="ステータス" value={data.status || 'Open'} onChange={v => handleChange('status', v)} options={['Open', 'Resolved']} />
            <TextArea label="概要" value={data.shortSummary} onChange={v => handleChange('shortSummary', v)} />
          </>
        );
      case 'structure':
        return (
          <>
            <Field label="フェーズ名" value={data.name} onChange={v => handleChange('name', v)} placeholder="例: 起" />
            <Field label="ゴール" value={data.goal} onChange={v => handleChange('goal', v)} />
            <TextArea label="概要" value={data.summary} onChange={v => handleChange('summary', v)} />
          </>
        );
      case 'volume':
        return (
          <>
            <Field label="巻タイトル" value={data.title} onChange={v => handleChange('title', v)} />
            <Field label="巻数 (Order)" type="number" value={data.order} onChange={v => handleChange('order', Number(v))} />
            <TextArea label="あらすじ" value={data.summary} onChange={v => handleChange('summary', v)} />
          </>
        );
      case 'chapter':
        return (
          <>
            <Field label="章タイトル" value={data.title} onChange={v => handleChange('title', v)} />
            <TextArea label="あらすじ・プロット" value={data.summary} onChange={v => handleChange('summary', v)} />
            <Select label="ステータス" value={data.status || 'Idea'} onChange={v => handleChange('status', v)} options={['Idea', 'Beats', 'Drafting', 'Polished']} />
          </>
        );
      default:
        return <div className="text-stone-500">Unknown Type</div>;
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-stone-950/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-stone-900 w-full max-w-lg rounded-2xl border border-stone-800 shadow-2xl flex flex-col max-h-[90vh]">
        <div className="p-4 border-b border-white/5 flex justify-between items-center bg-stone-900/50 rounded-t-2xl">
          <span className="text-sm font-black text-stone-200 uppercase tracking-widest">{initialData?.id ? '編集' : '新規追加'}: {TYPE_LABELS[type]}</span>
          <button onClick={onClose} className="text-stone-500 hover:text-white"><X size={18} /></button>
        </div>
        <div className="p-6 space-y-4 overflow-y-auto custom-scrollbar flex-1">
          {renderFields()}
        </div>
        <div className="p-4 border-t border-white/5 bg-stone-900/50 rounded-b-2xl flex justify-end gap-3">
          <Button variant="ghost" onClick={onClose}>キャンセル</Button>
          <Button variant="primary" onClick={handleSave} icon={<Save size={14}/>}>保存</Button>
        </div>
      </div>
    </div>
  );
};

const Field = ({ label, value, onChange, placeholder, type = "text" }: any) => (
  <div className="space-y-1">
    <label className="text-[10px] font-black text-stone-500 uppercase tracking-widest">{label}</label>
    <input 
      type={type}
      value={value || ''} 
      onChange={e => onChange(e.target.value)} 
      placeholder={placeholder}
      className="w-full bg-stone-950 border border-white/10 rounded-xl px-3 py-2 text-sm text-stone-200 outline-none focus:border-orange-500/50 transition-all"
    />
  </div>
);

const TextArea = ({ label, value, onChange, placeholder }: any) => (
  <div className="space-y-1">
    <label className="text-[10px] font-black text-stone-500 uppercase tracking-widest">{label}</label>
    <textarea 
      value={value || ''} 
      onChange={e => onChange(e.target.value)} 
      placeholder={placeholder}
      className="w-full bg-stone-950 border border-white/10 rounded-xl px-3 py-2 text-sm text-stone-200 outline-none focus:border-orange-500/50 transition-all min-h-[100px] resize-none"
    />
  </div>
);

const Select = ({ label, value, onChange, options }: any) => (
  <div className="space-y-1">
    <label className="text-[10px] font-black text-stone-500 uppercase tracking-widest">{label}</label>
    <select 
      value={value || ''} 
      onChange={e => onChange(e.target.value)} 
      className="w-full bg-stone-950 border border-white/10 rounded-xl px-3 py-2 text-sm text-stone-200 outline-none focus:border-orange-500/50 transition-all appearance-none"
    >
      {options.map((opt: string) => <option key={opt} value={opt}>{opt}</option>)}
    </select>
  </div>
);
