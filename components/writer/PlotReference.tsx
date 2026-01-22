
import React from 'react';
import { Zap, LayoutDashboard, RefreshCw, X, Feather, Loader2 } from 'lucide-react';
import { PlotBeat, WhisperAdvice } from '../../types';

interface PlotReferenceProps {
  beats: PlotBeat[];
  whisper: WhisperAdvice | null;
  contextUsage: number;
  onGeneratePackage: () => void;
  onCloseWhisper: () => void;
  onDraftBeat?: (beat: PlotBeat) => void;
  processingBeatId?: string | null;
  isProcessing?: boolean;
  className?: string;
  onClose?: () => void;
}

export const PlotReference: React.FC<PlotReferenceProps> = ({
  beats,
  whisper,
  contextUsage = 64, 
  onGeneratePackage,
  onCloseWhisper,
  onDraftBeat,
  processingBeatId,
  isProcessing = false,
  className = "",
  onClose
}) => {
  return (
    <div className={`flex flex-col h-full bg-stone-900/40 relative ${className}`}>
      <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
        {onClose && (
          <div className="flex justify-end lg:hidden">
             <button onClick={onClose} className="p-2 bg-stone-800 text-stone-500 rounded-full hover:bg-stone-700 transition-colors">
               <X size={16}/>
             </button>
          </div>
        )}

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black text-stone-500 uppercase tracking-widest flex items-center gap-2"><Zap size={12} /> プロット・ビート</span>
            <button 
              onClick={onGeneratePackage} 
              disabled={isProcessing}
              className={`text-[9px] font-black uppercase tracking-widest transition-colors ${isProcessing ? 'text-stone-600 cursor-not-allowed' : 'text-orange-400 hover:text-white'}`}
              title="章のあらすじから詳細なビート（展開案）をAIが再構成します"
            >
              再構成
            </button>
          </div>
          <div className="space-y-3">
            {beats.map((beat, i) => {
              const isThisBeatProcessing = processingBeatId === beat.id;
              
              return (
                <div 
                  key={beat.id} 
                  className={`p-4 border rounded-2xl space-y-2 group relative transition-colors ${isThisBeatProcessing ? 'bg-orange-600/10 border-orange-500/50 shadow-[0_0_15px_rgba(234,88,12,0.2)]' : 'bg-stone-950/40 border-white/5 hover:border-orange-500/20'}`}
                >
                  <div className="flex items-center gap-2 justify-between">
                    <span className={`text-[8px] font-black uppercase ${isThisBeatProcessing ? 'text-orange-400' : 'text-stone-700'}`}>Beat {i + 1}</span>
                    {onDraftBeat && (
                      <button 
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          if (!isProcessing) onDraftBeat(beat);
                        }}
                        disabled={isProcessing}
                        className={`relative z-10 p-2 rounded-lg transition-all shadow-sm ${isThisBeatProcessing ? 'bg-orange-500 text-white animate-pulse' : 'bg-stone-800 text-stone-500 hover:text-orange-400 hover:bg-stone-700 disabled:opacity-30 disabled:cursor-not-allowed'}`}
                        title="このビートを執筆"
                      >
                        {isThisBeatProcessing ? <Loader2 size={14} className="animate-spin" /> : <Feather size={14} />}
                      </button>
                    )}
                  </div>
                  <p className={`text-[11px] font-serif leading-relaxed line-clamp-2 group-hover:line-clamp-none transition-all cursor-text select-text ${isThisBeatProcessing ? 'text-stone-200' : 'text-stone-400'}`}>
                    "{beat.text}"
                  </p>
                </div>
              );
            })}
            {(!beats || beats.length === 0) && (
              <button 
                onClick={onGeneratePackage} 
                disabled={isProcessing}
                className="w-full py-8 border border-dashed border-stone-800 rounded-[2rem] flex flex-col items-center justify-center gap-3 text-stone-600 hover:text-orange-400 hover:border-orange-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                title="あらすじを基に、章の展開案（ビート）をAIに設計させます"
              >
                <LayoutDashboard size={24} strokeWidth={1} />
                <span className="text-[10px] font-black uppercase tracking-widest">ビートを自動生成</span>
              </button>
            )}
          </div>
        </div>

        {whisper && (
          <div className="space-y-4 animate-fade-in">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest flex items-center gap-2"><RefreshCw size={12} /> 設計士の助言</span>
              <button 
                onClick={onCloseWhisper} 
                className="text-stone-600 hover:text-white"
                title="助言を閉じる"
              >
                <X size={12} />
              </button>
            </div>
            <div className={`p-6 rounded-[2rem] border space-y-4 ${whisper.type === 'alert' ? 'bg-rose-500/5 border-rose-500/20' : 'bg-emerald-500/5 border-emerald-500/20'}`}>
              <div className="flex items-center gap-2">
                <span className={`text-[8px] font-black px-1.5 py-0.5 rounded uppercase ${whisper.type === 'alert' ? 'bg-rose-500/20 text-rose-400' : 'bg-emerald-500/20 text-emerald-400'}`}>{whisper.ruleId}</span>
              </div>
              <p className="text-[13px] text-stone-200 font-serif leading-relaxed italic">"{whisper.text}"</p>
              <div className="space-y-2 pt-2 border-t border-white/5">
                <span className="text-[8px] font-black text-stone-600 uppercase">関連設定</span>
                {whisper.citations.map((c: any, i: number) => (
                  <div key={i} className="text-[10px] text-stone-500 font-serif border-l border-stone-800 pl-2">
                    <span className="font-bold block text-stone-600">[{c.label}]</span>
                    <span className="italic">"{c.textSnippet}"</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="p-4 bg-stone-950/40 border-t border-white/5 space-y-3">
        <div className="flex items-center justify-between text-[8px] font-black text-stone-600 uppercase tracking-widest">
          <span>コンテキスト消費量</span>
          <span>{contextUsage}%</span>
        </div>
        <div className="w-full h-1 bg-stone-800 rounded-full overflow-hidden">
          <div className="h-full bg-orange-600 shadow-[0_0_10px_rgba(234,88,12,0.5)]" style={{ width: `${contextUsage}%` }} />
        </div>
      </div>
    </div>
  );
};
