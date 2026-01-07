
import React, { useState, useEffect } from 'react';
import { Sparkles, Loader2, ChevronRight, Rocket, Coffee, Feather, BookOpen, FileJson } from 'lucide-react';
import { generateRandomProject } from '../services/geminiService';
import { StoryProject } from '../types';
import { normalizeProject } from '../services/bibleManager';
import { getAllProjects } from '../services/storageService';
import { Button, Card, SectionHeader } from './ui/DesignSystem';

interface Props {
  onStart: (projectData: StoryProject) => void;
  onOpenHelp: () => void;
  showAlert: (title: string, message: string) => void;
  showConfirm: (title: string, message: string, onConfirm: () => void) => void;
}

const WelcomeScreen: React.FC<Props> = ({ onStart, onOpenHelp, showAlert }) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [title, setTitle] = useState('');
  const [idea, setIdea] = useState('');
  const [autoTheme, setAutoTheme] = useState('');
  const [projects, setProjects] = useState<StoryProject[]>([]);
  const [isLoadingProjects, setIsLoadingProjects] = useState(true);

  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const stored = await getAllProjects();
        if (stored && stored.length > 0) {
          setProjects(stored.map(p => normalizeProject(p)));
        }
      } catch (e) {
        console.error("Failed to fetch project list", e);
      } finally {
        setIsLoadingProjects(false);
      }
    };
    fetchProjects();
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
        if (json && (json.title || json.bible || json.chapters || json.meta)) {
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
    <div className="fixed inset-0 bg-stone-900 flex flex-col items-center p-4 md:p-12 overflow-y-auto no-scrollbar pb-safe">
      <div className="w-full max-w-4xl space-y-8 md:space-y-16 animate-fade-in py-6 md:py-12">
        <header className="text-center space-y-4 md:space-y-6">
          <div className="flex justify-center mb-2 md:mb-4">
            <div className="p-3 md:p-4 bg-orange-200/10 rounded-full border border-orange-200/20 shadow-xl">
              <Feather size={28} className="text-orange-300 md:w-12 md:h-12" />
            </div>
          </div>
          <h1 className="text-4xl md:text-7xl font-display font-black italic text-stone-100 tracking-tight flex flex-col gap-1 md:gap-2">
            DUO<span className="text-orange-400">SCRIPT</span>
          </h1>
          <p className="text-stone-500 font-serif italic text-xs md:text-lg tracking-[0.2em] md:tracking-widest px-4">物語を紡ぐための、静かなアトリエ</p>
        </header>

        <div className="space-y-4">
          <SectionHeader title="続行または読み込み" className="justify-center" />
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
            {isLoadingProjects ? (
              <Card variant="panel" padding="lg" className="col-span-1 md:col-span-2 flex items-center justify-center text-stone-700 gap-3">
                <Loader2 size={16} className="animate-spin" />
                <span className="text-[10px] uppercase font-black tracking-widest">書庫を確認中...</span>
              </Card>
            ) : projects.length > 0 ? (
              projects.map(project => (
                <Card key={project.meta.id} variant="panel" padding="md" className="group cursor-pointer hover:bg-stone-800" onClick={() => onStart(project)}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="w-9 h-9 md:w-10 md:h-10 rounded-xl bg-stone-700 flex items-center justify-center text-orange-400 shrink-0">
                        <BookOpen size={18}/>
                      </div>
                      <div className="min-w-0">
                        <div className="font-display font-black text-sm md:text-lg text-stone-200 italic truncate">{project.meta.title}</div>
                        <div className="text-[8px] md:text-[9px] font-black text-stone-600 uppercase tracking-widest mt-0.5 truncate">V{project.bible.version} / {new Date(project.meta.updatedAt).toLocaleDateString()}</div>
                      </div>
                    </div>
                    <ChevronRight size={18} className="text-stone-600 group-hover:text-orange-400 transition-colors shrink-0"/>
                  </div>
                </Card>
              ))
            ) : (
              <Card variant="outline" padding="lg" className="col-span-1 md:col-span-2 flex items-center justify-center text-stone-700 italic text-[10px] font-serif">
                アーカイブされた物語はありません
              </Card>
            )}

            <label className="block">
               <Card variant="panel" padding="md" className="h-full flex items-center gap-4 cursor-pointer hover:bg-stone-800/40 hover:border-orange-500/30 group">
                <div className="w-9 h-9 md:w-10 md:h-10 rounded-xl bg-stone-900 flex items-center justify-center text-stone-500 group-hover:text-orange-400">
                  <FileJson size={18}/>
                </div>
                <div className="text-left">
                  <div className="text-[10px] md:text-[11px] font-black text-stone-400 uppercase tracking-widest">バックアップを復元</div>
                  <div className="text-[8px] md:text-[9px] text-stone-700 mt-0.5 truncate">JSONをロード</div>
                </div>
                <input type="file" accept=".json" className="hidden" onChange={handleFileUpload}/>
              </Card>
            </label>
          </div>
        </div>

        <div className="space-y-6 md:space-y-8">
          <SectionHeader title="新しく物語を始める" className="justify-center" />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 pb-10">
             <Card variant="glass-bright" padding="lg" className="flex flex-col gap-6 shadow-2xl">
                <div className="flex items-center gap-3 md:gap-4">
                  <div className="p-2 md:p-3 bg-orange-400/20 rounded-2xl text-orange-400"><Coffee size={18} className="md:w-6 md:h-6"/></div>
                  <h3 className="text-xl md:text-2xl font-display font-black text-white italic">自由な構想</h3>
                </div>
                <div className="space-y-3 md:space-y-4 flex-1">
                  <input value={title} onChange={e => setTitle(e.target.value)} placeholder="物語の題名" className="w-full bg-stone-900/50 border border-stone-700 rounded-xl md:rounded-2xl p-4 md:p-5 text-sm text-white outline-none focus:border-orange-400/50 transition-all"/>
                  <textarea value={idea} onChange={e => setIdea(e.target.value)} placeholder="始まりのアイデア..." className="w-full bg-stone-900/50 border border-stone-700 rounded-xl md:rounded-2xl p-4 md:p-5 text-sm text-white h-24 md:h-36 outline-none resize-none focus:border-orange-400/50 transition-all font-serif"/>
                </div>
                <Button variant="primary" onClick={handleLaunchManual} className="w-full uppercase tracking-widest text-[10px] md:text-xs py-4 md:py-5">アトリエに入る</Button>
             </Card>
             
             <Card variant="glass-bright" padding="lg" className="flex flex-col gap-6 shadow-2xl border-orange-400/10">
                <div className="flex items-center gap-3 md:gap-4">
                  <div className="p-2 md:p-3 bg-stone-700/50 rounded-2xl text-orange-300"><Rocket size={18} className="md:w-6 md:h-6"/></div>
                  <h3 className="text-xl md:text-2xl font-display font-black text-white italic">AI ミューズ</h3>
                </div>
                <div className="flex-1 space-y-4 md:space-y-6">
                  <p className="text-[11px] md:text-sm text-stone-500 font-serif italic leading-relaxed">テーマを入力するだけで、AIがインスピレーションを形にし、初期設定を自動生成します。</p>
                  <input value={autoTheme} onChange={e => setAutoTheme(e.target.value)} placeholder="テーマ (例: 記憶を売る喫茶店)" className="w-full bg-stone-900/50 border border-stone-700 rounded-xl md:rounded-2xl p-4 md:p-5 text-sm text-white outline-none focus:border-orange-400/50 transition-all"/>
                </div>
                <Button variant="secondary" onClick={handleLaunchAuto} isLoading={isProcessing} icon={<Sparkles size={16}/>} className="w-full bg-stone-100 hover:bg-white text-stone-900 uppercase tracking-widest text-[10px] md:text-xs py-4 md:py-5">
                   インスピレーションを得る
                </Button>
             </Card>
          </div>
        </div>

        <div className="text-center opacity-30 pb-20">
           <Button variant="ghost" onClick={onOpenHelp} size="xs" className="text-[9px] md:text-[10px]">
             アトリエガイドを表示
           </Button>
        </div>
      </div>
    </div>
  );
};

export default WelcomeScreen;
