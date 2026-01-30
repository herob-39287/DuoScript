import React from 'react';

export interface NavBtnProps {
  icon: React.ReactNode;
  active: boolean;
  onClick: () => void;
}

export const NavBtn: React.FC<NavBtnProps> = React.memo(({ icon, active, onClick }) => (
  <button
    onClick={onClick}
    className={`w-12 h-12 md:w-full md:aspect-square rounded-[1.25rem] flex items-center justify-center transition-all ${active ? 'bg-orange-500 text-stone-950 shadow-lg' : 'text-stone-600 hover:text-stone-300 hover:bg-stone-800'}`}
  >
    {icon}
  </button>
));

export interface MobileNavBtnProps extends NavBtnProps {
  label: string;
}

export const MobileNavBtn: React.FC<MobileNavBtnProps> = React.memo(
  ({ icon, active, onClick, label }) => (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-1.5 transition-all ${active ? 'text-orange-400' : 'text-stone-600'}`}
    >
      {icon}
      <span className="text-[8px] font-black uppercase tracking-widest">{label}</span>
    </button>
  ),
);

export interface ActionBtnProps {
  icon: React.ReactNode;
  onClick: () => void;
}

export const ActionBtn: React.FC<ActionBtnProps> = React.memo(({ icon, onClick }) => (
  <button
    onClick={onClick}
    className="w-12 h-12 flex items-center justify-center text-stone-600 hover:text-stone-100 hover:bg-stone-800 rounded-xl transition-all"
  >
    {icon}
  </button>
));
