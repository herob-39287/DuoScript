
import React from 'react';
import { ValueRenderer } from './VisualDiffUtils';
import { useMetadata } from '../../contexts/StoryContext';
import { t } from '../../utils/i18n';

interface VisualDiffProps {
  oldVal: any;
  newVal: any;
  resolver?: (id: string) => string | undefined;
}

export const VisualDiff = React.memo(({ oldVal, newVal, resolver }: VisualDiffProps) => {
  const { preferences: { uiLanguage } } = useMetadata();
  
  // Ignore old value if it is effectively empty or null
  const hasOld = oldVal !== null && oldVal !== undefined && oldVal !== "" && (typeof oldVal !== 'object' || Object.keys(oldVal).length > 0);
  
  return (
    <div className="grid grid-cols-1 gap-3 font-sans">
      {hasOld && (
        <div className="p-3 bg-rose-950/20 border border-rose-500/20 rounded-xl relative overflow-hidden group">
           <div className="absolute top-0 left-0 w-1 h-full bg-rose-500/40" />
           <div className="text-[8px] font-black text-rose-400 uppercase mb-2 tracking-widest pl-2">{t('plotter.sync.diff_old', uiLanguage)}</div>
           <div className="pl-2 opacity-80 grayscale group-hover:grayscale-0 transition-all max-h-40 overflow-y-auto custom-scrollbar">
             <ValueRenderer value={oldVal} resolver={resolver} lang={uiLanguage} />
           </div>
        </div>
      )}
      
      <div className={`p-3 bg-emerald-950/20 border border-emerald-500/20 rounded-xl relative overflow-hidden ${!hasOld ? 'border-dashed' : ''}`}>
         <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500/40" />
         <div className="text-[8px] font-black text-emerald-400 uppercase mb-2 tracking-widest pl-2">{t('plotter.sync.diff_new', uiLanguage)}</div>
         <div className="pl-2">
            <ValueRenderer value={newVal} resolver={resolver} lang={uiLanguage} />
         </div>
      </div>
    </div>
  );
});
