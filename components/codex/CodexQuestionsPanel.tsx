import React from 'react';

type Props = {
  questions: string[];
  onClear: () => void;
};

export const CodexQuestionsPanel: React.FC<Props> = ({ questions, onClear }) => {
  if (questions.length === 0) return null;

  const template = questions.map((q, i) => `${i + 1}. Q: ${q}\n   A: `).join('\n');

  return (
    <div className="mb-3 rounded-2xl border border-sky-500/30 bg-sky-500/10 p-4 text-xs text-sky-100 space-y-2">
      <div className="font-black tracking-widest text-[10px]">Codex Questions</div>
      <ul className="list-decimal ml-4 space-y-1">
        {questions.map((question, index) => (
          <li key={`${index}-${question}`}>{question}</li>
        ))}
      </ul>
      <div className="flex gap-2">
        <button
          onClick={() => navigator.clipboard.writeText(template)}
          className="px-3 py-2 rounded-xl text-[10px] font-black tracking-widest text-sky-100 bg-sky-500/20 border border-sky-400/30"
        >
          Copy Answer Template
        </button>
        <button
          onClick={onClear}
          className="px-3 py-2 rounded-xl text-[10px] font-black tracking-widest text-stone-200 bg-stone-800"
        >
          Clear
        </button>
      </div>
    </div>
  );
};
