import React from 'react';
import { DialogState } from '../types';
import { AlertCircle, HelpCircle, X, Check } from 'lucide-react';

interface Props {
  dialog: DialogState;
  setDialog: React.Dispatch<React.SetStateAction<DialogState>>;
}

const GlobalDialog: React.FC<Props> = ({ dialog, setDialog }) => {
  if (!dialog.isOpen) return null;

  const close = () => {
    if (dialog.onCancel) dialog.onCancel();
    setDialog((prev) => ({ ...prev, isOpen: false }));
  };

  const confirm = () => {
    if (dialog.onConfirm) dialog.onConfirm();
    setDialog((prev) => ({ ...prev, isOpen: false }));
  };

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-6 bg-stone-950/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-stone-900 w-full max-w-md rounded-3xl border border-stone-800 shadow-3xl overflow-hidden flex flex-col scale-in">
        <div className="p-8 space-y-4">
          <div className="flex items-center gap-4">
            <div
              className={`p-3 rounded-2xl ${dialog.type === 'confirm' ? 'bg-orange-600/20 text-orange-400' : 'bg-rose-600/20 text-rose-400'}`}
            >
              {dialog.type === 'confirm' ? <HelpCircle size={24} /> : <AlertCircle size={24} />}
            </div>
            <h3 className="text-xl font-black text-white italic tracking-tighter uppercase">
              {dialog.title}
            </h3>
          </div>
          <p className="text-sm text-stone-400 leading-relaxed font-medium">{dialog.message}</p>
        </div>

        <div className="p-4 bg-stone-950/40 border-t border-stone-800 flex gap-3">
          {dialog.type === 'confirm' ? (
            <>
              <button
                onClick={close}
                className="flex-1 py-4 text-[10px] font-black uppercase tracking-widest text-stone-500 hover:text-white transition-all"
              >
                キャンセル
              </button>
              <button
                onClick={confirm}
                className="flex-1 py-4 bg-orange-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-orange-500 shadow-lg shadow-orange-900/20 transition-all active:scale-95 flex items-center justify-center gap-2"
              >
                確認 <Check size={14} />
              </button>
            </>
          ) : (
            <button
              onClick={close}
              className="w-full py-4 bg-stone-800 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-stone-700 transition-all active:scale-95"
            >
              了解しました
            </button>
          )}
        </div>
      </div>
      <style>{`
        .scale-in { animation: scaleIn 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        @keyframes scaleIn {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
};

export default GlobalDialog;
