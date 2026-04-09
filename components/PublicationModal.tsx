import React, { useState, useEffect, useMemo } from 'react';
import { useMetadata, useBible, useManuscript, useNeuralSync } from '../contexts/StoryContext';
import {
  X,
  Check,
  BookOpen,
  FileJson,
  Eye,
  Settings2,
  Loader2,
  AlertCircle,
  FolderArchive,
} from 'lucide-react';
import {
  loadFullSnapshot,
  getHeadRev,
  getAllAssetMetadata,
  getPortrait,
} from '../services/storageService';
import { StoryProject } from '../types';
import JSZip from 'jszip';
import { buildWorkspaceBundle, serializeWorkspaceBundle } from '../services/workspace/export';
import { validateProjectBranches } from '../services/validation/branchValidator';

interface Props {
  onClose: () => void;
}

const PublicationModal: React.FC<Props> = ({ onClose }) => {
  const meta = useMetadata();
  const bible = useBible();
  const chapters = useManuscript();
  const sync = useNeuralSync();

  const [header, setHeader] = useState('');
  const [footer, setFooter] = useState('');
  const [copied, setCopied] = useState(false);
  const [mobileTab, setMobileTab] = useState<'settings' | 'preview'>('preview');
  const [isPreparing, setIsPreparing] = useState(true);
  const [exportData, setExportData] = useState<StoryProject | null>(null);
  const [fullDraftContent, setFullDraftContent] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const blockingIssues = useMemo(
    () => validateProjectBranches(chapters, bible).filter((issue) => issue.level === 'error'),
    [chapters, bible],
  );

  const getChapterBodyText = (chapter: any): string => {
    const mode = chapter.authoringMode || 'freeform';
    if (mode === 'structured') {
      return chapter.compiledContent ?? chapter.content ?? '';
    }
    return chapter.draftText ?? chapter.compiledContent ?? chapter.content ?? '';
  };

  useEffect(() => {
    const prepareExport = async () => {
      setIsPreparing(true);
      setErrorMsg(null);
      try {
        let fullProject: StoryProject | null = null;
        const currentHead = await getHeadRev(meta.id);

        // 1. Try loading from IndexedDB (Persistent Snapshot)
        if (currentHead > 0) {
          try {
            fullProject = await loadFullSnapshot(meta.id, currentHead);
          } catch (e) {
            console.warn('Failed to load snapshot from IDB, falling back to memory.', e);
          }
        }

        // 2. Fallback to Memory State if IDB is empty, failed, or initial state (Rev 0)
        if (!fullProject) {
          // Attempt to gather assets from IDB manually for the fallback object
          const assets: Record<string, string> = {};
          try {
            const assetMetas = await getAllAssetMetadata(meta.id);
            // Limit asset fetching to avoid blocking UI too long
            for (const am of assetMetas) {
              const data = await getPortrait(am.id);
              if (data) assets[am.id] = data;
            }
          } catch (e) {
            console.warn('Failed to gather assets for fallback export', e);
          }

          fullProject = {
            meta: { ...meta, headRev: currentHead || 1 },
            bible,
            chapters,
            sync,
            assets,
          };
        }

        if (fullProject) {
          setExportData(fullProject);
          const draft = (fullProject.chapters || [])
            .map((ch: any) => {
              return `### ${ch.title}\n\n${getChapterBodyText(ch)}\n\n***\n`;
            })
            .join('\n');
          setFullDraftContent(draft);
        } else {
          setErrorMsg('データの読み込みに失敗しました。');
        }
      } catch (e: any) {
        console.error('Export preparation failed', e);
        setErrorMsg(`エクスポート準備エラー: ${e.message}`);
      } finally {
        setIsPreparing(false);
      }
    };
    prepareExport();
  }, [meta.id]); // Dependencies usually static during modal lifetime

  const previewText = `${header}\n\n# ${exportData?.meta?.title || meta.title}\n著者: ${exportData?.meta?.author || meta.author}\n\n${fullDraftContent}\n\n${footer}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(previewText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadFullBackup = async () => {
    if (!exportData) return;
    if (blockingIssues.length > 0) {
      setErrorMsg(`分岐検証エラー ${blockingIssues.length} 件のため、公開向けエクスポートは実行できません。`);
      return;
    }

    try {
      const jsonStr = JSON.stringify(exportData, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);

      const downloadAnchorNode = document.createElement('a');
      downloadAnchorNode.href = url;

      // ファイル名のサニタイズ（ファイルシステムで使用できない文字を置換）
      const safeTitle = (exportData.meta?.title || 'Untitled').replace(/[\\/:*?"<>|]/g, '_');
      const dateStr = new Date().toISOString().split('T')[0];
      const rev = exportData.meta?.headRev || 0;

      downloadAnchorNode.download = `DuoScript_${safeTitle}_Rev${rev}_${dateStr}.json`;
      document.body.appendChild(downloadAnchorNode);
      downloadAnchorNode.click();
      downloadAnchorNode.remove();

      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e: any) {
      console.error('Download failed', e);
      setErrorMsg(`ダウンロード開始エラー: ${e.message}`);
    }
  };

  const handleDownloadMarkdownZip = async () => {
    if (!exportData) return;
    if (blockingIssues.length > 0) {
      setErrorMsg(`分岐検証エラー ${blockingIssues.length} 件のため、公開向けエクスポートは実行できません。`);
      return;
    }
    setIsPreparing(true);

    try {
      const zip = new JSZip();
      const safeTitle = (exportData.meta?.title || 'Untitled').replace(/[\\/:*?"<>|]/g, '_');
      const root = zip.folder(safeTitle);

      if (!root) throw new Error('Failed to create root folder');

      // 1. Manuscript
      const manuscriptFolder = root.folder('Manuscript');
      exportData.chapters.forEach((ch, index) => {
        const num = String(index + 1).padStart(2, '0');
        const safeChTitle = ch.title.replace(/[\\/:*?"<>|]/g, '_');
        const mdContent = `# ${ch.title}\n\n${ch.summary ? `> ${ch.summary}\n\n` : ''}${getChapterBodyText(ch)}`;
        manuscriptFolder?.file(`${num}_${safeChTitle}.md`, mdContent);
      });

      // 2. Settings (Bible)
      const settingsFolder = root.folder('Settings');

      // Characters
      const charFolder = settingsFolder?.folder('Characters');
      exportData.bible.characters.forEach((c) => {
        const safeName = c.profile.name.replace(/[\\/:*?"<>|]/g, '_') || 'Unknown';
        let md = `# ${c.profile.name}\n`;
        md += `**Role**: ${c.profile.role}\n\n`;
        if (c.profile.shortSummary) md += `> ${c.profile.shortSummary}\n\n`;
        md += `## Description\n${c.profile.description || ''}\n\n`;
        md += `## Profile\n`;
        if (c.profile.appearance) md += `- **Appearance**: ${c.profile.appearance}\n`;
        if (c.profile.personality) md += `- **Personality**: ${c.profile.personality}\n`;
        if (c.profile.background) md += `- **Background**: ${c.profile.background}\n`;
        if (c.profile.motivation) md += `- **Motivation**: ${c.profile.motivation}\n`;

        if (c.relationships && c.relationships.length > 0) {
          md += `\n## Relationships\n`;
          c.relationships.forEach((r) => {
            const targetName =
              exportData?.bible.characters.find((t) => t.id === r.targetId)?.profile.name ||
              'Unknown';
            md += `- **${targetName}** (${r.type}): ${r.description}\n`;
          });
        }
        charFolder?.file(`${safeName}.md`, md);
      });

      // Locations
      const locFolder = settingsFolder?.folder('Locations');
      exportData.bible.locations.forEach((l) => {
        const safeName = l.name.replace(/[\\/:*?"<>|]/g, '_');
        const md = `# ${l.name}\n**Type**: ${l.type}\n\n${l.description}\n`;
        locFolder?.file(`${safeName}.md`, md);
      });

      // Items
      const itemFolder = settingsFolder?.folder('Items');
      exportData.bible.keyItems.forEach((i) => {
        const safeName = i.name.replace(/[\\/:*?"<>|]/g, '_');
        const md = `# ${i.name}\n**Type**: ${i.type}\n\n${i.description}\n`;
        itemFolder?.file(`${safeName}.md`, md);
      });

      // Encyclopedia (Entries)
      const entryFolder = settingsFolder?.folder('Encyclopedia');
      exportData.bible.entries.forEach((e) => {
        const safeName = e.title.replace(/[\\/:*?"<>|]/g, '_');
        const md = `# ${e.title}\n**Category**: ${e.category}\n\n${e.content || e.definition}\n`;
        entryFolder?.file(`${safeName}.md`, md);
      });

      // General Settings
      let generalMd = `# World Settings\n\n`;
      generalMd += `## Concept\n${exportData.bible.setting}\n\n`;
      generalMd += `## Grand Arc\n${exportData.bible.grandArc}\n\n`;
      generalMd += `## Laws\n`;
      exportData.bible.laws.forEach((l) => {
        generalMd += `### ${l.name} (${l.type})\n${l.description}\n\n`;
      });
      settingsFolder?.file('General.md', generalMd);

      // Generate Zip
      const blob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${safeTitle}_Archive.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e: any) {
      console.error('Zip export failed', e);
      setErrorMsg(`Zip作成エラー: ${e.message}`);
    } finally {
      setIsPreparing(false);
    }
  };

  const handleDownloadWorkspace = async () => {
    if (!exportData) return;
    if (blockingIssues.length > 0) {
      setErrorMsg(`分岐検証エラー ${blockingIssues.length} 件のため、公開向けエクスポートは実行できません。`);
      return;
    }
    try {
      const bundle = buildWorkspaceBundle(exportData);
      const jsonStr = serializeWorkspaceBundle(bundle);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = url;
      a.download = 'workspace_bundle.json';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e: any) {
      console.error('Workspace export failed', e);
      setErrorMsg(`Workspace出力エラー: ${e.message}`);
    }
  };

  return (
    <div className="fixed inset-0 bg-stone-950/90 backdrop-blur-xl flex items-center justify-center z-[1000] p-0 md:p-6">
      <div className="bg-stone-900 w-full md:max-w-5xl h-full md:h-[80vh] md:rounded-3xl border-t md:border border-stone-800 shadow-3xl flex flex-col overflow-hidden animate-fade-in">
        {/* Header */}
        <div className="p-4 md:p-6 border-b border-stone-800 flex justify-between items-center bg-stone-900/50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-600 rounded-lg text-white">
              <BookOpen size={18} />
            </div>
            <div className="min-w-0">
              <h2 className="text-base md:text-xl font-bold text-white truncate">
                出力とバックアップ
              </h2>
              <p className="hidden md:block text-xs text-stone-500 font-medium mt-0.5">
                原稿の書き出し、またはプロジェクトデータの保存を行います。
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-stone-800 rounded-full text-stone-500 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Mobile Sub-tabs */}
        <div className="flex md:hidden border-b border-stone-800 shrink-0 h-12">
          <button
            onClick={() => setMobileTab('preview')}
            className={`flex-1 text-[10px] font-black uppercase tracking-widest transition-all ${mobileTab === 'preview' ? 'text-orange-400 bg-orange-400/5' : 'text-stone-600'}`}
          >
            <div className="flex items-center justify-center gap-2">
              <Eye size={14} /> プレビュー
            </div>
          </button>
          <button
            onClick={() => setMobileTab('settings')}
            className={`flex-1 text-[10px] font-black uppercase tracking-widest transition-all ${mobileTab === 'settings' ? 'text-orange-400 bg-orange-400/5' : 'text-stone-600'}`}
          >
            <div className="flex items-center justify-center gap-2">
              <Settings2 size={14} /> 設定
            </div>
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
          {isPreparing && (
            <div className="absolute inset-0 bg-stone-900/60 backdrop-blur-sm z-50 flex flex-col items-center justify-center gap-4">
              <Loader2 className="animate-spin text-orange-400" size={32} />
              <span className="text-[10px] font-black uppercase tracking-[0.3em] text-stone-400">
                スナップショットを編纂中...
              </span>
            </div>
          )}

          {/* Settings Sidebar */}
          <div
            className={`${mobileTab === 'settings' ? 'flex' : 'hidden md:flex'} w-full md:w-80 border-b md:border-b-0 md:border-r border-stone-800 p-6 space-y-6 overflow-y-auto bg-stone-900/20 shrink-0 custom-scrollbar`}
          >
            <div className="space-y-5">
              <h4 className="text-[10px] font-black text-orange-400 uppercase tracking-widest">
                原稿出力設定
              </h4>
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-stone-600 uppercase tracking-widest">
                  前書き
                </label>
                <textarea
                  value={header}
                  onChange={(e) => setHeader(e.target.value)}
                  className="w-full bg-stone-950 border border-stone-800 rounded-xl p-4 text-[13px] text-stone-300 h-28 focus:ring-1 focus:ring-orange-500 transition-all resize-none outline-none"
                  placeholder="作品紹介など..."
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-stone-600 uppercase tracking-widest">
                  後書き
                </label>
                <textarea
                  value={footer}
                  onChange={(e) => setFooter(e.target.value)}
                  className="w-full bg-stone-950 border border-stone-800 rounded-xl p-4 text-[13px] text-stone-300 h-28 focus:ring-1 focus:ring-orange-500 transition-all resize-none outline-none"
                  placeholder="あとがきなど..."
                />
              </div>
            </div>

            <div className="h-px bg-white/5" />

            <div className="space-y-4 pb-20 md:pb-0">
              <h4 className="text-[10px] font-black text-orange-400 uppercase tracking-widest">
                データバックアップ
              </h4>

              {errorMsg && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl flex gap-2 items-start">
                  <AlertCircle size={14} className="text-rose-500 mt-0.5 shrink-0" />
                  <p className="text-[10px] text-rose-300 font-serif leading-relaxed">{errorMsg}</p>
                </div>
              )}
              {blockingIssues.length > 0 && (
                <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl flex gap-2 items-start">
                  <AlertCircle size={14} className="text-amber-400 mt-0.5 shrink-0" />
                  <p className="text-[10px] text-amber-200 font-serif leading-relaxed">
                    現在、分岐検証の blocking error が {blockingIssues.length} 件あります。作業中の保存は可能ですが、公開/出力系はブロックされます。
                  </p>
                </div>
              )}

              <div className="grid grid-cols-1 gap-2">
                <button
                  onClick={handleDownloadMarkdownZip}
                  disabled={!exportData || isPreparing || blockingIssues.length > 0}
                  className="w-full py-4 bg-stone-800 hover:bg-stone-700 text-stone-200 rounded-xl flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest transition-all shadow-lg active:scale-95 disabled:opacity-40"
                >
                  <FolderArchive size={14} /> Markdown一括書出し (.zip)
                </button>
                <button
                  onClick={handleDownloadWorkspace}
                  disabled={!exportData || isPreparing || blockingIssues.length > 0}
                  className="w-full py-4 bg-stone-800 hover:bg-stone-700 text-stone-200 rounded-xl flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest transition-all shadow-lg active:scale-95 disabled:opacity-40"
                >
                  <FileJson size={14} /> Export for Codex (workspace_bundle.json)
                </button>
                <button
                  onClick={handleDownloadFullBackup}
                  disabled={!exportData || isPreparing || blockingIssues.length > 0}
                  className="w-full py-4 bg-stone-800 hover:bg-stone-700 text-stone-200 rounded-xl flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest transition-all shadow-lg active:scale-95 disabled:opacity-40"
                >
                  <FileJson size={14} /> 完全なバックアップ (.json)
                </button>
              </div>

              {exportData ? (
                <p className="text-[8px] text-stone-600 leading-relaxed font-black uppercase tracking-widest text-center px-4">
                  Revision: {exportData.meta.headRev} のデータを出力します。
                </p>
              ) : (
                !isPreparing && (
                  <p className="text-[8px] text-stone-600 leading-relaxed font-black uppercase tracking-widest text-center px-4">
                    エクスポート可能なデータがありません。
                  </p>
                )
              )}
            </div>
          </div>

          {/* Preview Area */}
          <div
            className={`${mobileTab === 'preview' ? 'block' : 'hidden md:block'} flex-1 bg-stone-950 p-4 md:p-8 overflow-y-auto custom-scrollbar`}
          >
            <div className="max-w-2xl mx-auto bg-stone-900/40 p-6 md:p-12 rounded-2xl md:rounded-3xl border border-white/5 font-serif text-stone-300 text-[13px] md:text-base leading-loose whitespace-pre-wrap shadow-inner mb-24 md:mb-0">
              {previewText}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="fixed md:static bottom-0 inset-x-0 p-4 md:p-6 border-t border-stone-800 bg-stone-900/95 backdrop-blur-xl flex flex-row justify-end gap-3 md:gap-4 shrink-0 z-10 pb-safe">
          <button
            onClick={onClose}
            className="hidden sm:block px-6 py-2 rounded-xl text-stone-500 hover:text-white font-bold text-sm transition-colors"
          >
            閉じる
          </button>
          <button
            onClick={handleCopy}
            disabled={isPreparing}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-orange-600 hover:bg-orange-500 text-white px-8 py-4 md:py-3 rounded-xl font-bold text-sm shadow-xl shadow-orange-900/20 transition-all active:scale-95 disabled:opacity-50"
          >
            {copied ? <Check size={18} /> : <FileJson size={18} />}
            {copied ? 'コピー完了' : '原稿をコピー'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PublicationModal;
