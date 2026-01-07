
import React, { useState } from 'react';
import { ShieldCheck, AlertTriangle, Scale, Eye, FileText, Database, Send, Lock, Zap } from 'lucide-react';
import { AppPreferences, TransmissionScope, SafetyPreset } from '../types';

interface Props {
  onAccept: (prefs: AppPreferences) => void;
}

const ComplianceModal: React.FC<Props> = ({ onAccept }) => {
  const [prefs, setPrefs] = useState<AppPreferences>({
    transmissionScope: TransmissionScope.FULL,
    safetyPreset: SafetyPreset.MATURE,
    allowSearch: true
  });

  return (
    <div className="fixed inset-0 z-[500] bg-stone-950/95 backdrop-blur-3xl flex items-center justify-center p-4 md:p-6 animate-fade-in overflow-y-auto">
      <div className="bg-stone-900 w-full max-w-3xl rounded-[2rem] md:rounded-[3rem] border border-stone-800 shadow-[0_50px_100px_-20px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col max-h-[95vh] md:max-h-[90vh]">
        <div className="p-6 md:p-10 border-b border-stone-800 bg-stone-900/50 flex items-center gap-6">
          <div className="p-3 md:p-4 bg-orange-600 rounded-2xl text-white shadow-xl shadow-orange-900/20">
            <ShieldCheck size={32} className="md:w-8 md:h-8 w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl md:text-3xl font-black text-white italic tracking-tighter uppercase">アトリエ入室プロトコル</h2>
            <p className="text-stone-500 font-medium text-xs md:text-sm">データ管理とプライバシー設定</p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 md:p-10 space-y-8 md:space-y-10 custom-scrollbar">
          {/* Data Transparency Section */}
          <section className="space-y-4">
            <h3 className="text-[10px] md:text-xs font-black text-orange-400 uppercase tracking-[0.2em] flex items-center gap-2">
              <Database size={14} /> データの保存と送信について
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
               <div className="p-5 bg-stone-950/50 border border-white/5 rounded-2xl space-y-2">
                  <div className="flex items-center gap-2 text-emerald-400">
                    <Lock size={14}/>
                    <span className="text-[10px] font-black uppercase tracking-widest">保存（ローカル）</span>
                  </div>
                  <p className="text-[11px] text-stone-400 leading-relaxed font-serif">
                    プロジェクトデータ、キャラクター設定、執筆中の原稿は、お使いの端末（IndexedDB）にのみ保存されます。アプリ運営側がこれらを収集・保存することはありません。
                  </p>
               </div>
               <div className="p-5 bg-stone-950/50 border border-white/5 rounded-2xl space-y-2">
                  <div className="flex items-center gap-2 text-orange-400">
                    <Send size={14}/>
                    <span className="text-[10px] font-black uppercase tracking-widest">送信（Gemini API）</span>
                  </div>
                  <p className="text-[11px] text-stone-400 leading-relaxed font-serif">
                    推論、執筆、画像生成のため、必要なテキストデータがGoogle Gemini APIへ送信されます。送信される範囲は以下の設定で制御可能です。
                  </p>
               </div>
            </div>
          </section>

          {/* Transmission Scope Section */}
          <section className="space-y-4">
            <h3 className="text-[10px] md:text-xs font-black text-orange-400 uppercase tracking-[0.2em] flex items-center gap-2">
              <FileText size={14} /> AIへの送信範囲
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <ScopeCard 
                active={prefs.transmissionScope === TransmissionScope.FULL}
                onClick={() => setPrefs({...prefs, transmissionScope: TransmissionScope.FULL})}
                label="Full Context"
                desc="全てのプロットと設定をAIに共有し、最高の整合性を維持します。"
              />
              <ScopeCard 
                active={prefs.transmissionScope === TransmissionScope.SUMMARY}
                onClick={() => setPrefs({...prefs, transmissionScope: TransmissionScope.SUMMARY})}
                label="Summary Only"
                desc="要約と最小限のキャラクター情報のみ共有し、プライバシーを保護します。"
              />
              <ScopeCard 
                active={prefs.transmissionScope === TransmissionScope.CHAPTER}
                onClick={() => setPrefs({...prefs, transmissionScope: TransmissionScope.CHAPTER})}
                label="Active Chapter"
                desc="現在執筆中の章のテキストのみを共有します。"
              />
              <ScopeCard 
                active={prefs.transmissionScope === TransmissionScope.MINIMAL}
                onClick={() => setPrefs({...prefs, transmissionScope: TransmissionScope.MINIMAL})}
                label="Instruction Only"
                desc="指示文以外のコンテキスト送信を遮断します（推論精度は低下します）。"
              />
            </div>
          </section>

          {/* Safety Presets Section */}
          <section className="space-y-4">
            <h3 className="text-[10px] md:text-xs font-black text-orange-400 uppercase tracking-[0.2em] flex items-center gap-2">
              <Zap size={14} /> 創作セーフティ・プリセット
            </h3>
            <div className="flex flex-col md:flex-row gap-3">
              <PresetBtn 
                active={prefs.safetyPreset === SafetyPreset.STRICT}
                onClick={() => setPrefs({...prefs, safetyPreset: SafetyPreset.STRICT})}
                label="Strict"
                sub="一般向け"
                desc="安全性最優先"
              />
              <PresetBtn 
                active={prefs.safetyPreset === SafetyPreset.MATURE}
                onClick={() => setPrefs({...prefs, safetyPreset: SafetyPreset.MATURE})}
                label="Mature"
                sub="文学・創作"
                desc="ドラマ性を許容"
              />
              <PresetBtn 
                active={prefs.safetyPreset === SafetyPreset.CREATIVE}
                onClick={() => setPrefs({...prefs, safetyPreset: SafetyPreset.CREATIVE})}
                label="Creative"
                sub="無制限"
                desc="表現の自由を重視"
              />
            </div>
            <p className="text-[10px] text-stone-600 font-serif italic text-center">※ AIモデル側の安全フィルター設定に反映されますが、完全に回避できるわけではありません。</p>
          </section>
        </div>

        <div className="p-6 md:p-10 border-t border-stone-800 bg-stone-900/50 flex flex-col gap-6">
          <div className="flex items-center gap-3">
            <div className="w-5 h-5 rounded bg-orange-600 flex items-center justify-center text-white">
              <ShieldCheck size={12} />
            </div>
            <p className="text-[10px] text-stone-500 font-black uppercase tracking-widest">私はデータの取り扱いと設定内容を理解し、同意します</p>
          </div>
          <button 
            onClick={() => onAccept(prefs)}
            className="w-full py-5 bg-orange-600 text-white font-black rounded-2xl shadow-2xl shadow-orange-900/40 hover:bg-orange-500 transition-all active:scale-[0.98] text-xs uppercase tracking-[0.2em]"
          >
            設定を保存してアトリエに入る
          </button>
        </div>
      </div>
    </div>
  );
};

