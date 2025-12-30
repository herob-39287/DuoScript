
import React, { useState, useEffect } from 'react';
import { useMetadata } from '../contexts/StoryContext';
import { X, Check, BookOpen, FileJson, Eye, Settings2, Loader2 } from 'lucide-react';
import { loadFullSnapshot, getHeadRev } from '../services/storageService';
import { StoryProject } from '../types';

interface Props {
    onClose: () => void;
}

const PublicationModal: React.FC<Props> = ({ onClose }) => {
    const meta = useMetadata();
    
    const [header, setHeader] = useState('');
    const [footer, setFooter] = useState('');
    const [copied, setCopied] = useState(false);
    const [mobileTab, setMobileTab] = useState<'settings' | 'preview'>('preview');
    const [isPreparing, setIsPreparing] = useState(true);
    const [exportData, setExportData] = useState<StoryProject | null>(null);
    const [fullDraftContent, setFullDraftContent] = useState('');

    useEffect(() => {
        const prepareExport = async () => {
            setIsPreparing(true);
            try {
                // エクスポート開始時点での最新Revisionを特定し、固定する
                const currentHead = await getHeadRev(meta.id);
                // そのRevisionに含まれる全データを一貫したスナップショットとしてロード
                const fullProject = await loadFullSnapshot(meta.id, currentHead);
                
                if (fullProject) {
                    setExportData(fullProject);
                    const draft = (fullProject.chapters || []).map((ch: any) => {
                        return `### ${ch.title}\n\n${ch.content || ""}\n\n***\n`;
                    }).join('\n');
                    setFullDraftContent(draft);
                }
            } catch (e) {
                console.error("Export preparation failed", e);
            } finally {
                setIsPreparing(false);
            }
        };
        prepareExport();
    }, [meta.id]);

    const previewText = `${header}\n\n# ${exportData?.meta?.title || meta.title}\n著者: ${exportData?.meta?.author || meta.author}\n\n${fullDraftContent}\n\n${footer}`;

    const handleCopy = () => {
        navigator.clipboard.writeText(previewText);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleDownloadFullBackup = async () => {
        if (!exportData) return;
        
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportData, null, 2));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", `DuoScript_${exportData.meta.title}_Rev${exportData.meta.headRev || 0}_${new Date().toISOString().split('T')[0]}.json`);
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
    };

    return (
        <div className="fixed inset-0 bg-stone-950/90 backdrop-blur-xl flex items-center justify-center z-[1000] p-0 md:p-6">
            <div className="bg-stone-900 w-full md:max-w-5xl h-full md:h-[80vh] md:rounded-3xl border-t md:border border-stone-800 shadow-3xl flex flex-col overflow-hidden animate-fade-in">
                {/* Header */}
                <div className="p-4 md:p-6 border-b border-stone-800 flex justify-between items-center bg-stone-900/50 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-orange-600 rounded-lg text-white"><BookOpen size={18}/></div>
                        <div className="min-w-0">
                            <h2 className="text-base md:text-xl font-bold text-white truncate">出力とバックアップ</h2>
                            <p className="hidden md:block text-xs text-stone-500 font-medium mt-0.5">原稿の書き出し、またはプロジェクトデータの保存を行います。</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-stone-800 rounded-full text-stone-500 transition-colors"><X size={24}/></button>
                </div>

                {/* Mobile Sub-tabs */}
                <div className="flex md:hidden border-b border-stone-800 shrink-0 h-12">
                  <button onClick={() => setMobileTab('preview')} className={`flex-1 text-[10px] font-black uppercase tracking-widest transition-all ${mobileTab === 'preview' ? 'text-orange-400 bg-orange-400/5' : 'text-stone-600'}`}>
                    <div className="flex items-center justify-center gap-2"><Eye size={14}/> Preview</div>
                  </button>
                  <button onClick={() => setMobileTab('settings')} className={`flex-1 text-[10px] font-black uppercase tracking-widest transition-all ${mobileTab === 'settings' ? 'text-orange-400 bg-orange-400/5' : 'text-stone-600'}`}>
                    <div className="flex items-center justify-center gap-2"><Settings2 size={14}/> Settings</div>
                  </button>
                </div>
                
                {/* Content Area */}
                <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
                    {isPreparing && (
                      <div className="absolute inset-0 bg-stone-900/60 backdrop-blur-sm z-50 flex flex-col items-center justify-center gap-4">
                        <Loader2 className="animate-spin text-orange-400" size={32} />
                        <span className="text-[10px] font-black uppercase tracking-[0.3em] text-stone-400">スナップショットを編纂中...</span>
                      </div>
                    )}

                    {/* Settings Sidebar */}
                    <div className={`${mobileTab === 'settings' ? 'flex' : 'hidden md:flex'} w-full md:w-80 border-b md:border-b-0 md:border-r border-stone-800 p-6 space-y-6 overflow-y-auto bg-stone-900/20 shrink-0 custom-scrollbar`}>
                        <div className="space-y-5">
                            <h4 className="text-[10px] font-black text-orange-400 uppercase tracking-widest">原稿出力設定</h4>
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-stone-600 uppercase tracking-widest">前書き</label>
                                <textarea value={header} onChange={e => setHeader(e.target.value)} className="w-full bg-stone-950 border border-stone-800 rounded-xl p-4 text-[13px] text-stone-300 h-28 focus:ring-1 focus:ring-orange-500 transition-all resize-none outline-none" placeholder="作品紹介など..."/>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-stone-600 uppercase tracking-widest">後書き</label>
                                <textarea value={footer} onChange={e => setFooter(e.target.value)} className="w-full bg-stone-950 border border-stone-800 rounded-xl p-4 text-[13px] text-stone-300 h-28 focus:ring-1 focus:ring-orange-500 transition-all resize-none outline-none" placeholder="あとがきなど..."/>
                            </div>
                        </div>

                        <div className="h-px bg-white/5" />

                        <div className="space-y-4 pb-20 md:pb-0">
                            <h4 className="text-[10px] font-black text-orange-400 uppercase tracking-widest">データバックアップ</h4>
                            <button onClick={handleDownloadFullBackup} disabled={!exportData} className="w-full py-4 bg-stone-800 hover:bg-orange-600 hover:text-white text-stone-200 rounded-xl flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest transition-all shadow-lg active:scale-95 disabled:opacity-40">
                                <FileJson size={14}/> 完全なバックアップ (.json)
                            </button>
                            {exportData && (
                              <p className="text-[8px] text-stone-600 leading-relaxed font-black uppercase tracking-widest text-center px-4">
                                Revision: {exportData.meta.headRev} の全データをエクスポートします。
                              </p>
                            )}
                        </div>
                    </div>
                    
                    {/* Preview Area */}
                    <div className={`${mobileTab === 'preview' ? 'block' : 'hidden md:block'} flex-1 bg-stone-950 p-4 md:p-8 overflow-y-auto custom-scrollbar`}>
                        <div className="max-w-2xl mx-auto bg-stone-900/40 p-6 md:p-12 rounded-2xl md:rounded-3xl border border-white/5 font-serif text-stone-300 text-[13px] md:text-base leading-loose whitespace-pre-wrap shadow-inner mb-24 md:mb-0">
                            {previewText}
                        </div>
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="fixed md:static bottom-0 inset-x-0 p-4 md:p-6 border-t border-stone-800 bg-stone-900/95 backdrop-blur-xl flex flex-row justify-end gap-3 md:gap-4 shrink-0 z-10 pb-safe">
                     <button onClick={onClose} className="hidden sm:block px-6 py-2 rounded-xl text-stone-500 hover:text-white font-bold text-sm transition-colors">閉じる</button>
                     <button onClick={handleCopy} disabled={isPreparing} className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-orange-600 hover:bg-orange-500 text-white px-8 py-4 md:py-3 rounded-xl font-bold text-sm shadow-xl shadow-orange-900/20 transition-all active:scale-95 disabled:opacity-50">
                         {copied ? <Check size={18}/> : <FileJson size={18}/>}
                         {copied ? "コピー完了" : "原稿をコピー"}
                     </button>
                </div>
            </div>
        </div>
    );
};

export default PublicationModal;
