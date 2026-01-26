
import React from 'react';
import { Sparkles, Loader2, ChevronRight, Rocket, Coffee, Feather, BookOpen, FileJson, Globe, CheckCircle2, AlertTriangle } from 'lucide-react';
import { StoryProject } from '../types';
import { Button, Card, SectionHeader, Styles } from './ui/DesignSystem';
import { t } from '../utils/i18n';
import { useWelcomeLogic } from '../hooks/useWelcomeLogic';

interface Props {
  onStart: (projectData: StoryProject) => void;
  onOpenHelp: () => void;
  showAlert: (title: string, message: string) => void;
  showConfirm: (title: string, message: string, onConfirm: () => void) => void;
}

const WelcomeScreen: React.FC<Props> = ({ onStart, onOpenHelp, showAlert }) => {
  const {
    lang,
    projects,
    isLoadingProjects,
    title,
    setTitle,
    idea,
    setIdea,
    autoTheme,
    setAutoTheme,
    isProcessing,
    progressMsg,
    handleLangSwitch,
    handleLaunchManual,
    handleLaunchAuto,
    handleFileUpload
  } = useWelcomeLogic({ onStart, showAlert });

  const hasApiKey = !!process.env.API_KEY;

  return (
    <div className="fixed inset-0 bg-stone-900 flex flex-col items-center p-4 md:p-12 overflow-y-auto no-scrollbar pb-safe">
      <div className="absolute top-4 right-4 z-50 flex items-center gap-2">
        <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full border text-[9px] font-black uppercase tracking-widest ${hasApiKey ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-rose-500/10 border-rose-500/20 text-rose-400'}`}>
           {hasApiKey ? <CheckCircle2 size={10} /> : <AlertTriangle size={10} />}
           {hasApiKey ? 'API Ready' : 'Key Missing'}
        </div>
        <button onClick={handleLangSwitch} className={`flex items-center gap-2 px-3 py-1.5 rounded-full bg-stone-800 text-stone-400 hover:text-white transition-all border border-white/5 ${Styles.text.label}`}>
          <Globe size={12} /> {lang === 'ja' ? 'English' : '日本語'}
        </button>
      </div>

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
          <p className="text-stone-500 font-serif italic text-xs md:text-lg tracking-[0.2em] md:tracking-widest px-4">{t('welcome.subtitle', lang)}</p>
        </header>

        <div className="space-y-4">
          <SectionHeader title={t('welcome.continue', lang)} className="justify-center" />
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
            {isLoadingProjects ? (
              <Card variant="panel" padding="lg" className="col-span-1 md:col-span-2 flex items-center justify-center text-stone-700 gap-3">
                <Loader2 size={16} className="animate-spin" />
                <span className={Styles.text.label}>{t('welcome.loading_projects', lang)}</span>
              </Card>
            ) : projects.length > 0 ? (
              projects.map(project => (
                <button 
                  key={project.meta.id} 
                  onClick={() => onStart(project)}
                  className="w-full text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 rounded-[1.5rem] md:rounded-[2rem] group"
                >
                  <Card variant="panel" padding="md" className="group-hover:bg-stone-800 transition-colors h-full">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4 min-w-0">
                        <div className="w-9 h-9 md:w-10 md:h-10 rounded-xl bg-stone-700 flex items-center justify-center text-orange-400 shrink-0">
                          <BookOpen size={18}/>
                        </div>
                        <div className="min-w-0">
                          <div className="font-display font-black text-sm md:text-lg text-stone-200 italic truncate">{project.meta.title}</div>
                          <div className={`${Styles.text.labelSm} mt-0.5 truncate`}>V{project.bible.version} / {new Date(project.meta.updatedAt).toLocaleDateString()}</div>
                        </div>
                      </div>
                      <ChevronRight size={18} className="text-stone-600 group-hover:text-orange-400 transition-colors shrink-0"/>
                    </div>
                  </Card>
                </button>
              ))
            ) : (
              <Card variant="outline" padding="lg" className="col-span-1 md:col-span-2 flex items-center justify-center text-stone-700 italic text-[10px] font-serif">
                {t('welcome.no_projects', lang)}
              </Card>
            )}

            <label className="block w-full focus-within:ring-2 focus-within:ring-orange-400 rounded-[1.5rem] md:rounded-[2rem] cursor-pointer">
               <Card variant="panel" padding="md" className="h-full flex items-center gap-4 hover:bg-stone-800/40 hover:border-orange-500/30 group transition-colors">
                <div className="w-9 h-9 md:w-10 md:h-10 rounded-xl bg-stone-900 flex items-center justify-center text-stone-500 group-hover:text-orange-400">
                  <FileJson size={18}/>
                </div>
                <div className="text-left">
                  <div className={`${Styles.text.labelSm} text-stone-400`}>{t('welcome.load_backup', lang)}</div>
                  <div className="text-[8px] md:text-[9px] text-stone-700 mt-0.5 truncate">{t('welcome.load_json', lang)}</div>
                </div>
                {/* sr-only allows accessibility focus while hiding visually */}
                <input type="file" accept=".json" className="sr-only" onChange={handleFileUpload}/>
              </Card>
            </label>
          </div>
        </div>

        <div className="space-y-6 md:space-y-8">
          <SectionHeader title={t('welcome.start_new', lang)} className="justify-center" />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 pb-10">
             <Card variant="glass-bright" padding="lg" className="flex flex-col gap-6 shadow-2xl">
                <div className="flex items-center gap-3 md:gap-4">
                  <div className="p-2 md:p-3 bg-orange-400/20 rounded-2xl text-orange-400"><Coffee size={18} className="md:w-6 md:h-6"/></div>
                  <h3 className={Styles.text.title}>{t('welcome.manual_title', lang)}</h3>
                </div>
                <div className="space-y-3 md:space-y-4 flex-1">
                  <input value={title} onChange={e => setTitle(e.target.value)} placeholder={t('welcome.manual_desc', lang)} className="w-full bg-stone-900/50 border border-stone-700 rounded-xl md:rounded-2xl p-4 md:p-5 text-sm text-white outline-none focus:border-orange-400/50 transition-all"/>
                  <textarea value={idea} onChange={e => setIdea(e.target.value)} placeholder={t('welcome.manual_idea', lang)} className="w-full bg-stone-900/50 border border-stone-700 rounded-xl md:rounded-2xl p-4 md:p-5 text-sm text-white h-24 md:h-36 outline-none resize-none focus:border-orange-400/50 transition-all font-serif"/>
                </div>
                <Button variant="primary" onClick={handleLaunchManual} className="w-full uppercase tracking-widest text-[10px] md:text-xs py-4 md:py-5">{t('welcome.enter_atelier', lang)}</Button>
             </Card>
             
             <Card variant="glass-bright" padding="lg" className="flex flex-col gap-6 shadow-2xl border-orange-400/10">
                <div className="flex items-center gap-3 md:gap-4">
                  <div className="p-2 md:p-3 bg-stone-700/50 rounded-2xl text-orange-300"><Rocket size={18} className="md:w-6 md:h-6"/></div>
                  <h3 className={Styles.text.title}>{t('welcome.muse_title', lang)}</h3>
                </div>
                <div className="flex-1 space-y-4 md:space-y-6">
                  <p className="text-[11px] md:text-sm text-stone-500 font-serif italic leading-relaxed">{t('welcome.muse_desc', lang)}</p>
                  <input value={autoTheme} onChange={e => setAutoTheme(e.target.value)} placeholder={t('welcome.muse_placeholder', lang)} className="w-full bg-stone-900/50 border border-stone-700 rounded-xl md:rounded-2xl p-4 md:p-5 text-sm text-white outline-none focus:border-orange-400/50 transition-all"/>
                </div>
                <Button variant="ghost" onClick={handleLaunchAuto} isLoading={isProcessing} icon={<Sparkles size={16}/>} className="w-full !bg-stone-100 hover:!bg-white !text-stone-900 uppercase tracking-widest text-[10px] md:text-xs py-4 md:py-5 flex-col gap-1 h-auto">
                   {isProcessing ? (
                     <>
                       <span>{progressMsg}</span>
                       <span className="text-[8px] font-normal opacity-60 normal-case">(完了まで数分かかります)</span>
                     </>
                   ) : t('welcome.muse_btn', lang)}
                </Button>
             </Card>
          </div>
        </div>

        <div className="text-center opacity-30 pb-20">
           <Button variant="ghost" onClick={onOpenHelp} size="xs" className="text-[9px] md:text-[10px]">
             {t('welcome.guide', lang)}
           </Button>
        </div>
      </div>
    </div>
  );
};

export default WelcomeScreen;
