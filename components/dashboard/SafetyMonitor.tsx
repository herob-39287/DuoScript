import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { Card, SectionHeader, Badge, Styles } from '../ui/DesignSystem';
import { t } from '../../utils/i18n';
import { translateSafetyCategory } from '../../services/gemini/utils';
import { AppLanguage, SafetyViolation } from '../../types';

interface SafetyMonitorProps {
  violationCount: number;
  violationHistory: SafetyViolation[];
  lang: AppLanguage;
}

export const SafetyMonitor: React.FC<SafetyMonitorProps> = ({
  violationCount,
  violationHistory,
  lang,
}) => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      <Card
        variant="glass"
        padding="lg"
        className="lg:col-span-4 space-y-6 mx-1 border border-amber-500/10 min-w-0"
      >
        <SectionHeader
          icon={<AlertTriangle size={20} className="text-amber-500" />}
          title={t('dashboard.safety_status', lang)}
        />
        <div className="flex items-center justify-center py-2 md:py-4">
          <div
            className={`relative w-20 h-20 md:w-24 md:h-24 rounded-full border-4 flex items-center justify-center ${violationCount >= 4 ? 'border-rose-500 bg-rose-500/10' : violationCount > 0 ? 'border-amber-500 bg-amber-500/10' : 'border-emerald-500 bg-emerald-500/10'}`}
          >
            <div className="text-center">
              <div className="text-xl md:text-2xl font-black italic">{violationCount}</div>
              <div className="text-[8px] font-black uppercase">Violations</div>
            </div>
          </div>
        </div>
        <p className={Styles.text.body}>
          {violationCount > 0 ? 'Safety policy triggered.' : 'All green.'}
        </p>
      </Card>

      <Card
        variant="glass"
        padding="lg"
        className="lg:col-span-8 space-y-4 mx-1 overflow-hidden h-auto lg:h-[300px] flex flex-col min-w-0"
      >
        <div className={Styles.text.label}>{t('dashboard.safety_log', lang)}</div>
        <div className="flex-1 overflow-y-auto no-scrollbar space-y-3">
          {violationHistory && violationHistory.length > 0 ? (
            violationHistory.map((v, i) => (
              <div
                key={i}
                className="p-3 md:p-4 bg-stone-950/40 rounded-2xl border border-white/5 flex items-center justify-between gap-4"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge color="amber">{translateSafetyCategory(v.category)}</Badge>
                    <span className={Styles.text.mono}>
                      {new Date(v.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <p className="text-[10px] text-stone-500 italic truncate">
                    "{v.inputSnippet}..."
                  </p>
                </div>
              </div>
            ))
          ) : (
            <div className="h-full flex items-center justify-center text-stone-700 italic font-serif text-xs py-8">
              No violations recorded.
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};
