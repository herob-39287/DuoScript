import React from 'react';
import { Plus } from 'lucide-react';
import { useCharacters, useNotificationDispatch } from '../../../contexts/StoryContext';
import { CharacterCard } from '../CharacterCard';

interface CharactersTabProps {
  onGeneratePortrait: (charId: string) => void;
  generatingCharId: string | null;
}

export const CharactersTab: React.FC<CharactersTabProps> = ({ onGeneratePortrait, generatingCharId }) => {
  const characters = useCharacters();
  const { addLog } = useNotificationDispatch();

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-end">
        <div>
          <h3 className="text-xl md:text-2xl font-display font-black text-white italic">Dramatis Personae</h3>
          <p className="text-[10px] text-stone-500 font-serif mt-1">登場人物とその関係性</p>
        </div>
        <button onClick={() => addLog('info', 'System', '設計士に追加を依頼してください')} className="p-3 bg-stone-800 text-stone-400 hover:text-white rounded-xl transition-all"><Plus size={20}/></button>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-6">
        {characters.map(char => (
          <CharacterCard 
            key={char.id} 
            character={char} 
            onGeneratePortrait={() => onGeneratePortrait(char.id)} 
            isGenerating={generatingCharId === char.id} 
          />
        ))}
      </div>
    </div>
  );
};