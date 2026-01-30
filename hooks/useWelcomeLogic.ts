import React, { useState, useEffect, useCallback } from 'react';
import { StoryProject, AppLanguage, TokenUsageEntry } from '../types';
import { normalizeProject } from '../services/bibleManager';
import { getAllProjects, saveProjectRevision } from '../services/storageService';
import { generateRandomProject } from '../services/geminiService';
import { useMetadataDispatch, useNotificationDispatch } from '../contexts/StoryContext';
import * as Actions from '../store/actions';

interface UseWelcomeLogicProps {
  onStart: (projectData: StoryProject) => void;
  showAlert: (title: string, message: string) => void;
}

export const useWelcomeLogic = ({ onStart, showAlert }: UseWelcomeLogicProps) => {
  // State
  const [lang, setLang] = useState<AppLanguage>('ja');
  const [projects, setProjects] = useState<StoryProject[]>([]);
  const [isLoadingProjects, setIsLoadingProjects] = useState(true);

  // Manual Creation State
  const [title, setTitle] = useState('');
  const [idea, setIdea] = useState('');

  // AI Creation State
  const [autoTheme, setAutoTheme] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [progressMsg, setProgressMsg] = useState('');

  const metaDispatch = useMetadataDispatch();
  const { addLog } = useNotificationDispatch();

  // Initialization
  useEffect(() => {
    // Load preferred language
    const prefs = localStorage.getItem('duoscript_prefs');
    if (prefs) {
      try {
        const p = JSON.parse(prefs);
        if (p.uiLanguage) setLang(p.uiLanguage);
      } catch (e) {}
    }

    // Load projects
    const fetchProjects = async () => {
      try {
        const stored = await getAllProjects();
        if (stored && stored.length > 0) {
          setProjects(stored.map((p) => normalizeProject(p)));
        }
      } catch (e) {
        console.error('Failed to fetch project list', e);
      } finally {
        setIsLoadingProjects(false);
      }
    };
    fetchProjects();
  }, []);

  // Handlers
  const handleLangSwitch = useCallback(() => {
    const nextLang = lang === 'ja' ? 'en' : 'ja';
    setLang(nextLang);
    const prefs = localStorage.getItem('duoscript_prefs') || '{}';
    const parsed = JSON.parse(prefs);
    localStorage.setItem('duoscript_prefs', JSON.stringify({ ...parsed, uiLanguage: nextLang }));
  }, [lang]);

  const handleLaunchManual = useCallback(async () => {
    const initialProject: StoryProject = normalizeProject({
      title: title || (lang === 'ja' ? '名もなき物語' : 'Untitled Story'),
      bible: {
        setting: idea || (lang === 'ja' ? '物語の最初の一歩。' : 'First step of the story.'),
      },
      chapters: [{ title: lang === 'ja' ? '序章' : 'Prologue', summary: idea || '...' }],
      meta: { language: lang },
    });
    initialProject.meta.preferences.uiLanguage = lang;

    try {
      const rev = await saveProjectRevision(initialProject);
      initialProject.meta.headRev = rev;

      // アクティブIDを即座に保存
      localStorage.setItem('duoscript_active_id', initialProject.meta.id);

      onStart(initialProject);
    } catch (e) {
      console.error('Failed to save initial project', e);
      showAlert('Error', 'Failed to initialize project database.');
    }
  }, [title, idea, lang, onStart, showAlert]);

  const handleLaunchAuto = useCallback(async () => {
    if (!autoTheme.trim()) return;
    setIsProcessing(true);
    setProgressMsg(lang === 'ja' ? '世界を構築中...' : 'Constructing world...');

    const usageLog: TokenUsageEntry[] = [];

    try {
      const generated = await generateRandomProject(
        autoTheme,
        (u) => {
          usageLog.push({ id: crypto.randomUUID(), timestamp: Date.now(), ...u });
          metaDispatch(Actions.trackUsage(u));
        },
        (type, source, msg, detail) => {
          addLog(type as any, source as any, msg, detail);
          if (
            msg.includes('Step') ||
            msg.includes('構築') ||
            msg.includes('生成') ||
            msg.includes('Generating')
          ) {
            setProgressMsg(msg);
          }
        },
      );

      const p = normalizeProject(generated);
      p.meta.language = lang;
      p.meta.preferences.uiLanguage = lang;
      p.meta.tokenUsage = [...usageLog, ...(p.meta.tokenUsage || [])];

      try {
        const rev = await saveProjectRevision(p);
        p.meta.headRev = rev;

        // アクティブIDを即座に保存
        localStorage.setItem('duoscript_active_id', p.meta.id);

        onStart(p);
      } catch (saveErr) {
        console.error('Failed to save generated project', saveErr);
        showAlert('Error', 'Failed to save generated project.');
      }
    } catch (e: any) {
      console.error(e);
      let errorMsg = 'Failed to inspire. Please try again.';
      const rawError = e.message || JSON.stringify(e);

      if (
        rawError.includes('403') ||
        rawError.includes('permission') ||
        rawError.includes('PERMISSION_DENIED')
      ) {
        errorMsg =
          lang === 'ja'
            ? 'API権限エラー: APIキーが正しいか、Google CloudプロジェクトでGenerative AI APIが有効か確認してください。(403 Forbidden)'
            : 'Permission Denied: Please check your API Key and ensure the Google Generative AI API is enabled in your cloud project. (403 Forbidden)';
      }

      showAlert(lang === 'ja' ? '生成エラー' : 'Generation Error', errorMsg);
      addLog('error', 'System', `Muse Error: ${e.message}`);
    } finally {
      setIsProcessing(false);
      setProgressMsg('');
    }
  }, [autoTheme, lang, metaDispatch, addLog, onStart, showAlert]);

  const handleFileUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const json = JSON.parse(event.target?.result as string);
          if (json && (json.title || json.bible || json.chapters || json.meta)) {
            const p = normalizeProject(json);
            p.meta.preferences.uiLanguage = lang;

            try {
              // Force save to persist data and restore assets to IndexedDB immediately
              const rev = await saveProjectRevision(p);
              p.meta.headRev = rev;

              // 重要: インポートしたプロジェクトIDを即座にlocalStorageに保存し、リロード後も参照できるようにする
              localStorage.setItem('duoscript_active_id', p.meta.id);

              onStart(p);
            } catch (saveErr) {
              console.error('Import save failed', saveErr);
              showAlert('Import Error', 'Failed to save imported data to local database.');
            }
          } else {
            showAlert('Load Failed', 'Invalid Project File');
          }
        } catch (err) {
          showAlert('Error', 'Failed to parse file.');
        }
      };
      reader.readAsText(file);
    },
    [lang, onStart, showAlert],
  );

  return {
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
    handleFileUpload,
  };
};
