
import React from 'react';
import { ShieldCheck, X, AlertTriangle, Scale, Eye, FileText } from 'lucide-react';

interface Props {
  onAccept: () => void;
}

const ComplianceModal: React.FC<Props> = ({ onAccept }) => {
  return (
    <div className="fixed inset-0 z-[500] bg-stone-950/95 backdrop-blur-3xl flex items-center justify-center p-6 animate-fade-in">
      <div className="bg-stone-900 w-full max-w-2xl rounded-[3rem] border border-stone-800 shadow-[0_50px_100px_-20px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-10 border-b border-stone-800 bg-stone-900/50 flex items-center gap-6">
          <div className="p-4 bg-orange-600 rounded-2xl text-white shadow-xl shadow-orange-900/20">
            <ShieldCheck size={32} />
          </div>
          <div>
            <h2 className="text-3xl font-black text-white italic tracking-tighter uppercase">Safety & Policy</h2>
            <p className="text-stone-500 font-medium">Gemini API 利用規約および安全性ガイドライン</p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-10 space-y-8 custom-scrollbar">
          <section className="space-y-4">
            <h3 className="text-xs font-black text-orange-400 uppercase tracking-[0.2em] flex items-center gap-2">
              <Scale size={14} /> 禁止されている行為
            </h3>
            <p className="text-sm text-stone-300 leading-relaxed">
              DuoScriptおよびGoogle Gemini APIの利用において、以下のコンテンツの生成を目的とした利用は固く禁止されています。
            </p>
            <ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <PolicyItem label="性的・露骨な表現" desc="性的暴行や非同意の性的コンテンツなど。" />
              <PolicyItem label="ヘイトスピーチ" desc="アイデンティティに基づく差別や暴力の煽動。" />
              <PolicyItem label="嫌がらせ・ハラスメント" desc="特定個人への執拗な攻撃やいじめ。" />
              <PolicyItem label="危険な活動" desc="自傷行為や違法行為の助長。" />
            </ul>
          </section>

          <section className="p-6 bg-amber-500/5 border border-amber-500/20 rounded-2xl space-y-3">
            <h3 className="text-[10px] font-black text-amber-500 uppercase tracking-widest flex items-center gap-2">
              <AlertTriangle size={14} /> フィルターによる拒否
            </h3>
            <p className="text-[11px] text-stone-400 leading-relaxed font-medium">
              小説のプロットや描写が上記のポリシーに抵触するとAIが判断した場合、生成が拒否されることがあります。これはAIの安全機構によるものであり、表現を調整することで回避できる場合があります。
            </p>
          </section>

          <section className="space-y-4">
            <h3 className="text-xs font-black text-orange-400 uppercase tracking-[0.2em] flex items-center gap-2">
              <Eye size={14} /> データの取り扱い
            </h3>
            <p className="text-[11px] text-stone-400 leading-relaxed">
              入力されたデータは、APIを通じてGoogleへ送信されます。機密情報、個人を特定できる情報、または極めて重要な情報の入力は控えてください。本アプリは入力されたデータをブラウザのローカルストレージにのみ保存します。
            </p>
          </section>
        </div>

        <div className="p-10 border-t border-stone-800 bg-stone-900/50 flex flex-col gap-6">
          <div className="flex items-center gap-3">
            <div className="w-5 h-5 rounded bg-orange-600 flex items-center justify-center text-white">
              <ShieldCheck size={12} />
            </div>
            <p className="text-[10px] text-stone-500 font-black uppercase tracking-widest">私はガイドラインを理解し、同意します</p>
          </div>
          <button 
            onClick={onAccept}
            className="w-full py-5 bg-orange-600 text-white font-black rounded-2xl shadow-2xl shadow-orange-900/40 hover:bg-orange-500 transition-all active:scale-[0.98] text-xs uppercase tracking-[0.2em]"
          >
            利用規約に同意して執筆を開始する
          </button>
        </div>
      </div>
    </div>
  );
};

const PolicyItem = ({ label, desc }: { label: string, desc: string }) => (
  <li className="p-4 bg-stone-950/50 border border-white/5 rounded-xl space-y-1">
    <div className="text-[10px] font-black text-white uppercase tracking-widest">{label}</div>
    <div className="text-[9px] text-stone-500 font-medium leading-relaxed">{desc}</div>
  </li>
);

export default ComplianceModal;
