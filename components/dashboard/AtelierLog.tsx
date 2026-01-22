
import React, { useMemo, useState } from 'react';
import { Terminal, Trash2, BrainCircuit } from 'lucide-react';
import { Card, SectionHeader, Txt, Styles } from '../ui/DesignSystem';
import { SystemLog, AppLanguage } from '../../types';
import { t } from '../../utils/i18n';

interface AtelierLogProps {
  logs: SystemLog[];
  summaryBuffer: string;
  onClearLogs: () => void;
  lang: AppLanguage;
}

const LogItem = React.memo(({ log }: { log: SystemLog }) => (
  <Card variant="glass-bright" padding="sm" className={`border-l-2 animate-fade-in ${log.type === 'error' ? 'border-l-rose-500' : log.type === 'success' ? 'border-l-emerald-500' : 'border-l-orange-400/50'}`}>
      <div className="flex gap-3 items-start">
         <div className="px-1.5 py-0.5 rounded-[4px] text-[8px] font-black uppercase bg-stone-800 text-stone-500 shrink-0">{log.source}</div>
         <p className={Styles.text.bodySm}>{log.message}</p>
      </div>
  </Card>
));

export const AtelierLog: React.FC<AtelierLogProps> = ({ logs, summaryBuffer, onClearLogs, lang }) => {
  const [logLimit] = useState(30);
  const visibleLogs = useMemo(() => logs.slice(0, logLimit), [logs, logLimit]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-10 px-1">
        <Card variant="glass" padding="lg" className="lg:col-span-8 flex flex-col h-[400px] md:h-[600px] shadow-2xl relative min-w-0">
            <SectionHeader 
              icon={<Terminal size={18} className="text-orange-400" />} 
              title={t('dashboard.atelier_log', lang)} 
              className="mb-6 shrink-0"
              action={<button onClick={onClearLogs} className="p-2 hover:bg-stone-800 rounded-lg text-stone-700 hover:text-rose-400 transition-colors"><Trash2 size={16} /></button>}
            />
            
            <div className="flex-1 overflow-y-auto space-y-3 no-scrollbar pb-6">
                {visibleLogs.map(log => <LogItem key={log.id} log={log} />)}
            </div>
        </Card>

        <Card variant="glass" padding="lg" className="lg:col-span-4 flex flex-col justify-between h-auto md:h-full min-h-[200px] relative overflow-hidden shadow-2xl min-w-0">
            <BrainCircuit size={100} className="absolute -bottom-4 -right-4 text-white/[0.02] rotate-12" />
            <div className="space-y-4">
              <Txt variant="label">{t('dashboard.summary_buffer', lang)}</Txt>
              <p className={`${Styles.text.body} line-clamp-6 md:line-clamp-none italic`}>
                {summaryBuffer || "..."}
              </p>
            </div>
        </Card>
    </div>
  );
};