const ScopeCard = ({ active, onClick, label, desc }: { active: boolean, onClick: () => void, label: string, desc: string }) => (
  <button 
    onClick={onClick}
    className={`p-5 text-left rounded-2xl border transition-all space-y-2 ${active ? 'bg-orange-600/10 border-orange-500/40' : 'bg-stone-950/40 border-white/5 hover:border-white/10'}`}
  >
    <div className={`text-[10px] font-black uppercase tracking-widest ${active ? 'text-orange-400' : 'text-stone-500'}`}>{label}</div>
    <p className="text-[10px] text-stone-400 leading-relaxed font-serif">{desc}</p>
  </button>
);

const PresetBtn = ({ active, onClick, label, sub, desc }: { active: boolean, onClick: () => void, label: string, sub: string, desc: string }) => (
  <button 
    onClick={onClick}
    className={`flex-1 p-4 rounded-2xl border transition-all text-center ${active ? 'bg-orange-600/10 border-orange-500/40' : 'bg-stone-950/40 border-white/5 hover:border-white/10'}`}
  >
    <div className={`text-[11px] font-black uppercase tracking-widest ${active ? 'text-orange-400' : 'text-stone-300'}`}>{label}</div>
    <div className="text-[8px] font-black text-stone-500 uppercase mt-0.5">{sub}</div>
    <div className="text-[9px] text-stone-600 mt-2 font-serif">{desc}</div>
  </button>
);

export default ComplianceModal;
