
import React from 'react';
import { X, Type, LayoutTemplate, Palette, AlignLeft, AlignJustify } from 'lucide-react';
import { useMetadata, useMetadataDispatch } from '../../contexts/StoryContext';
import * as Actions from '../../store/actions';
import { EditorSettings } from '../../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const AppearanceSettingsModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const meta = useMetadata();
  const dispatch = useMetadataDispatch();
  const settings = meta.preferences.editorSettings || { 
    fontSize: 16, lineHeight: 2.5, fontFamily: 'serif', paperFilter: 'none', verticalMode: false 
  };

  if (!isOpen) return null;

  const update = (updates: Partial<EditorSettings>) => {
    dispatch(Actions.updatePreferences({ editorSettings: { ...settings, ...updates } }));
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-stone-950/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-stone-900 w-full max-w-sm rounded-2xl border border-stone-800 shadow-3xl overflow-hidden">
        <div className="p-4 border-b border-white/5 flex justify-between items-center bg-stone-900/50">
          <span className="text-sm font-black text-stone-200 uppercase tracking-widest">Editor Appearance</span>
          <button onClick={onClose} className="text-stone-500 hover:text-white"><X size={18} /></button>
        </div>
        
        <div className="p-6 space-y-6">
           {/* Font Size */}
           <div className="space-y-3">
              <div className="text-[10px] font-black text-stone-500 uppercase tracking-widest flex items-center gap-2"><Type size={12}/> 文字サイズ</div>
              <div className="flex gap-2 bg-stone-950 p-1 rounded-xl border border-white/5">
                 {[14, 16, 18, 20, 24].map(size => (
                   <button 
                     key={size}
                     onClick={() => update({ fontSize: size })}
                     className={`flex-1 py-2 rounded-lg text-[10px] font-bold transition-all ${settings.fontSize === size ? 'bg-stone-700 text-white shadow' : 'text-stone-500 hover:text-stone-300'}`}
                   >
                     {size}
                   </button>
                 ))}
              </div>
           </div>

           {/* Line Height */}
           <div className="space-y-3">
              <div className="text-[10px] font-black text-stone-500 uppercase tracking-widest flex items-center gap-2"><AlignJustify size={12}/> 行間</div>
              <div className="flex gap-2 bg-stone-950 p-1 rounded-xl border border-white/5">
                 {[1.8, 2.0, 2.5, 3.0].map(h => (
                   <button 
                     key={h}
                     onClick={() => update({ lineHeight: h })}
                     className={`flex-1 py-2 rounded-lg text-[10px] font-bold transition-all ${settings.lineHeight === h ? 'bg-stone-700 text-white shadow' : 'text-stone-500 hover:text-stone-300'}`}
                   >
                     {h}
                   </button>
                 ))}
              </div>
           </div>

           {/* Font Family */}
           <div className="space-y-3">
              <div className="text-[10px] font-black text-stone-500 uppercase tracking-widest flex items-center gap-2"><Type size={12}/> フォント</div>
              <div className="flex gap-2">
                 <button 
                   onClick={() => update({ fontFamily: 'serif' })}
                   className={`flex-1 py-3 rounded-xl border transition-all text-xs font-serif ${settings.fontFamily === 'serif' ? 'bg-orange-600/20 border-orange-500/50 text-orange-400' : 'bg-stone-950 border-white/5 text-stone-500'}`}
                 >
                   明朝体 (Serif)
                 </button>
                 <button 
                   onClick={() => update({ fontFamily: 'sans' })}
                   className={`flex-1 py-3 rounded-xl border transition-all text-xs font-sans ${settings.fontFamily === 'sans' ? 'bg-orange-600/20 border-orange-500/50 text-orange-400' : 'bg-stone-950 border-white/5 text-stone-500'}`}
                 >
                   ゴシック (Sans)
                 </button>
              </div>
           </div>

           {/* Paper Filter */}
           <div className="space-y-3">
              <div className="text-[10px] font-black text-stone-500 uppercase tracking-widest flex items-center gap-2"><Palette size={12}/> 用紙テーマ</div>
              <div className="grid grid-cols-3 gap-2">
                 <button onClick={() => update({ paperFilter: 'none' })} className={`h-10 rounded-lg border transition-all ${settings.paperFilter === 'none' ? 'border-orange-500 ring-2 ring-orange-500/20' : 'border-stone-700'} bg-[#1c1917]`}></button>
                 <button onClick={() => update({ paperFilter: 'sepia' })} className={`h-10 rounded-lg border transition-all ${settings.paperFilter === 'sepia' ? 'border-orange-500 ring-2 ring-orange-500/20' : 'border-stone-700'} bg-[#292524]`} style={{ filter: 'sepia(0.2)' }}></button>
                 <button onClick={() => update({ paperFilter: 'dark' })} className={`h-10 rounded-lg border transition-all ${settings.paperFilter === 'dark' ? 'border-orange-500 ring-2 ring-orange-500/20' : 'border-stone-700'} bg-black`}></button>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
};
