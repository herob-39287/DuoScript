
import React, { useState, useEffect, useMemo } from 'react';
import { X, Save, Sparkles, Loader2, PlusCircle, AlertTriangle } from 'lucide-react';
import { Button, Card } from '../ui/DesignSystem';
import { useBible, useMetadata, useManuscript, useNeuralSync, useNotificationDispatch, useMetadataDispatch, useUIDispatch } from '../../contexts/StoryContext';
import { autoFillItem, brainstormItem } from '../../services/geminiService';
import * as Actions from '../../store/actions';
import { GenericItemForm, ContextData } from './forms/GenericItemForm';
import { ItemType, ITEM_LABELS, SCHEMAS } from './forms/schema';

// Export ItemType for consumers
export type { ItemType };

interface ItemEditorModalProps {
  isOpen: boolean;
  type: ItemType;
  initialData?: any;
  onClose: () => void;
  onSave: (data: any) => void;
}

export const ItemEditorModal: React.FC<ItemEditorModalProps> = ({ isOpen, type, initialData, onClose, onSave }) => {
  const [data, setData] = useState<any>({});
  const [loadingField, setLoadingField] = useState<string | null>(null);
  const [brainstormResults, setBrainstormResults] = useState<any[]>([]);
  const [isBrainstorming, setIsBrainstorming] = useState(false);
  
  // Contexts for API Call & Dropdown Data
  const bible = useBible();
  const meta = useMetadata();
  const chapters = useManuscript();
  const sync = useNeuralSync();
  const metaDispatch = useMetadataDispatch();
  const uiDispatch = useUIDispatch();
  const { addLog } = useNotificationDispatch();

  useEffect(() => {
    if (isOpen) {
      setData(initialData ? JSON.parse(JSON.stringify(initialData)) : {});
      setBrainstormResults([]);
      setIsBrainstorming(false);
    }
  }, [isOpen, initialData]);

  // Prepare context data for dropdowns (e.g. locations list)
  const contextData: ContextData = useMemo(() => ({
    locations: bible.locations.map(l => ({ id: l.id, name: l.name })),
    organizations: bible.organizations.map(o => ({ id: o.id, name: o.name })),
    chapters: chapters.map((c, i) => ({ id: c.id, title: `Ch.${i + 1} ${c.title}` })),
    characters: bible.characters.map(c => ({ id: c.id, name: c.profile.name })),
    items: bible.keyItems.map(i => ({ id: i.id, name: i.name }))
  }), [bible, chapters]);

  if (!isOpen) return null;

  const handleChange = (key: string, value: any) => {
    setData((prev: any) => ({ ...prev, [key]: value }));
  };

  const handleSave = () => {
    onSave(data);
    onClose();
  };

  const handleError = (error: any, context: string) => {
    if (error.message?.includes("SAFETY_BLOCK")) {
      uiDispatch(Actions.openDialog({
        isOpen: true,
        type: 'alert',
        title: 'Safety Blocked',
        message: '生成内容が安全ガイドラインに抵触したため、処理が中断されました。入力内容や設定を見直してください。'
      }));
      addLog('error', 'Safety', `${context} Safety Policy Triggered`);
    } else {
      addLog('error', 'Architect', `${context}失敗: ${error.message}`);
    }
  };

  const handleAutoFill = async (fieldKey: string, fieldLabel: string) => {
    if (loadingField) return;
    const name = data.name || data.title || data.event || data.concept || "Unknown";
    
    if (!name || name === "Unknown") {
      addLog('error', 'System', '自動生成するには、まず名前（タイトル）を入力してください。');
      return;
    }

    setLoadingField(fieldKey);
    addLog('info', 'Architect', `${ITEM_LABELS[type]}の「${fieldLabel}」を考案中...`);

    try {
      const generated = await autoFillItem(
        { meta, bible, chapters, sync } as any,
        ITEM_LABELS[type],
        name,
        fieldLabel,
        data,
        (u) => metaDispatch(Actions.trackUsage(u)),
        addLog
      );
      handleChange(fieldKey, generated);
      addLog('success', 'Architect', `${fieldLabel} を生成しました。`);
    } catch (e: any) {
      handleError(e, '自動生成');
    } finally {
      setLoadingField(null);
    }
  };

  const handleBrainstorm = async () => {
    if (isBrainstorming) return;
    setIsBrainstorming(true);
    setBrainstormResults([]);
    addLog('info', 'Architect', `AIブレインストーミングを開始します...`);

    // Dynamically build field hints from Schema
    const schema = SCHEMAS[type];
    const fields = schema.map(f => f.key).join(', ');
    const fieldHints = `${fields}`;

    try {
      const results = await brainstormItem(
        { meta, bible, chapters, sync } as any,
        ITEM_LABELS[type],
        data.name || data.title || data.concept,
        data,
        fieldHints,
        (u) => metaDispatch(Actions.trackUsage(u)),
        addLog
      );
      setBrainstormResults(results);
      addLog('success', 'Architect', `${results.length}件のアイデアを提案しました。`);
    } catch (e: any) {
      handleError(e, 'ブレインストーミング');
    } finally {
      setIsBrainstorming(false);
    }
  };

  const applyIdea = (idea: any) => {
    const { concept_note, ...rest } = idea;
    setData((prev: any) => ({ ...prev, ...rest }));
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-stone-950/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-stone-900 w-full max-w-lg rounded-2xl border border-stone-800 shadow-2xl flex flex-col max-h-[90vh]">
        <div className="p-4 border-b border-white/5 flex justify-between items-center bg-stone-900/50 rounded-t-2xl shrink-0">
          <span className="text-sm font-black text-stone-200 uppercase tracking-widest">{initialData?.id ? '編集' : '新規追加'}: {ITEM_LABELS[type]}</span>
          <button onClick={onClose} className="text-stone-500 hover:text-white"><X size={18} /></button>
        </div>
        
        <div className="p-6 overflow-y-auto custom-scrollbar flex-1 space-y-6">
          {/* Brainstorming Section */}
          <div className="space-y-4">
              <button 
                onClick={handleBrainstorm} 
                disabled={isBrainstorming}
                className="w-full py-4 bg-gradient-to-r from-indigo-900/30 to-purple-900/30 border border-indigo-500/20 rounded-xl flex items-center justify-center gap-3 text-indigo-300 hover:text-white hover:border-indigo-500/50 hover:from-indigo-900/50 hover:to-purple-900/50 transition-all group"
              >
                {isBrainstorming ? <Loader2 size={18} className="animate-spin"/> : <Sparkles size={18} className="group-hover:rotate-12 transition-transform" />}
                <span className="text-xs font-black uppercase tracking-widest">AI Brainstorming</span>
              </button>

              {isBrainstorming && (
                <div className="text-center text-[10px] font-black uppercase tracking-widest text-indigo-400 animate-pulse">
                  設計士がアイデアを考案中...
                </div>
              )}

              {brainstormResults.length > 0 && (
                <div className="grid grid-cols-1 gap-3 animate-fade-in">
                  {brainstormResults.map((idea, idx) => (
                    <Card key={idx} variant="glass-bright" padding="sm" className="cursor-pointer hover:border-orange-500/40 group border border-white/5" onClick={() => applyIdea(idea)}>
                      <div className="flex justify-between items-start mb-1">
                          <span className="text-[11px] font-bold text-stone-200">{idea.name || idea.title || idea.event || idea.concept}</span>
                          {idea.concept_note && <span className="text-[8px] bg-stone-800 text-stone-500 px-1.5 py-0.5 rounded uppercase font-black">{idea.concept_note}</span>}
                      </div>
                      <p className="text-[10px] text-stone-400 font-serif leading-relaxed line-clamp-2">{idea.description || idea.summary || idea.definition}</p>
                      <div className="mt-2 text-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <span className="text-[9px] text-orange-400 font-black uppercase tracking-widest flex items-center justify-center gap-1"><PlusCircle size={10}/> 採用する</span>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
              <div className="h-px bg-white/5" />
          </div>

          {/* Generic Form Component */}
          <GenericItemForm 
            type={type}
            data={data}
            context={contextData}
            onChange={handleChange}
            onAutoFill={handleAutoFill}
            loadingField={loadingField}
          />
        </div>

        <div className="p-4 border-t border-white/5 bg-stone-900/50 rounded-b-2xl flex justify-end gap-3 shrink-0">
          <Button variant="ghost" onClick={onClose}>キャンセル</Button>
          <Button variant="primary" onClick={handleSave} icon={<Save size={14}/>}>保存</Button>
        </div>
      </div>
    </div>
  );
};
