
import React, { useState, useEffect } from 'react';
import { Sparkles, Upload, Loader2, ChevronRight, Rocket, Coffee, Feather, Book, BookOpen, FileJson, X } from 'lucide-react';
import { generateRandomProject } from '../services/geminiService';
import { StoryProject } from '../types';
import { normalizeProject } from '../App';

interface Props {
  onStart: (projectData: StoryProject) => void;
  onOpenHelp: () => void;
  showAlert: (title: string, message: string) => void;
  showConfirm: (title: string, message: string, onConfirm: () => void) => void;
}

const WelcomeScreen: React.FC<Props> = ({ onStart, onOpenHelp, showAlert, showConfirm }) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [title, setTitle] = useState('');
  const [idea, setIdea] = useState('');
  const [autoTheme, setAutoTheme] = useState('');
  const [existingProject, setExistingProject] = useState<StoryProject | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem('duoscript_project');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed && (parsed.id || parsed.title)) {
          setExistingProject(normalizeProject(parsed));
        }
      } catch (e) {}
    }
  }, []);

  const handleLaunchManual = () => {
    const initialProject: StoryProject = normalizeProject({
      title: title || '名もなき物語',
      bible: { setting: idea || '物語の最初の一歩。' },
      chapters: [{ title: '序章', summary: idea || '静かな始まり...' }]
    });
    onStart(initialProject);
  };

  const handleLaunchAuto = async () => {
    if (!autoTheme.trim()) return;
    setIsProcessing(true);
    try {
      // FIX: Added logCallback as the second argument as required by generateRandomProject signature
      const generated = await generateRandomProject(autoTheme, (type: string, source: string, msg: string, detail?: string) => {
        console.log(`[${source}] ${type}: ${msg}`, detail);
      });
      onStart(normalizeProject(generated));
    } catch (e) {
      showAlert("生成エラー", "インスピレーションの取得に失敗しました。");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (json && (json.title || json.bible || json.chapters)) {
          onStart(normalizeProject(json));
        } else {
          showAlert("読み込み失敗", "無効なプロジェクトファイルです。");
        }
      } catch (err) {
        showAlert("エラー", "ファイルの解析に失敗しました。");
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="fixed inset-0 bg-stone-900 flex flex-col items-center p-4 md:p-12 overflow-y-auto custom-scrollbar">
      <div className="w-full max-w-4xl space-y-10 md:space-y-16 animate-fade-in py-8 md:py-12">
        <header className="text-center space-y-4 md:space-y-6">
          <div className="flex justify-center mb-2 md:mb-4">
            <div className="p-3 md:p-4 bg-orange-200/10 rounded-full border border-orange-200/20 shadow-xl">
              <Feather size={32} className="text-orange-300 md:w-12 md:h-12" />
            </div>
          </div>
          <h1 className="text-4xl md:text-7xl font-display font-black italic text-stone-100 tracking-tight flex flex-col gap-1 md:gap-2">
            DUO<span className="text-orange-400">SCRIPT</span>
          </h1>
          <p className="text-stone-500 font-serif italic text-sm md:text-lg tracking-[0.2em] md:tracking-widest px-4">物語を紡ぐための、静かなアトリエ</p>
        </header>

        <div className="space-y-4">
          <div className="text-[9px] md:text-[10px] font-black uppercase text-stone-700 tracking-[0.4em] mb-2 text-center">続行または読み込み</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
            {existingProject ? (
              <button onClick={() => onStart(existingProject)} className="p-5 md:p-6 bg-stone-800/40 border border-stone-700/50 rounded-2xl md:rounded-[2rem] flex items-center justify-between hover:bg-stone-800 transition-all shadow-xl group text-left">
                <div className="flex items-center gap-4 min-w-0">
                  <div className="w-9 h-9 md:w-10 md:h-10 rounded-xl bg-stone-700 flex items-center justify-center text-orange-400 shrink-0">
                    <BookOpen size={18}/>
                  </div>
                  <div className="min-w-0">
                    <div className="font-display font-black text-base md:text-lg text-stone-200 italic truncate">{existingProject.title}</div>
                    <div className="text-[8px] md:text-[9px] font-black text-stone-600 uppercase tracking-widest mt-0.5 truncate">執筆を再開 (V{existingProject.bible.version})</div>
                  </div>
                </div>
                <ChevronRight size={18} className="text-stone-600 group-hover:text-orange-400 transition-colors shrink-0"/>
              </button>
            ) : (
              <div className="p-5 border border-dashed border-stone-800 rounded-2xl md:rounded-[2rem] flex items-center justify-center text-stone-700 italic text-[10px] font-serif">
                アーカイブされた物語はありません
              </div>
            )}

            <label className="p-5 md:p-6 bg-stone-800/20 border border-stone-800 hover:border-orange-500/30 rounded-2xl md:rounded-[2rem] flex items-center gap-4 cursor-pointer hover:bg-stone-800/40 transition-all group">
              <div className="w-9 h-9 md:w-10 md:h-10 rounded-xl bg-stone-900 flex items-center justify-center text-stone-500 group-hover:text-orange-400">
                <FileJson size={18}/>
              </div>
              <div className="text-left">
                <div className="text-[10px] md:text-[11px] font-black text-stone-400 uppercase tracking-widest">バックアップを復元</div>
                <div className="text-[8px] md:text-[9px] text-stone-700 mt-0.5 truncate">過去のJSONをロード</div>
              </div>
              <input type="file" accept=".json" className="hidden" onChange={handleFileUpload}/>
            </label>
          </div>
        </div>

        <div className="space-y-6 md:space-y-8">
          <div className="text-[9px] md:text-[10px] font-black uppercase text-stone-700 tracking-[0.4em] text-center">新しく物語を始める</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
             <div className="p-8 md:p-10 glass-bright rounded-[2rem] md:rounded-[3rem] space-y-6 md:space-y-8 flex flex-col shadow-2xl">
                <div className="flex items-center gap-3 md:gap-4">
                  <div className="p-2 md:p-3 bg-orange-400/20 rounded-2xl text-orange-400"><Coffee size={20} className="md:w-6 md:h-6"/></div>
                  <h3 className="text-xl md:text-2xl font-display font-black text-white italic">自由な構想</h3>
                </div>
                <div className="space-y-3 md:space-y-4 flex-1">
                  <input value={title} onChange={e => setTitle(e.target.value)} placeholder="物語の題名" className="w-full bg-stone-900/50 border border-stone-700 rounded-xl md:rounded-2xl p-4 md:p-5 text-[13px] md:text-sm text-white outline-none focus:border-orange-400/50 transition-all"/>
                  <textarea value={idea} onChange={e => setIdea(e.target.value)} placeholder="始まりのアイデア..." className="w-full bg-stone-900/50 border border-stone-700 rounded-xl md:rounded-2xl p-4 md:p-5 text-[13px] md:text-sm text-white h-24 md:h-36 outline-none resize-none focus:border-orange-400/50 transition-all font-serif"/>
                </div>
                <button onClick={handleLaunchManual} className="w-full py-4 md:py-5 bg-orange-500 hover:bg-orange-400 text-stone-950 font-black rounded-xl md:rounded-2xl shadow-xl transition-all active:scale-95 uppercase tracking-widest text-[10px] md:text-xs">アトリエに入る</button>
             </div>
             
             <div className="p-8 md:p-10 glass-bright rounded-[2rem] md:rounded-[3rem] space-y-6 md:space-y-8 flex flex-col shadow-2xl border-orange-400/10">
                <div className="flex items-center gap-3 md:gap-4">
                  <div className="p-2 md:p-3 bg-stone-700/50 rounded-2xl text-orange-300"><Rocket size={20} className="md:w-6 md:h-6"/></div>
                  <h3 className="text-xl md:text-2xl font-display font-black text-white italic">AI ミューズ</h3>
                </div>
                <div className="flex-1 space-y-4 md:space-y-6">
                  <p className="text-[11px] md:text-sm text-stone-500 font-serif italic leading-relaxed">テーマを入力するだけで、AIがインスピレーションを形にし、初期設定を自動生成します。</p>
                  <input value={autoTheme} onChange={e => setAutoTheme(e.target.value)} placeholder="テーマ (例: 記憶を売る喫茶店)" className="w-full bg-stone-900/50 border border-stone-700 rounded-xl md:rounded-2xl p-4 md:p-5 text-[13px] md:text-sm text-white outline-none focus:border-orange-400/50 transition-all"/>
                </div>
                <button onClick={handleLaunchAuto} disabled={isProcessing} className="w-full py-4 md:py-5 bg-stone-100 hover:bg-white text-stone-900 font-black rounded-xl md:rounded-2xl shadow-xl flex items-center justify-center gap-3 transition-all active:scale-95 uppercase tracking-widest text-[10px] md:text-xs">
                  {isProcessing ? <Loader2 size={16} className="animate-spin"/> : <Sparkles size={16}/>} インスピレーションを得る
                </button>
             </div>
          </div>
        </div>

        <div className="text-center opacity-30 pb-10">
           <button onClick={onOpenHelp} className="text-[9px] md:text-[10px] font-black uppercase tracking-widest text-stone-500 hover:text-white transition-all">
             アトリエガイドを表示
           </button>
        </div>
      </div>
    </div>
  );
};

export default WelcomeScreen;
