
import React from 'react';
import { Zap, LayoutDashboard, RefreshCw, X } from 'lucide-react';
import { PlotBeat, WhisperAdvice } from '../../types';

interface PlotReferenceProps {
  beats: PlotBeat[];
  whisper: WhisperAdvice | null;
  contextUsage: number;
  onGeneratePackage: () => void;
  onCloseWhisper: () => void;
}

export const PlotReference: React.FC<PlotReferenceProps> = ({
  beats,
  whisper,
  contextUsage = 64, // Default placeholder
  onGeneratePackage,
  onCloseWhisper
}) => {
  return (
    <aside className="w-80 border-l border-white/5 flex flex-col bg-stone-900/40 hidden lg:flex shrink-0">
      <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black text-stone-500 uppercase tracking-widest flex items-center gap-2"><Zap size={12} /> プロット・ビート</span>
            <button onClick={onGeneratePackage} className="text-[9px] font-black text-orange-400 hover:text-white transition-colors">再構成</button>
          </div>
          <div className="space-y-3">
            {beats.map((beat, i) => (
              <div key={beat.id} className="p-4 bg-stone-950/40 border border-white/5 rounded-2xl space-y-2 group">
                <div className="flex items-center gap-2">
                  <span className="text-[8px] font-black text-stone-700 uppercase">Beat {i + 1}</span>
                </div>
                <p className="text-[11px] text-stone-400 font-serif leading-relaxed line-clamp-2 group-hover:line-clamp-none transition-all">"{beat.text}"</p>
              </div>
            ))}
            {(!beats || beats.length === 0) && (
              <button onClick={onGeneratePackage} className="w-full py-8 border border-dashed border-stone-800 rounded-[2rem] flex flex-col items-center justify-center gap-3 text-stone-600 hover:text-orange-400 hover:border-orange-500/30 transition-all">
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
              <button onClick={onCloseWhisper} className="text-stone-600 hover:text-white"><X size={12} /></button>
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
    </aside>
  );
};
