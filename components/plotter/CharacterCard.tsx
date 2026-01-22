
import React, { useState } from 'react';
import { Loader2, Image as ImageIcon, Sparkles, Lock, MessageCircle, Edit2, Trash2, ImageOff } from 'lucide-react';
import { Character } from '../../types';
import { useBible } from '../../contexts/StoryContext';
import { Card, Button } from '../ui/DesignSystem';
import { useCharacterActions } from '../../hooks/useCharacterActions';
import { usePortrait } from '../../hooks/usePortrait';
import { CharacterDisplay } from './card/CharacterDisplay';
import { CharacterEditForm } from './card/CharacterEditForm';

interface CharacterCardProps {
  character: Character;
  onGeneratePortrait: () => void;
  isGenerating: boolean;
}

export const CharacterCard = React.memo(({ character: c, onGeneratePortrait, isGenerating }: CharacterCardProps) => {
  const bible = useBible();
  const [isEditing, setIsEditing] = useState(false);

  // Lazy load image from IDB
  const { imageUrl, isLoading: isImageLoading, error: loadError } = usePortrait(c.id, c.imageUrl);

  // Custom hook for business logic
  const { handleSave, handleDelete, handleConsult, handleGenesisFill, loadingField } = useCharacterActions(c);

  const getRelationshipName = (targetId: string) => {
    const target = bible.characters.find(char => char.id === targetId);
    return target ? target.profile.name : "Unknown";
  };

  const inventory = bible.keyItems
    .filter(i => i.currentOwnerId === c.id)
    .map(i => i.name);

  const onSaveWrapper = (profile: any, relationships: any) => {
    handleSave(profile, relationships);
    setIsEditing(false);
  };

  return (
    <Card variant="glass-bright" padding="none" className={`group ${isEditing ? 'border-orange-500/40' : ''} flex flex-col h-[500px] lg:h-[600px] transition-all`}>
      {/* Header / Image Area */}
      <div className={`relative bg-stone-900 transition-all duration-500 ${isEditing ? 'h-24 shrink-0' : 'h-2/5 shrink-0'}`}>
        {isImageLoading ? (
          <div className="w-full h-full flex items-center justify-center text-stone-700 animate-pulse">
            <Loader2 size={20} className="animate-spin" />
          </div>
        ) : loadError ? (
          <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-stone-700">
             <ImageOff size={24} className="text-rose-900/50" />
             {!isEditing && <span className="text-[8px] font-black uppercase tracking-[0.2em] text-rose-900/50">Load Failed</span>}
          </div>
        ) : imageUrl ? (
          <img src={imageUrl} className={`w-full h-full object-cover transition-transform duration-1000 ${isEditing ? 'opacity-50' : 'group-hover:scale-105'}`} />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-3 text-stone-700">
             {isGenerating ? <Loader2 size={24} className="animate-spin text-orange-400" /> : <ImageIcon size={24} />}
             {!isEditing && <span className="text-[8px] font-black uppercase tracking-[0.2em]">{isGenerating ? '肖像画を生成中...' : '肖像画なし'}</span>}
          </div>
        )}
        
        {/* Overlay Actions */}
        <div className={`absolute top-4 right-4 flex gap-2 transition-opacity ${isEditing ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
           {!isEditing && (
             <>
               <Button 
                 variant="primary"
                 size="icon-sm"
                 onClick={(e) => { e.stopPropagation(); onGeneratePortrait(); }}
                 disabled={isGenerating}
                 icon={<Sparkles size={16} />}
                 title="肖像画を再生成"
               />
               <Button 
                 variant="secondary"
                 size="icon-sm"
                 onClick={(e) => { e.stopPropagation(); handleConsult(); }}
                 icon={<MessageCircle size={16} />}
                 title="設計士に相談"
               />
             </>
           )}
           
           <Button 
             variant={isEditing ? 'ghost' : 'secondary'}
             size="icon-sm"
             onClick={(e) => { e.stopPropagation(); setIsEditing(!isEditing); }}
             icon={<Edit2 size={16} />}
             className={isEditing ? 'bg-stone-800 text-stone-400' : ''}
             title={isEditing ? "編集をキャンセル" : "編集"}
           />
           
           {isEditing && (
             <Button
                variant="danger"
                size="icon-sm"
                onClick={(e) => { e.stopPropagation(); handleDelete(); }}
                icon={<Trash2 size={16} />}
                title="キャラクター削除"
             />
           )}
        </div>

        {/* Name Overlay */}
        {!isEditing && (
          <div className="absolute bottom-4 left-6 bg-stone-950/60 backdrop-blur-md px-4 py-2 rounded-xl flex items-center gap-2 max-w-[80%]">
            <h4 className="text-base md:text-lg font-display font-black text-white italic truncate">{c.profile.name}</h4>
            {c.isPrivate && <Lock size={12} className="text-emerald-400 shrink-0" />}
          </div>
        )}
      </div>

      {/* Content Area */}
      <div className="p-6 flex-1 flex flex-col overflow-hidden bg-stone-900/40">
        {isEditing ? (
          <CharacterEditForm 
            character={c}
            loadingField={loadingField}
            onSave={onSaveWrapper}
            onFill={handleGenesisFill}
            onCancel={() => setIsEditing(false)}
          />
        ) : (
          <CharacterDisplay 
            character={c}
            inventory={inventory}
            relationships={c.relationships}
            getRelationshipName={getRelationshipName}
          />
        )}
      </div>
    </Card>
  );
});
