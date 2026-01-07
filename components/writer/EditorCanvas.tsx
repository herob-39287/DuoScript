
import React from 'react';

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
  return (
    <div className={`flex-1 overflow-y-auto no-scrollbar py-10 md:py-20 flex justify-center ${isVertical ? 'writing-vertical' : ''}`}>
      <textarea
        ref={textareaRef}
        onInput={onChange}
        disabled={isLoading || isProcessing}
        className={`w-full bg-transparent outline-none resize-none prose-literary font-serif h-full transition-opacity duration-1000 ${isLoading ? 'opacity-0' : 'opacity-100'} ${isZenMode ? 'text-center' : 'text-left'}`}
        placeholder="ペンが物語を導くままに..."
        spellCheck={false}
      />
    </div>
  );
};
