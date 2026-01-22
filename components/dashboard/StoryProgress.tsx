
import React from 'react';
import { ResponsiveContainer, AreaChart, Area, PieChart, Pie, Cell, Tooltip, CartesianGrid, XAxis, YAxis } from 'recharts';
import { BarChart3, Activity } from 'lucide-react';
import { Card, SectionHeader } from '../ui/DesignSystem';
import { t } from '../../utils/i18n';
import { AppLanguage } from '../../types';

interface StoryProgressProps {
  progressData: any[];
  roleDistribution: any[];
  totalWordCount: number;
  lang: AppLanguage;
}

const COLORS = ['#d68a6d', '#6366f1', '#10b981', '#f59e0b', '#ef4444'];

export const StoryProgress: React.FC<StoryProgressProps> = ({ progressData, roleDistribution, totalWordCount, lang }) => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 px-1">
      <Card variant="glass" padding="lg" className="lg:col-span-2 space-y-6 h-[300px] md:h-[400px] flex flex-col min-w-0">
        <div className="flex items-center justify-between">
          <SectionHeader icon={<BarChart3 size={16} className="text-orange-400" />} title={t('dashboard.progress', lang)} />
          <span className="text-[10px] font-mono text-stone-700">{totalWordCount.toLocaleString()} c</span>
        </div>
        <div className="flex-1 w-full min-h-0 relative">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={progressData}>
              <defs>
                <linearGradient id="colorWords" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#d68a6d" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#d68a6d" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
              <XAxis dataKey="name" stroke="#57534e" fontSize={10} tickLine={false} axisLine={false} />
              <YAxis stroke="#57534e" fontSize={10} tickLine={false} axisLine={false} hide={window.innerWidth < 768} />
              <Tooltip contentStyle={{ backgroundColor: '#1c1917', border: '1px solid #ffffff10', borderRadius: '12px' }} itemStyle={{ color: '#d68a6d', fontSize: '12px' }} />
              <Area type="monotone" dataKey="wordCount" stroke="#d68a6d" strokeWidth={2} fillOpacity={1} fill="url(#colorWords)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card variant="glass" padding="lg" className="space-y-6 h-[300px] md:h-[400px] flex flex-col min-w-0">
        <SectionHeader icon={<Activity size={16} className="text-indigo-400" />} title={t('dashboard.roles', lang)} />
        <div className="flex-1 w-full flex items-center justify-center min-h-0 relative">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={roleDistribution} cx="50%" cy="50%" innerRadius={50} outerRadius={70} paddingAngle={5} dataKey="value">
                {roleDistribution.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ backgroundColor: '#1c1917', border: '1px solid #ffffff10', borderRadius: '12px' }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="grid grid-cols-2 gap-2 overflow-y-auto no-scrollbar">
          {roleDistribution.slice(0, 4).map((r, i) => (
            <div key={r.name} className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
              <span className="text-[10px] font-black text-stone-500 uppercase truncate">{r.name}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};
