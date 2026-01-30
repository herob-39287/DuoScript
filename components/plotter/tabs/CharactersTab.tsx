import React from 'react';
import { Plus } from 'lucide-react';
import {
  useCharacters,
  useBibleDispatch,
  useNotificationDispatch,
} from '../../../contexts/StoryContext';
import * as Actions from '../../../store/actions';
import { CharacterCard } from '../CharacterCard';
import { Character } from '../../../types';

interface CharactersTabProps {
  onGeneratePortrait: (charId: string) => void;
  generatingCharId: string | null;
}

export const CharactersTab: React.FC<CharactersTabProps> = ({
  onGeneratePortrait,
  generatingCharId,
}) => {
  const characters = useCharacters();
  const bibleDispatch = useBibleDispatch();
  const { addLog } = useNotificationDispatch();

  const handleAddCharacter = () => {
    const newChar: Character = {
      id: crypto.randomUUID(),
      profile: {
        name: '名もなき人物',
        aliases: [],
        role: 'Supporting',
        description: '詳細未設定',
        shortSummary: '',
        appearance: '',
        personality: '',
        background: '',
        voice: {
          firstPerson: '私',
          secondPerson: 'あなた',
          speechStyle: 'Casual',
          catchphrases: [],
          forbiddenWords: [],
        },
        traits: [],
        motivation: '',
        flaw: '',
        arc: '',
      },
      state: {
        location: '不明',
        internalState: '平常',
        currentGoal: '',
        health: '良好',
        socialStanding: '',
      },
      relationships: [],
      history: [],
      isPrivate: false,
    };

    // Use optimized action that doesn't require reading the full list
    bibleDispatch(Actions.manipulateBibleList('characters', 'add', undefined, newChar));
    addLog('success', 'System', '新しいキャラクターを作成しました。');
  };

  if (!characters) return null;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-end">
        <div>
          <h3 className="text-xl md:text-2xl font-display font-black text-white italic">
            Dramatis Personae
          </h3>
          <p className="text-[10px] text-stone-500 font-serif mt-1">登場人物とその関係性</p>
        </div>
        <button
          onClick={handleAddCharacter}
          className="p-3 bg-stone-800 text-stone-400 hover:bg-orange-600 hover:text-white rounded-xl transition-all shadow-lg"
        >
          <Plus size={20} />
        </button>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-6">
        {characters.map((char) => (
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
