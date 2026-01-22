
import React, { useState } from 'react';
import { ShieldAlert, Copy, Check, X, AlertTriangle } from 'lucide-react';
import { useUI, useUIDispatch } from '../contexts/StoryContext';
import * as Actions from '../store/actions';
import { translateSafetyCategory } from '../services/gemini/utils';

const SafetyInterventionModal: React.FC = () => {
  const { safetyIntervention } = useUI();
  const uiDispatch = useUIDispatch();
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  if (!safetyIntervention.isOpen) return null;

  const handleCopy = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const handleClose = () => {
    uiDispatch(Actions.setSafetyIntervention({ isOpen: false, alternatives: [], category: undefined }));
  };

  return (
    <div className="fixed inset-0 z-[1100] flex items-center justify-center p-4 bg-rose-950/90 backdrop-blur-md animate-fade-in">
      <div className="w-full max-w-2xl bg-stone-900 border border-rose-500/30 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-6 md:p-8 bg-gradient-to-b from-rose-900/20 to-transparent border-b border-rose-500/10 flex items-start gap-5">
          <div className="p-3 bg-rose-500/10 rounded-2xl text-rose-500 shrink-0">
            <ShieldAlert size={32} />
          </div>
          <div className="flex-1 space-y-2">
            <h2 className="text-xl md:text-2xl font-black text-white italic tracking-tighter uppercase">Safety Intervention</h2>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black bg-rose-500 text-white px-2 py-0.5 rounded uppercase tracking-widest">
                Blocked
              </span>
              <span className="text-[10px] font-bold text-rose-300 uppercase tracking-widest">
                {translateSafetyCategory(safetyIntervention.category)}
              </span>
            </div>
            <p className="text-xs md:text-sm text-stone-400 font-medium leading-relaxed">
              生成された内容が安全ガイドラインに抵触したため、処理が中断されました。<br/>
              物語の流れを維持するための、より安全な代替表現を提案します。
            </p>
          </div>
          <button onClick={handleClose} className="p-2 hover:bg-white/5 rounded-full text-stone-500 hover:text-white transition-colors">
            <X size={24} />
          </button>
        </div>

        <div className="p-6 md:p-8 overflow-y-auto custom-scrollbar space-y-4">
          <h3 className="text-[10px] font-black text-stone-500 uppercase tracking-widest flex items-center gap-2">
            <AlertTriangle size={12} className="text-amber-500"/> Suggested Alternatives
          </h3>
          
          <div className="grid gap-3">
            {safetyIntervention.alternatives.length > 0 ? (
              safetyIntervention.alternatives.map((alt, idx) => (
                <button
                  key={idx}
                  onClick={() => handleCopy(alt, idx)}
                  className="group relative w-full text-left p-4 md:p-5 bg-stone-950/50 hover:bg-stone-800 border border-white/5 hover:border-orange-500/30 rounded-2xl transition-all"
                >
                  <p className="text-sm text-stone-300 font-serif leading-relaxed pr-8">"{alt}"</p>
                  <div className="absolute top-4 right-4 text-stone-600 group-hover:text-orange-400 transition-colors">
                    {copiedIndex === idx ? <Check size={16} className="text-emerald-500"/> : <Copy size={16}/>}
                  </div>
                  {copiedIndex === idx && (
                    <div className="absolute bottom-2 right-4 text-[9px] font-black text-emerald-500 uppercase tracking-widest animate-fade-in">
                      Copied
                    </div>
                  )}
                </button>
              ))
            ) : (
              <div className="p-8 text-center border border-dashed border-stone-800 rounded-2xl text-stone-600 text-xs font-serif italic">
                代替案の生成に失敗しました。手動で表現を調整してください。
              </div>
            )}
          </div>
        </div>

        <div className="p-4 bg-stone-950/50 border-t border-white/5 flex justify-end">
          <button onClick={handleClose} className="px-6 py-3 bg-stone-800 hover:bg-stone-700 text-stone-300 hover:text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all">
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
};

export default SafetyInterventionModal;
