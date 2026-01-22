
import React from 'react';
import { Loader2, Wand2 } from 'lucide-react';

// --- Form Interfaces ---

export interface FormProps {
  data: any;
  onChange: (key: string, value: any) => void;
  onArrayChange: (key: string, value: string) => void;
  onAutoFill: (fieldKey: string, fieldLabel: string) => void;
  loadingField: string | null;
}

// --- Common UI Components ---

export const AutoFillButton = ({ onClick, isLoading }: { onClick: () => void, isLoading: boolean }) => (
  <button 
    onClick={onClick}
    disabled={isLoading}
    className="absolute top-1 right-1 p-1.5 bg-stone-800 hover:bg-indigo-600 text-stone-500 hover:text-white rounded-lg transition-all opacity-0 group-hover:opacity-100 disabled:opacity-100 focus:opacity-100"
    title="AI Auto-Fill: 設定に基づいて自動生成"
  >
    {isLoading ? <Loader2 size={12} className="animate-spin text-indigo-400"/> : <Wand2 size={12}/>}
  </button>
);

export const Field = ({ label, value, onChange, placeholder, type = "text", onAutoFill, isLoading }: any) => (
  <div className="space-y-1 relative group">
    <label className="text-[10px] font-black text-stone-500 uppercase tracking-widest">{label}</label>
    <div className="relative">
      <input 
        type={type}
        value={value || ''} 
        onChange={e => onChange(e.target.value)} 
        placeholder={placeholder}
        className="w-full bg-stone-950 border border-white/10 rounded-xl px-3 py-2 text-sm text-stone-200 outline-none focus:border-orange-500/50 transition-all"
      />
      {onAutoFill && <AutoFillButton onClick={onAutoFill} isLoading={isLoading} />}
    </div>
  </div>
);

export const TextArea = ({ label, value, onChange, placeholder, onAutoFill, isLoading }: any) => (
  <div className="space-y-1 relative group">
    <label className="text-[10px] font-black text-stone-500 uppercase tracking-widest">{label}</label>
    <div className="relative">
      <textarea 
        value={value || ''} 
        onChange={e => onChange(e.target.value)} 
        placeholder={placeholder}
        className="w-full bg-stone-950 border border-white/10 rounded-xl px-3 py-2 text-sm text-stone-200 outline-none focus:border-orange-500/50 transition-all min-h-[100px] resize-none"
      />
      {onAutoFill && <AutoFillButton onClick={onAutoFill} isLoading={isLoading} />}
    </div>
  </div>
);

export const Select = ({ label, value, onChange, options }: any) => (
  <div className="space-y-1">
    <label className="text-[10px] font-black text-stone-500 uppercase tracking-widest">{label}</label>
    <select 
      value={value || ''} 
      onChange={e => onChange(e.target.value)} 
      className="w-full bg-stone-950 border border-white/10 rounded-xl px-3 py-2 text-sm text-stone-200 outline-none focus:border-orange-500/50 transition-all appearance-none"
    >
      {options.map((opt: string) => <option key={opt} value={opt}>{opt}</option>)}
    </select>
  </div>
);
