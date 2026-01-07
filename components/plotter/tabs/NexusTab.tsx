import React from 'react';
import { useCharacters, useNotificationDispatch } from '../../../contexts/StoryContext';

const RefreshCw = ({ size, className }: { size: number, className?: string }) => (
  <svg width={size} height={size} className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
);

export const NexusTab: React.FC = () => {
  const characters = useCharacters();
  const { addLog } = useNotificationDispatch();

  return (
   <div className="space-y-8 animate-fade-in h-full flex flex-col">
      <div className="flex justify-between items-end">
        <div>
          <h3 className="text-xl md:text-2xl font-display font-black text-white italic">Neural Nexus</h3>
          <p className="text-[10px] text-stone-500 font-serif mt-1">キャラクターの相関とNexusシミュレーション</p>
        </div>
        <button onClick={() => addLog('info', 'System', '相関図をリフレッシュしています...')} className="p-3 bg-stone-800 text-stone-400 hover:text-white rounded-xl transition-all"><RefreshCw size={18}/></button>
      </div>
      
      <div className="flex-1 glass-bright rounded-[3rem] border border-white/5 relative min-h-[500px] overflow-hidden">
         {/* Simplified Relationship Map Visual */}
         <div className="absolute inset-0 flex items-center justify-center p-12">
            <div className="relative w-full h-full">
               {characters.map((char, i) => {
                 const angle = (i / characters.length) * 2 * Math.PI;
                 const radius = 180;
                 const x = Math.cos(angle) * radius + 250;
                 const y = Math.sin(angle) * radius + 250;
                 return (
                   <div key={char.id} className="absolute transition-all duration-700" style={{ left: `${x}px`, top: `${y}px`, transform: 'translate(-50%, -50%)' }}>
                     <div className="w-14 h-14 rounded-full border-2 border-orange-500/40 overflow-hidden shadow-2xl relative group">
                        <img src={char.imageUrl || ""} className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all" />
                        <div className="absolute inset-0 bg-stone-950/40 opacity-100 flex items-center justify-center group-hover:opacity-0 transition-opacity">
                           <span className="text-[7px] font-black text-white text-center px-1 uppercase leading-tight truncate">{char.profile.name}</span>
                        </div>
                     </div>
                   </div>
                 );
               })}
               {/* Decorative Nexus Lines */}
               <svg className="absolute inset-0 w-full h-full opacity-10 pointer-events-none">
                  <circle cx="250" cy="250" r="180" fill="none" stroke="#d68a6d" strokeWidth="1" strokeDasharray="4 4" />
                  <circle cx="250" cy="250" r="100" fill="none" stroke="#6366f1" strokeWidth="1" strokeDasharray="10 5" />
                  <path d="M250,50 L250,450 M50,250 L450,250" stroke="white" strokeWidth="0.5" />
               </svg>
            </div>
         </div>
         <div className="absolute bottom-10 left-10 max-w-xs space-y-3">
            <div className="p-4 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl backdrop-blur-md">
               <span className="text-[8px] font-black text-indigo-400 uppercase tracking-widest">Active Sim</span>
               <p className="text-[10px] text-stone-300 font-serif leading-relaxed mt-1 italic">「Nexusシミュレーション」機能を使用すると、ここに代替世界線の分岐が表示されます。</p>
            </div>
         </div>
      </div>
   </div>
  );
};