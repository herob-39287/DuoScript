
import React from 'react';
import { Feather, Sparkles } from 'lucide-react';
import { useMetadata } from '../../contexts/StoryContext';

interface EditorCanvasProps {
  textareaRef: React.RefObject<HTMLTextAreaElement>;
  onChange: () => void;
  isVertical: boolean;
  isZenMode: boolean;
  isLoading: boolean;
  isProcessing: boolean;
}

export const EditorCanvas: React.FC<EditorCanvasProps> = ({
  textareaRef,
  onChange,
  isVertical,
  isZenMode,
  isLoading,
  isProcessing
}) => {
  const meta = useMetadata();
  const settings = meta.preferences.editorSettings || { 
    fontSize: 16, lineHeight: 2.5, fontFamily: 'serif', paperFilter: 'none', verticalMode: false 
  };

  const fontFamily = settings.fontFamily === 'serif' ? 'var(--font-serif)' : 'var(--font-sans)';
  const bgColor = settings.paperFilter === 'dark' ? '#000' : settings.paperFilter === 'sepia' ? '#1f1c1a' : 'transparent';
  const textColor = settings.paperFilter === 'dark' ? '#a8a29e' : settings.paperFilter === 'sepia' ? '#d6cfc7' : '#e7e5e4';

  return (
    <div 
      className={`flex-1 flex justify-center transition-all duration-500 relative ${isVertical ? 'overflow-x-auto overflow-y-hidden flex-row-reverse' : 'overflow-y-auto no-scrollbar'}`}
      style={{ backgroundColor: isZenMode ? bgColor : 'transparent' }}
    >
      <div className={`relative transition-all duration-500 ${isVertical ? 'h-full py-8 px-20' : 'w-full max-w-3xl py-10 md:py-20'}`}>
        {/* Processing Glow Effect */}
        {isProcessing && (
          <div className="absolute inset-0 z-0 pointer-events-none transition-opacity duration-1000">
             <div className="absolute inset-0 bg-orange-500/5 animate-pulse rounded-3xl" />
             {isVertical ? (
               <>
                 <div className="absolute top-0 right-0 h-full w-1 bg-gradient-to-b from-transparent via-orange-500/50 to-transparent animate-pulse" />
                 <div className="absolute top-0 left-0 h-full w-1 bg-gradient-to-b from-transparent via-orange-500/50 to-transparent animate-pulse" />
               </>
             ) : (
               <>
                 <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-orange-500/50 to-transparent animate-pulse" />
                 <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-orange-500/50 to-transparent animate-pulse" />
               </>
             )}
          </div>
        )}

        {/* Processing Floating Indicator */}
        {isProcessing && (
          <div className={`absolute z-20 flex flex-col items-center gap-2 animate-fade-in pointer-events-none ${isVertical ? 'top-1/2 right-12 -translate-y-1/2' : 'bottom-12 left-1/2 -translate-x-1/2'}`}>
             <div className="px-5 py-3 bg-stone-900/90 backdrop-blur-xl border border-orange-500/30 rounded-2xl shadow-2xl shadow-orange-900/40 flex items-center gap-4">
                <div className="relative">
                   <Feather size={20} className="text-orange-400 animate-[bounce_1s_infinite]" />
                   <Sparkles size={12} className="absolute -top-2 -right-2 text-yellow-400 animate-spin" />
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] font-black text-stone-200 uppercase tracking-widest">
                     AI Writing...
                  </span>
                  <span className="text-[8px] text-orange-400 font-serif">
                     物語を紡いでいます
                  </span>
                </div>
             </div>
          </div>
        )}

        <textarea
          ref={textareaRef}
          onInput={onChange}
          disabled={isLoading || isProcessing}
          style={{
            fontSize: `${settings.fontSize}px`,
            lineHeight: settings.lineHeight,
            fontFamily: fontFamily,
            color: textColor
          }}
          className={`relative z-10 bg-transparent outline-none resize-none transition-all duration-500 
            ${isLoading ? 'opacity-0' : isProcessing ? 'opacity-80' : 'opacity-100'} 
            ${isVertical 
              ? 'writing-vertical h-full w-[80vh] tracking-widest' 
              : `w-full h-full ${isZenMode ? 'text-center' : 'text-left'}`
            }`}
          placeholder="ペンが物語を導くままに..."
          spellCheck={false}
        />
      </div>
    </div>
  );
};
