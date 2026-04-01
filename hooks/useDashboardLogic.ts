import { useState, useMemo, useEffect } from 'react';
import {
  useMetadata,
  useMetadataDispatch,
  useBibleDispatch,
  useManuscript,
  useNotificationDispatch,
  useNotifications,
  useUIDispatch,
  useProjectDispatchContext,
  useCharacters,
  useWorldFoundation,
  usePlotPlan,
  useKnowledge,
  useBible,
} from '../contexts/StoryContext';
import * as Actions from '../store/actions';
import { analyzeBibleIntegrity, maintainSummaryBuffer } from '../services/geminiService';
import {
  getAllAssetMetadata,
  deletePortrait,
  getRevisionHistory,
  loadFullSnapshot,
} from '../services/storageService';
import { normalizeProject } from '../services/bibleManager';
import { AssetMetadata, BibleIssue, ViewMode } from '../types';
import { translateSafetyCategory } from '../services/gemini/utils';
import { t } from '../utils/i18n';
import { validateChapterScenePackages, validateProjectBranches } from '../services/scenePackage';

export const useDashboardLogic = () => {
  const meta = useMetadata();
  const {
    id: projectId,
    tokenUsage,
    preferences,
    violationCount,
    violationHistory,
    headRev,
  } = meta;
  const lang = preferences.uiLanguage;

  const metaDispatch = useMetadataDispatch();
  const bibleDispatch = useBibleDispatch();
  const projectDispatch = useProjectDispatchContext(); // Access root dispatcher
  const uiDispatch = useUIDispatch();
  const { logs } = useNotifications();
  const { addLog, dispatch: notifDispatch } = useNotificationDispatch();

  const chapters = useManuscript();
  const characters = useCharacters();
  const foundation = useWorldFoundation();
  const knowledge = useKnowledge();
  const bible = useBible();

  const [isScanning, setIsScanning] = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [assets, setAssets] = useState<AssetMetadata[]>([]);
  const [usageViewMode, setUsageViewMode] = useState<'source' | 'model' | 'architect'>('source');

  // History State
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<{ rev: number; timestamp: number; wordCount: number }[]>(
    [],
  );
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // --- Metrics Calculation ---

  const totalTokens = useMemo(() => {
    return (tokenUsage || []).reduce(
      (acc, entry) => acc + (Number(entry.input) || 0) + (Number(entry.output) || 0),
      0,
    );
  }, [tokenUsage]);

  const totalInputTokens = useMemo(() => {
    return (tokenUsage || []).reduce((acc, entry) => acc + (Number(entry.input) || 0), 0);
  }, [tokenUsage]);

  const totalCachedTokens = useMemo(() => {
    return (tokenUsage || []).reduce((acc, entry) => acc + (Number(entry.cached) || 0), 0);
  }, [tokenUsage]);

  const cacheEfficiency = useMemo(() => {
    if (totalInputTokens === 0) return 0;
    return Math.round((totalCachedTokens / totalInputTokens) * 100);
  }, [totalInputTokens, totalCachedTokens]);

  const totalAssetSize = useMemo(() => {
    return assets.reduce((acc, a) => acc + (a.size || 0), 0);
  }, [assets]);

  const finishedChaptersCount = useMemo(
    () => chapters.filter((c) => c.status === 'Polished').length,
    [chapters],
  );

  // --- Chart Data Preparation ---

  const translateSourceLabel = (src: string) => {
    if (src === 'Analysis/MuseBibleGen') return 'AI Muse (World)';
    if (src === 'Analysis/MuseChapterGen') return 'AI Muse (Plot)';
    if (src === 'Analysis/IntegrityLinter') return 'Integrity Scan';
    if (src === 'Analysis/NexusSimulation') return 'Nexus Sim';
    if (src.includes('Architect/Chat')) return 'Architect Chat';
    if (src.includes('Writer/Drafting')) return 'Writer Drafting';
    if (src === 'Visual/PortraitImageGen') return 'Portrait Gen';
    if (src === 'Visual/TTSSpeechGen') return 'Voice Gen';
    return src;
  };

  const usageBySource = useMemo(() => {
    const raw = (tokenUsage || []).reduce(
      (acc, entry) => {
        const rawSrc = entry.source || 'Unknown';
        const label = translateSourceLabel(rawSrc);

        if (!acc[label]) acc[label] = { label: label, input: 0, cached: 0, output: 0, total: 0 };

        const totalInput = Number(entry.input) || 0;
        const cached = Number(entry.cached) || 0;
        const netInput = Math.max(0, totalInput - cached);
        const output = Number(entry.output) || 0;

        acc[label].input += netInput;
        acc[label].cached += cached;
        acc[label].output += output;
        acc[label].total += totalInput + output;
        return acc;
      },
      {} as Record<
        string,
        { label: string; input: number; cached: number; output: number; total: number }
      >,
    );

    return (
      Object.values(raw) as Array<{
        label: string;
        input: number;
        cached: number;
        output: number;
        total: number;
      }>
    ).sort((a, b) => b.total - a.total);
  }, [tokenUsage]);

  const usageByModel = useMemo(() => {
    const raw = (tokenUsage || []).reduce(
      (acc, entry) => {
        let modelLabel = entry.model || 'Unknown';
        if (modelLabel.includes('pro')) modelLabel = 'Gemini Pro';
        else if (modelLabel.includes('flash') && !modelLabel.includes('image'))
          modelLabel = 'Gemini Flash';
        else if (modelLabel.includes('image')) modelLabel = 'Image Gen';
        else if (modelLabel.includes('tts')) modelLabel = 'Voice (TTS)';

        if (!acc[modelLabel])
          acc[modelLabel] = { label: modelLabel, input: 0, cached: 0, output: 0, total: 0 };

        const totalInput = Number(entry.input) || 0;
        const cached = Number(entry.cached) || 0;
        const netInput = Math.max(0, totalInput - cached);
        const output = Number(entry.output) || 0;

        acc[modelLabel].input += netInput;
        acc[modelLabel].cached += cached;
        acc[modelLabel].output += output;
        acc[modelLabel].total += totalInput + output;
        return acc;
      },
      {} as Record<
        string,
        { label: string; input: number; cached: number; output: number; total: number }
      >,
    );

    return (
      Object.values(raw) as Array<{
        label: string;
        input: number;
        cached: number;
        output: number;
        total: number;
      }>
    ).sort((a, b) => b.total - a.total);
  }, [tokenUsage]);

  const architectUsageBreakdown = useMemo(() => {
    const raw = (tokenUsage || [])
      .filter((entry) => entry.source.startsWith('Architect/'))
      .reduce(
        (acc, entry) => {
          let label = entry.source.replace('Architect/', '');
          if (label.startsWith('Extraction:')) label = 'Extraction';
          else if (label.includes('Chat')) label = 'Chat & Reason';
          else if (label.includes('Memory')) label = 'Memory';
          else if (label.includes('Intent')) label = 'Intent';
          else if (label.includes('Whisper')) label = 'Whisper';

          if (!acc[label]) acc[label] = { label: label, input: 0, cached: 0, output: 0, total: 0 };

          const totalInput = Number(entry.input) || 0;
          const cached = Number(entry.cached) || 0;
          const netInput = Math.max(0, totalInput - cached);
          const output = Number(entry.output) || 0;

          acc[label].input += netInput;
          acc[label].cached += cached;
          acc[label].output += output;
          acc[label].total += totalInput + output;
          return acc;
        },
        {} as Record<
          string,
          { label: string; input: number; cached: number; output: number; total: number }
        >,
      );

    return (
      Object.values(raw) as Array<{
        label: string;
        input: number;
        cached: number;
        output: number;
        total: number;
      }>
    ).sort((a, b) => b.total - a.total);
  }, [tokenUsage]);

  const activeUsageData =
    usageViewMode === 'source'
      ? usageBySource
      : usageViewMode === 'model'
        ? usageByModel
        : architectUsageBreakdown;

  const progressData = useMemo(() => {
    return chapters.map((ch, i) => ({
      name: `Ch.${i + 1}`,
      wordCount: ch.wordCount || 0,
      status: ch.status,
    }));
  }, [chapters]);

  const roleDistribution = useMemo(() => {
    const counts = (characters || []).reduce(
      (acc, char) => {
        acc[char.profile.role] = (acc[char.profile.role] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [characters]);

  const branchIssues = useMemo(() => validateProjectBranches(chapters, bible), [chapters, bible]);
  const chapterRuleIssues = useMemo(
    () => chapters.flatMap((chapter) => validateChapterScenePackages(chapter, bible)),
    [chapters, bible],
  );

  // --- Actions ---

  useEffect(() => {
    const fetchAssets = async () => {
      try {
        const meta = await getAllAssetMetadata(projectId);
        setAssets(meta);
      } catch (e) {
        console.error('Failed to load asset metadata', e);
      }
    };
    fetchAssets();
  }, [projectId]);

  useEffect(() => {
    if (showHistory) {
      setIsLoadingHistory(true);
      getRevisionHistory(projectId)
        .then(setHistory)
        .catch((e) => console.error('History fetch failed', e))
        .finally(() => setIsLoadingHistory(false));
    }
  }, [showHistory, projectId]);

  const handleDeleteAsset = async (assetId: string) => {
    uiDispatch(
      Actions.openDialog({
        isOpen: true,
        type: 'confirm',
        title: t('common.delete', lang),
        message: 'Are you sure you want to delete this asset?',
        onConfirm: async () => {
          await deletePortrait(assetId);
          setAssets((prev) => prev.filter((a) => a.id !== assetId));
          addLog('info', 'Artist', 'Asset deleted.');
          uiDispatch(Actions.closeDialog());
        },
      }),
    );
  };

  const handleRestoreRevision = (rev: number) => {
    uiDispatch(
      Actions.openDialog({
        isOpen: true,
        type: 'confirm',
        title: t('history.confirm_title', lang),
        message: t('history.confirm_msg', lang),
        onConfirm: async () => {
          uiDispatch(Actions.closeDialog());
          setShowHistory(false);
          try {
            const snapshot = await loadFullSnapshot(projectId, rev);
            if (snapshot) {
              const normalized = normalizeProject(snapshot);
              if (projectDispatch) {
                projectDispatch(Actions.loadProject(normalized));
                addLog('success', 'System', `Revision ${rev} loaded.`);
              }
            }
          } catch (e) {
            addLog('error', 'System', 'Restore failed.');
          }
        },
      }),
    );
  };

  const handleIntegrityScan = async () => {
    if (isScanning) return;
    setIsScanning(true);
    addLog('info', 'Architect', 'Scanning story integrity...');
    try {
      const issues = await analyzeBibleIntegrity(
        { meta, bible, chapters, sync: { history: [] } } as any,
        (usage: any) => metaDispatch(Actions.trackUsage(usage)),
        addLog,
      );
      bibleDispatch(Actions.updateBible({ integrityIssues: issues }));
      if (issues.length === 0) addLog('success', 'Architect', 'No issues found.');
      else addLog('error', 'Architect', `${issues.length} potential issues found.`);
    } catch (e: any) {
      addLog('error', 'Architect', 'Scan failed.', e.message);
    } finally {
      setIsScanning(false);
    }
  };

  const handleMaintainSummary = async () => {
    if (isSummarizing) return;
    setIsSummarizing(true);
    addLog('info', 'Architect', 'Organizing memory buffer...');
    try {
      const newSummary = await maintainSummaryBuffer(
        { bible } as any,
        (usage: any) => metaDispatch(Actions.trackUsage(usage)),
        addLog,
      );
      bibleDispatch(
        Actions.updateBible({ summaryBuffer: newSummary, lastSummaryUpdate: Date.now() }),
      );
      addLog('success', 'Architect', 'Memory consolidated.');
    } catch (e: any) {
      addLog('error', 'Architect', 'Summarization failed.');
    } finally {
      setIsSummarizing(false);
    }
  };

  const handleClearLogs = () => notifDispatch(Actions.clearLogs());

  return {
    metrics: {
      totalTokens,
      cacheEfficiency,
      totalAssetSize,
      finishedChaptersCount,
      violationCount,
      totalWordCount: chapters.reduce((a, c) => a + (c.wordCount || 0), 0),
    },
    data: {
      activeUsageData,
      progressData,
      roleDistribution,
      violationHistory,
      assets,
      logs,
      summaryBuffer: foundation?.summaryBuffer,
      history,
      headRev,
      branchIssues,
      chapterRuleIssues,
    },
    ui: {
      isScanning,
      isSummarizing,
      usageViewMode,
      lang,
      showHistory,
      isLoadingHistory,
    },
    actions: {
      setUsageViewMode,
      setShowHistory,
      handleDeleteAsset,
      handleRestoreRevision,
      handleIntegrityScan,
      handleMaintainSummary,
      handleClearLogs,
    },
  };
};
