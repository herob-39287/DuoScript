import React from 'react';
import { BrainCircuit, ShieldCheck, Home, History } from 'lucide-react';
import { Button, Styles, Txt } from './ui/DesignSystem';
import { t } from '../utils/i18n';
import { useDashboardLogic } from '../hooks/useDashboardLogic';

// Sub-components
import { DashboardMetrics } from './dashboard/DashboardMetrics';
import { ResourceAnalysis } from './dashboard/ResourceAnalysis';
import { StoryProgress } from './dashboard/StoryProgress';
import { SafetyMonitor } from './dashboard/SafetyMonitor';
import { AssetLibrary } from './dashboard/AssetLibrary';
import { AtelierLog } from './dashboard/AtelierLog';
import { HistoryModal } from './HistoryModal';

interface Props {
  onOpenPublication: () => void;
  onExit: () => void;
}

const DashboardView: React.FC<Props> = ({ onOpenPublication, onExit }) => {
  const { metrics, data, ui, actions } = useDashboardLogic();

  return (
    <div className="p-4 md:p-12 h-full overflow-y-auto custom-scrollbar bg-stone-900/20 pb-32 md:pb-12 pt-safe">
      <div className="max-w-[1400px] mx-auto space-y-6 md:space-y-10">
        {/* Header Section */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 animate-fade-in px-2">
          <div className="space-y-1 md:space-y-4 w-full md:w-auto">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-6 md:w-8 h-[1px] bg-orange-400/30"></div>
                <Txt variant="label" className="text-orange-400">
                  Story Vitality
                </Txt>
              </div>
              <button
                onClick={onExit}
                className={`md:hidden flex items-center gap-2 px-3 py-1.5 bg-stone-800/50 rounded-full border border-white/5 ${Styles.text.label} hover:bg-stone-800 hover:text-white transition-colors`}
              >
                <Home size={12} /> {t('dashboard.exit', ui.lang)}
              </button>
            </div>
            <h2 className={Styles.text.title}>{t('dashboard.title', ui.lang)}</h2>
          </div>
          <div className="flex gap-3 w-full md:w-auto overflow-x-auto no-scrollbar">
            <Button
              variant="secondary"
              onClick={actions.handleMaintainSummary}
              isLoading={ui.isSummarizing}
              icon={<BrainCircuit size={14} className="text-orange-400" />}
              className="flex-1 md:flex-none"
            >
              {t('dashboard.memory_maintenance', ui.lang)}
            </Button>
            <Button
              variant="secondary"
              onClick={() => actions.setShowHistory(true)}
              icon={<History size={14} className="text-stone-400" />}
              className="flex-1 md:flex-none"
            >
              {t('dashboard.history', ui.lang)}
            </Button>
            <Button
              variant="primary"
              onClick={actions.handleIntegrityScan}
              isLoading={ui.isScanning}
              icon={<ShieldCheck size={14} />}
              className="flex-1 md:flex-none px-4 md:px-8"
            >
              {t('dashboard.integrity_scan', ui.lang)}
            </Button>
          </div>
        </header>

        {/* Key Metrics */}
        <DashboardMetrics metrics={metrics} lang={ui.lang} />

        {/* Resource Analysis */}
        <ResourceAnalysis
          data={data.activeUsageData}
          viewMode={ui.usageViewMode}
          onViewModeChange={actions.setUsageViewMode}
          lang={ui.lang}
        />

        {/* Progress & Roles */}
        <StoryProgress
          progressData={data.progressData}
          roleDistribution={data.roleDistribution}
          totalWordCount={metrics.totalWordCount}
          lang={ui.lang}
        />

        {/* Safety */}
        <SafetyMonitor
          violationCount={metrics.violationCount}
          violationHistory={data.violationHistory}
          lang={ui.lang}
        />

        {/* Asset Library */}
        <AssetLibrary
          assets={data.assets}
          onDeleteAsset={actions.handleDeleteAsset}
          lang={ui.lang}
        />

        {/* Logs */}
        <AtelierLog
          logs={data.logs}
          summaryBuffer={data.summaryBuffer}
          onClearLogs={actions.handleClearLogs}
          lang={ui.lang}
        />
      </div>

      <HistoryModal
        isOpen={ui.showHistory}
        history={data.history}
        currentRev={data.headRev}
        isLoading={ui.isLoadingHistory}
        onClose={() => actions.setShowHistory(false)}
        onRestore={actions.handleRestoreRevision}
        lang={ui.lang}
      />
    </div>
  );
};

export default React.memo(DashboardView);
