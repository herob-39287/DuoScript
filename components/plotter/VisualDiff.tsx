
import React from 'react';

interface VisualDiffProps {
  oldVal: any;
  newVal: any;
}

export const VisualDiff = React.memo(({ oldVal, newVal }: VisualDiffProps) => {
  const formatValue = (v: any) => {
    if (v === null || v === undefined) return "---";
    if (typeof v === 'string') return v;
    if (typeof v === 'object') {
       const keys = Object.keys(v);
       if (keys.length === 1) return String(v[keys[0]]);
       return JSON.stringify(v, null, 2);
    }
    return String(v);
  };
  const oldStr = formatValue(oldVal);
  const newStr = formatValue(newVal);
  return (
    <div className="grid grid-cols-1 gap-2">
      {oldStr !== "---" && (
        <div className="p-3 bg-rose-500/5 border border-rose-500/10 rounded-xl">
           <div className="text-[8px] font-black text-rose-500 uppercase mb-1">Before</div>
           <p className="text-[10px] font-serif text-stone-500 line-through leading-relaxed">{oldStr}</p>
        </div>
      )}
      <div className="p-3 bg-emerald-500/5 border border-emerald-500/10 rounded-xl">
         <div className="text-[8px] font-black text-emerald-500 uppercase mb-1">After</div>
         <p className="text-[10px] font-serif text-stone-200 leading-relaxed">{newStr}</p>
      </div>
    </div>
  );
});
