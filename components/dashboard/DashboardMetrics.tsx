
import React from 'react';
import { Activity, CloudLightning, HardDrive, Sparkles } from 'lucide-react';
import { Card, Styles, Txt } from '../ui/DesignSystem';
import { t } from '../../utils/i18n';
import { AppLanguage } from '../../types';

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  unit: string;
  color: string;
}

const StatCard = React.memo(({ icon, label, value, unit, color }: StatCardProps) => (
  <Card variant="glass" padding="md" className="h-24 md:h-40 flex flex-col justify-between relative overflow-hidden group min-w-0">
    <div className="absolute top-2 right-2 md:top-8 md:right-8 text-white/5 group-hover:text-white/10 transition-colors scale-75 md:scale-100">{icon}</div>
    <Txt variant="labelSm" className="truncate">{label}</Txt>
    <div className="flex items-baseline gap-1">
        <span className={`text-lg md:text-4xl font-display font-black italic ${color}`}>{value}</span>
        <span className={`${Styles.text.labelSm} text-stone-700 font-mono`}>{unit}</span>
    </div>
  </Card>
));

interface DashboardMetricsProps {
  metrics: {
    totalTokens: number;
    cacheEfficiency: number;
    totalAssetSize: number;
    finishedChaptersCount: number;
  };
  lang: AppLanguage;
}

export const DashboardMetrics: React.FC<DashboardMetricsProps> = ({ metrics, lang }) => {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6 px-1">
      <StatCard 
        icon={<Activity size={20}/>} 
        label={t('dashboard.stat_tokens', lang)} 
        value={metrics.totalTokens.toLocaleString()} 
        unit="T" 
        color="text-emerald-400" 
      />
      <StatCard 
        icon={<CloudLightning size={20}/>} 
        label={t('dashboard.stat_cache', lang)} 
        value={metrics.cacheEfficiency.toString()} 
        unit="%" 
        color="text-sky-400" 
      />
      <StatCard 
        icon={<HardDrive size={20}/>} 
        label={t('dashboard.stat_assets', lang)} 
        value={(metrics.totalAssetSize / 1024 / 1024).toFixed(1)} 
        unit="MB" 
        color="text-blue-400" 
      />
      <StatCard 
        icon={<Sparkles size={20}/>} 
        label={t('dashboard.stat_finished', lang)} 
        value={metrics.finishedChaptersCount.toString()} 
        unit="C" 
        color="text-purple-400" 
      />
    </div>
  );
};
