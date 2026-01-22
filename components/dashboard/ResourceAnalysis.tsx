
import React from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { Database, Cpu, BrainCircuit, ArrowDownLeft, CloudLightning, ArrowUpRight } from 'lucide-react';
import { Card, SectionHeader, Button, Txt, Styles } from '../ui/DesignSystem';
import { t } from '../../utils/i18n';
import { AppLanguage } from '../../types';

interface ResourceAnalysisProps {
  data: any[];
  viewMode: 'source' | 'model' | 'architect';
  onViewModeChange: (mode: 'source' | 'model' | 'architect') => void;
  lang: AppLanguage;
}

const COLORS = ['#d68a6d', '#6366f1', '#10b981', '#f59e0b', '#ef4444'];
const getBarColor = (label: string, index: number) => {
  const map: any = { 'Gemini Pro': '#d68a6d', 'Gemini Flash': '#10b981', 'Image Gen': '#6366f1', 'Voice (TTS)': '#f59e0b' };
  return map[label] || COLORS[index % COLORS.length];
};

export const ResourceAnalysis: React.FC<ResourceAnalysisProps> = ({ data, viewMode, onViewModeChange, lang }) => {
  return (
    <Card variant="glass" padding="lg" className="space-y-8 mx-1 min-w-0">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <SectionHeader 
          icon={<Database size={20} className="text-emerald-400" />} 
          title={t('dashboard.resource_analysis', lang)} 
          subtitle={t('dashboard.resource_desc', lang)} 
        />
        
        <div className="flex flex-col md:flex-row items-center gap-6">
          <div className="p-1.5 bg-stone-950/60 rounded-xl border border-white/5 flex gap-1 w-full md:w-auto">
            <Button variant={viewMode === 'source' ? 'secondary' : 'ghost'} size="sm" icon={<Database size={12}/>} onClick={() => onViewModeChange('source')} className={viewMode === 'source' ? "bg-stone-800 text-white shadow-lg" : ""}>Source</Button>
            <Button variant={viewMode === 'model' ? 'primary' : 'ghost'} size="sm" icon={<Cpu size={12}/>} onClick={() => onViewModeChange('model')} className={viewMode === 'model' ? "shadow-lg" : ""}>Model</Button>
            <Button variant={viewMode === 'architect' ? 'indigo' : 'ghost'} size="sm" icon={<BrainCircuit size={12}/>} onClick={() => onViewModeChange('architect')} className={viewMode === 'architect' ? "shadow-lg" : ""}>Architect</Button>
          </div>
          <div className="flex gap-4 self-end md:self-center">
            <div className="flex flex-col items-end">
              <Txt variant="labelSm" className="flex items-center gap-1"><ArrowDownLeft size={10} className="text-emerald-500"/> Input</Txt>
              <span className="text-base md:text-lg font-mono font-black text-emerald-400">{data.reduce((acc, i) => acc + i.input, 0).toLocaleString()}</span>
            </div>
            <div className="flex flex-col items-end">
              <Txt variant="labelSm" className="flex items-center gap-1"><CloudLightning size={10} className="text-sky-400"/> Cached</Txt>
              <span className="text-base md:text-lg font-mono font-black text-sky-400">{data.reduce((acc, i) => acc + i.cached, 0).toLocaleString()}</span>
            </div>
            <div className="flex flex-col items-end">
              <Txt variant="labelSm" className="flex items-center gap-1"><ArrowUpRight size={10} className="text-orange-400"/> Output</Txt>
              <span className="text-base md:text-lg font-mono font-black text-orange-400">{data.reduce((acc, i) => acc + i.output, 0).toLocaleString()}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-8 h-[250px] md:h-[300px] min-w-0 relative">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical" margin={{ left: 0, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" horizontal={true} vertical={false} />
              <XAxis type="number" hide />
              <YAxis dataKey="label" type="category" stroke="#57534e" fontSize={11} width={100} tickLine={false} axisLine={false} />
              <Tooltip cursor={{ fill: 'rgba(255,255,255,0.03)' }} contentStyle={{ backgroundColor: '#1c1917', border: '1px solid #ffffff10', borderRadius: '12px' }} itemStyle={{ fontSize: '11px' }} />
              <Legend iconSize={8} wrapperStyle={{ fontSize: '10px', paddingTop: '10px' }} />
              <Bar dataKey="input" name="Net Input" stackId="a" fill="#10b981" barSize={20} radius={[0, 0, 0, 0]} />
              <Bar dataKey="cached" name="Cached" stackId="a" fill="#38bdf8" barSize={20} radius={[0, 0, 0, 0]} />
              <Bar dataKey="output" name="Output" stackId="a" fill="#d68a6d" radius={[0, 4, 4, 0]} barSize={20} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="lg:col-span-4 space-y-2 md:space-y-3 max-h-[250px] md:max-h-[300px] overflow-y-auto no-scrollbar pr-2 min-w-0">
          <div className={`${Styles.text.labelSm} border-b border-white/5 pb-2`}>Details</div>
          {data.map((item, idx) => (
            <div key={idx} className="flex flex-col p-2.5 md:p-3 bg-stone-950/40 rounded-xl border border-white/5 gap-2">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: getBarColor(item.label, idx) }} />
                <span className="text-[10px] font-black text-stone-300 uppercase truncate">{item.label}</span>
              </div>
              <div className="flex justify-between items-center pl-4">
                 <span className="text-[9px] text-stone-500">Eff: {Math.round((item.cached / (item.input + item.cached || 1)) * 100)}%</span>
                 <span className={Styles.text.mono}>{item.total.toLocaleString()}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
};
