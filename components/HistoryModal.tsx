
import React from 'react';
import { Clock, RotateCcw, X, Check } from 'lucide-react';
import { t } from '../utils/i18n';
import { AppLanguage } from '../types';
import { Styles } from './ui/DesignSystem';

interface HistoryItem {
  rev: number;
  timestamp: number;
  wordCount: number;
}

interface Props {
  isOpen: boolean;
  history: HistoryItem[];
  currentRev?: number;
  onClose: () => void;
  onRestore: (rev: number) => void;
  lang: AppLanguage;
  isLoading: boolean;
}

export const HistoryModal: React.FC<Props> = ({ isOpen, history, currentRev, onClose, onRestore, lang, isLoading }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[1200] flex items-center justify-center p-4 bg-stone-950/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-stone-900 w-full max-w-md rounded-2xl border border-stone-800 shadow-3xl overflow-hidden flex flex-col max-h-[80vh]">
        <div className="p-4 border-b border-white/5 flex justify-between items-center bg-stone-900/50 rounded-t-2xl shrink-0">
          <div className="flex items-center gap-2">
            <Clock size={16} className="text-orange-400" />
            <div>
              <span className="text-sm font-black text-stone-200 uppercase tracking-widest block">{t('history.title', lang)}</span>
              <span className="text-[9px] text-stone-500 font-serif">{t('history.subtitle', lang)}</span>
            </div>
          </div>
          <button onClick={onClose} className="text-stone-500 hover:text-white transition-colors"><X size={18} /></button>
        </div>
        
        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-3">
          {isLoading ? (
            <div className="text-center py-8 text-stone-600 text-[10px] italic">{t('common.loading', lang)}</div>
          ) : history.length === 0 ? (
            <div className="text-center py-8 text-stone-600 text-[10px] italic">{t('history.empty', lang)}</div>
          ) : (
            history.map((item) => {
              const isCurrent = item.rev === currentRev;
              return (
                <div key={item.rev} className={`p-3 rounded-xl border flex items-center justify-between group transition-all ${isCurrent ? 'bg-orange-500/10 border-orange-500/30' : 'bg-stone-950/40 border-white/5 hover:border-white/20'}`}>
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-black uppercase tracking-widest ${isCurrent ? 'text-orange-400' : 'text-stone-300'}`}>
                        Rev.{item.rev}
                      </span>
                      {isCurrent && <span className="text-[8px] bg-orange-500 text-stone-900 px-1.5 rounded-full font-bold">{t('history.current', lang)}</span>}
                    </div>
                    <span className={Styles.text.mono}>{new Date(item.timestamp).toLocaleString(lang === 'ja' ? 'ja-JP' : 'en-US')}</span>
                    <span className="text-[9px] text-stone-600 mt-0.5">Approx. {item.wordCount.toLocaleString()} words</span>
                  </div>
                  
                  {!isCurrent && (
                    <button 
                      onClick={() => onRestore(item.rev)}
                      className="p-2 bg-stone-800 text-stone-500 hover:bg-stone-700 hover:text-white rounded-lg transition-all opacity-0 group-hover:opacity-100 focus:opacity-100"
                      title={t('history.restore', lang)}
                    >
                      <RotateCcw size={14} />
                    </button>
                  )}
                  {isCurrent && <Check size={16} className="text-orange-500 mr-2" />}
                </div>
              );
            })
          )}
        </div>
        
        <div className="p-3 border-t border-white/5 bg-stone-900/50 rounded-b-2xl shrink-0 text-center">
           <span className="text-[9px] text-stone-600">
             Only the last 10 revisions are kept.
           </span>
        </div>
      </div>
    </div>
  );
};
