import React, { useEffect, useMemo, useState } from 'react';
import { ChapterLog, ChoicePoint, ConvergencePoint, ReactionVariant, ScenePackage } from '../../types';
import {
  ChoicePointSchema,
  ReactionVariantSchema,
  ConvergencePointSchema,
} from '../../services/validation/schemas';
import { z } from 'zod';
import { ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react';

interface ScenePackageModePanelProps {
  mode: 'shared_spine' | 'choice_variant' | 'convergence' | 'validation' | 'final_draft';
  chapter?: ChapterLog;
  onUpdateScenePackage: (
    sceneId: string,
    updater: (scenePackage: ScenePackage) => ScenePackage,
  ) => void;
  onAddScenePackage: () => void;
  onRemoveScenePackage: (sceneId: string) => void;
  onMoveScenePackage: (sceneId: string, direction: 'up' | 'down') => void;
  onDuplicateScenePackage: (sceneId: string) => void;
}

const textInputClass =
  'w-full px-3 py-2 bg-stone-950/40 border border-white/10 rounded-xl text-stone-200 text-sm outline-none focus:border-orange-400/50';

const convergencePolicies = [
  'keep_state',
  'merge_text_only',
  'keep_knowledge',
  'keep_affection_delta',
  'normalize_scene_state',
] as const;

const defaultChoice = (index: number): ChoicePoint => ({
  choiceId: `choice-${index}`,
  text: '',
  branchLevel: 'local_branch',
  intentTag: '',
  immediateEffects: [],
  delayedEffects: [],
  convergenceTarget: '',
});

const defaultVariant = (sceneId: string, index: number): ReactionVariant => ({
  variantId: `variant-${sceneId}-${index}`,
  trigger: '',
  affectedStates: [],
  toneShift: '',
  revealedInfo: [],
  responseBlocks: [],
  convergencePolicy: 'normalize_scene_state',
});

export const ScenePackageModePanel: React.FC<ScenePackageModePanelProps> = ({
  mode,
  chapter,
  onUpdateScenePackage,
  onAddScenePackage,
  onRemoveScenePackage,
  onMoveScenePackage,
  onDuplicateScenePackage,
}) => {
  const scenePackages = useMemo(() => chapter?.scenePackages ?? [], [chapter?.scenePackages]);
  const [activeSceneId, setActiveSceneId] = useState(scenePackages[0]?.sceneId || '');

  useEffect(() => {
    if (!scenePackages.some((scenePackage) => scenePackage.sceneId === activeSceneId)) {
      setActiveSceneId(scenePackages[0]?.sceneId || '');
    }
  }, [scenePackages, activeSceneId]);

  const activeScene = useMemo(
    () => scenePackages.find((scenePackage) => scenePackage.sceneId === activeSceneId),
    [scenePackages, activeSceneId],
  );

  const [choiceJson, setChoiceJson] = useState('[]');
  const [variantJson, setVariantJson] = useState('[]');
  const [showAdvancedJson, setShowAdvancedJson] = useState(false);
  const [editorError, setEditorError] = useState<string | null>(null);

  useEffect(() => {
    setChoiceJson(JSON.stringify(activeScene?.choicePoints || [], null, 2));
    setVariantJson(JSON.stringify(activeScene?.reactionVariants || [], null, 2));
    setEditorError(null);
  }, [activeSceneId, activeScene]);

  if (mode === 'final_draft' || mode === 'validation') return null;

  const parseAndValidateArray = <T,>(
    raw: string,
    itemSchema: z.ZodType<T>,
    label: string,
  ): T[] | null => {
    try {
      const parsed = JSON.parse(raw);
      const result = z.array(itemSchema).safeParse(parsed);
      if (!result.success) {
        setEditorError(`${label}: ${result.error.issues[0]?.message || 'Invalid input'}`);
        return null;
      }
      setEditorError(null);
      return result.data;
    } catch {
      setEditorError(`${label}: JSON parse error`);
      return null;
    }
  };

  const upsertConvergencePoint = (scene: ScenePackage, patch: Partial<ConvergencePoint>) => {
    const next: ConvergencePoint = {
      convergenceId: scene.convergencePoint?.convergenceId || `conv-${scene.sceneId}`,
      sceneId: scene.sceneId,
      targetBlockId: scene.convergencePoint?.targetBlockId || '',
      convergencePolicy: scene.convergencePoint?.convergencePolicy || 'normalize_scene_state',
      ...patch,
    };

    const check = ConvergencePointSchema.safeParse(next);
    if (!check.success) {
      setEditorError(`ConvergencePoint: ${check.error.issues[0]?.message || 'Invalid input'}`);
    } else {
      setEditorError(null);
    }

    return next;
  };

  if (!activeScene) {
    return (
      <div className="mb-4 rounded-2xl border border-dashed border-white/10 bg-stone-950/40 p-4 text-xs text-stone-400">
        Scene Package がありません。<button className="ml-2 text-sky-300" onClick={onAddScenePackage}>最初の Scene Package を追加</button>
      </div>
    );
  }

  const sceneIndex = scenePackages.findIndex((scenePackage) => scenePackage.sceneId === activeScene.sceneId);

  return (
    <div className="mb-4 rounded-2xl border border-white/10 bg-stone-900/60 p-4 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <span className="text-[10px] uppercase tracking-widest text-stone-500 font-black">Scene Package</span>
        <div className="flex items-center gap-2">
          <button
            onClick={onAddScenePackage}
            className="px-2 py-1 text-[10px] rounded-lg border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/10"
          >
            <Plus size={12} className="inline mr-1" /> 追加
          </button>
          <button
            onClick={() => onMoveScenePackage(activeScene.sceneId, 'up')}
            disabled={sceneIndex <= 0}
            className="px-2 py-1 text-[10px] rounded-lg border border-white/10 text-stone-200 disabled:opacity-40"
          >
            ↑
          </button>
          <button
            onClick={() => onMoveScenePackage(activeScene.sceneId, 'down')}
            disabled={sceneIndex >= scenePackages.length - 1}
            className="px-2 py-1 text-[10px] rounded-lg border border-white/10 text-stone-200 disabled:opacity-40"
          >
            ↓
          </button>
          <button
            onClick={() => onDuplicateScenePackage(activeScene.sceneId)}
            className="px-2 py-1 text-[10px] rounded-lg border border-sky-500/30 text-sky-300 hover:bg-sky-500/10"
          >
            複製
          </button>
          <button
            onClick={() => onRemoveScenePackage(activeScene.sceneId)}
            className="px-2 py-1 text-[10px] rounded-lg border border-rose-500/30 text-rose-300 hover:bg-rose-500/10"
          >
            <Trash2 size={12} className="inline mr-1" /> 削除
          </button>
          <select
            value={activeSceneId}
            onChange={(e) => setActiveSceneId(e.target.value)}
            className="bg-stone-950 border border-white/10 rounded-lg text-xs px-2 py-1 text-stone-200"
          >
            {scenePackages.map((scenePackage) => (
              <option key={scenePackage.sceneId} value={scenePackage.sceneId}>
                {scenePackage.title || scenePackage.sceneId}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
        <div className="space-y-1">
          <label className="text-xs text-stone-400">sceneId</label>
          <input
            value={activeScene.sceneId}
            onChange={(e) => {
              const value = e.target.value;
              onUpdateScenePackage(activeScene.sceneId, (scenePackage) => ({ ...scenePackage, sceneId: value }));
              setActiveSceneId(value);
            }}
            className={textInputClass}
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-stone-400">title</label>
          <input
            value={activeScene.title}
            onChange={(e) => {
              const value = e.target.value;
              onUpdateScenePackage(activeScene.sceneId, (scenePackage) => ({ ...scenePackage, title: value }));
            }}
            className={textInputClass}
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-stone-400">purpose</label>
          <input
            value={activeScene.purpose}
            onChange={(e) => {
              const value = e.target.value;
              onUpdateScenePackage(activeScene.sceneId, (scenePackage) => ({ ...scenePackage, purpose: value }));
            }}
            className={textInputClass}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-xs text-stone-400">mandatoryInfo (newline)</label>
          <textarea
            value={activeScene.mandatoryInfo.join('\n')}
            onChange={(e) => {
              const mandatoryInfo = e.target.value.split('\n').map((line) => line.trim()).filter(Boolean);
              onUpdateScenePackage(activeScene.sceneId, (scenePackage) => ({ ...scenePackage, mandatoryInfo }));
            }}
            className={`${textInputClass} min-h-24`}
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-stone-400">entryConditions</label>
          <input
            value={activeScene.entryConditions || ''}
            onChange={(e) => {
              const value = e.target.value || undefined;
              onUpdateScenePackage(activeScene.sceneId, (scenePackage) => ({ ...scenePackage, entryConditions: value }));
            }}
            className={textInputClass}
          />
          <label className="text-xs text-stone-400">exitEffects (newline)</label>
          <textarea
            value={(activeScene.exitEffects || []).join('\n')}
            onChange={(e) => {
              const value = e.target.value.split('\n').map((line) => line.trim()).filter(Boolean);
              onUpdateScenePackage(activeScene.sceneId, (scenePackage) => ({ ...scenePackage, exitEffects: value }));
            }}
            className={`${textInputClass} min-h-24`}
          />
        </div>
      </div>

      {mode === 'shared_spine' && (
        <div className="space-y-3">
          {(
            [
              ['intro', '導入'],
              ['conflict', '対立'],
              ['deepen', '掘り下げ'],
              ['preChoiceBeat', '選択前の溜め'],
              ['close', '締め'],
            ] as const
          ).map(([key, label]) => (
            <div key={key} className="space-y-1">
              <label className="text-xs text-stone-400">{label}</label>
              <textarea
                value={activeScene.sharedSpine?.[key] || ''}
                onChange={(e) => {
                  const value = e.target.value;
                  onUpdateScenePackage(activeScene.sceneId, (scenePackage) => ({
                    ...scenePackage,
                    sharedSpine: {
                      ...scenePackage.sharedSpine,
                      [key]: value,
                    },
                  }));
                }}
                className={`${textInputClass} min-h-20`}
              />
            </div>
          ))}
        </div>
      )}

      {mode === 'choice_variant' && (
        <div className="space-y-3">
          <div className="rounded-xl border border-white/10 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs text-stone-300 font-bold">Choice Points</label>
              <button
                onClick={() =>
                  onUpdateScenePackage(activeScene.sceneId, (scenePackage) => ({
                    ...scenePackage,
                    choicePoints: [...scenePackage.choicePoints, defaultChoice(scenePackage.choicePoints.length + 1)],
                  }))
                }
                className="text-[11px] px-2 py-1 rounded-lg border border-emerald-500/30 text-emerald-300"
              >
                + Choice
              </button>
            </div>
            {activeScene.choicePoints.map((choice, index) => (
              <div key={choice.choiceId || index} className="rounded-lg border border-white/10 p-2 grid grid-cols-1 md:grid-cols-2 gap-2">
                <input value={choice.choiceId} placeholder="choiceId" className={textInputClass} onChange={(e) => onUpdateScenePackage(activeScene.sceneId, (scenePackage) => ({ ...scenePackage, choicePoints: scenePackage.choicePoints.map((item, itemIdx) => (itemIdx === index ? { ...item, choiceId: e.target.value } : item)) }))} />
                <input value={choice.text} placeholder="選択肢文言" className={textInputClass} onChange={(e) => onUpdateScenePackage(activeScene.sceneId, (scenePackage) => ({ ...scenePackage, choicePoints: scenePackage.choicePoints.map((item, itemIdx) => (itemIdx === index ? { ...item, text: e.target.value } : item)) }))} />
                <select value={choice.branchLevel} className={textInputClass} onChange={(e) => onUpdateScenePackage(activeScene.sceneId, (scenePackage) => ({ ...scenePackage, choicePoints: scenePackage.choicePoints.map((item, itemIdx) => (itemIdx === index ? { ...item, branchLevel: e.target.value as ChoicePoint['branchLevel'] } : item)) }))}>
                  {['performative', 'emotional', 'local_branch', 'structural'].map((level) => (
                    <option key={level} value={level}>{level}</option>
                  ))}
                </select>
                <input value={choice.intentTag} placeholder="表示ラベル / intent" className={textInputClass} onChange={(e) => onUpdateScenePackage(activeScene.sceneId, (scenePackage) => ({ ...scenePackage, choicePoints: scenePackage.choicePoints.map((item, itemIdx) => (itemIdx === index ? { ...item, intentTag: e.target.value } : item)) }))} />
                <input value={choice.convergenceTarget} placeholder="遷移先 / branch key" className={textInputClass} onChange={(e) => onUpdateScenePackage(activeScene.sceneId, (scenePackage) => ({ ...scenePackage, choicePoints: scenePackage.choicePoints.map((item, itemIdx) => (itemIdx === index ? { ...item, convergenceTarget: e.target.value } : item)) }))} />
                <input value={choice.immediateReactionVariantId || ''} placeholder="choiceRef (variantId)" className={textInputClass} onChange={(e) => onUpdateScenePackage(activeScene.sceneId, (scenePackage) => ({ ...scenePackage, choicePoints: scenePackage.choicePoints.map((item, itemIdx) => (itemIdx === index ? { ...item, immediateReactionVariantId: e.target.value || undefined } : item)) }))} />
                <textarea value={(choice.immediateEffects || []).join('\n')} placeholder="immediateEffects (newline)" className={`${textInputClass} min-h-20`} onChange={(e) => onUpdateScenePackage(activeScene.sceneId, (scenePackage) => ({ ...scenePackage, choicePoints: scenePackage.choicePoints.map((item, itemIdx) => (itemIdx === index ? { ...item, immediateEffects: e.target.value.split('\n').map((line) => line.trim()).filter(Boolean) } : item)) }))} />
                <textarea value={(choice.delayedEffects || []).join('\n')} placeholder="delayedEffects (newline)" className={`${textInputClass} min-h-20`} onChange={(e) => onUpdateScenePackage(activeScene.sceneId, (scenePackage) => ({ ...scenePackage, choicePoints: scenePackage.choicePoints.map((item, itemIdx) => (itemIdx === index ? { ...item, delayedEffects: e.target.value.split('\n').map((line) => line.trim()).filter(Boolean) } : item)) }))} />
                <input value={choice.visibilityCondition || ''} placeholder="表示条件" className={textInputClass} onChange={(e) => onUpdateScenePackage(activeScene.sceneId, (scenePackage) => ({ ...scenePackage, choicePoints: scenePackage.choicePoints.map((item, itemIdx) => (itemIdx === index ? { ...item, visibilityCondition: e.target.value || undefined } : item)) }))} />
                <input value={choice.availabilityCondition || ''} placeholder="選択可能条件" className={textInputClass} onChange={(e) => onUpdateScenePackage(activeScene.sceneId, (scenePackage) => ({ ...scenePackage, choicePoints: scenePackage.choicePoints.map((item, itemIdx) => (itemIdx === index ? { ...item, availabilityCondition: e.target.value || undefined } : item)) }))} />
                <button className="text-xs text-rose-300 text-left" onClick={() => onUpdateScenePackage(activeScene.sceneId, (scenePackage) => ({ ...scenePackage, choicePoints: scenePackage.choicePoints.filter((_, itemIdx) => itemIdx !== index) }))}>削除</button>
              </div>
            ))}
          </div>

          <div className="rounded-xl border border-white/10 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs text-stone-300 font-bold">Reaction Variants</label>
              <button
                onClick={() =>
                  onUpdateScenePackage(activeScene.sceneId, (scenePackage) => ({
                    ...scenePackage,
                    reactionVariants: [...scenePackage.reactionVariants, defaultVariant(scenePackage.sceneId, scenePackage.reactionVariants.length + 1)],
                  }))
                }
                className="text-[11px] px-2 py-1 rounded-lg border border-emerald-500/30 text-emerald-300"
              >
                + Variant
              </button>
            </div>
            {activeScene.reactionVariants.map((variant, index) => (
              <div key={variant.variantId || index} className="rounded-lg border border-white/10 p-2 grid grid-cols-1 md:grid-cols-2 gap-2">
                <input value={variant.variantId} placeholder="variant key" className={textInputClass} onChange={(e) => onUpdateScenePackage(activeScene.sceneId, (scenePackage) => ({ ...scenePackage, reactionVariants: scenePackage.reactionVariants.map((item, itemIdx) => (itemIdx === index ? { ...item, variantId: e.target.value } : item)) }))} />
                <input value={variant.trigger} placeholder="condition / trigger" className={textInputClass} onChange={(e) => onUpdateScenePackage(activeScene.sceneId, (scenePackage) => ({ ...scenePackage, reactionVariants: scenePackage.reactionVariants.map((item, itemIdx) => (itemIdx === index ? { ...item, trigger: e.target.value } : item)) }))} />
                <input value={variant.toneShift} placeholder="toneShift" className={textInputClass} onChange={(e) => onUpdateScenePackage(activeScene.sceneId, (scenePackage) => ({ ...scenePackage, reactionVariants: scenePackage.reactionVariants.map((item, itemIdx) => (itemIdx === index ? { ...item, toneShift: e.target.value } : item)) }))} />
                <textarea value={(variant.affectedStates || []).join('\n')} placeholder="affectedStates (newline)" className={`${textInputClass} min-h-20`} onChange={(e) => onUpdateScenePackage(activeScene.sceneId, (scenePackage) => ({ ...scenePackage, reactionVariants: scenePackage.reactionVariants.map((item, itemIdx) => (itemIdx === index ? { ...item, affectedStates: e.target.value.split('\n').map((line) => line.trim()).filter(Boolean) } : item)) }))} />
                <textarea value={(variant.revealedInfo || []).join('\n')} placeholder="reveal / effect (newline)" className={`${textInputClass} min-h-20`} onChange={(e) => onUpdateScenePackage(activeScene.sceneId, (scenePackage) => ({ ...scenePackage, reactionVariants: scenePackage.reactionVariants.map((item, itemIdx) => (itemIdx === index ? { ...item, revealedInfo: e.target.value.split('\n').map((line) => line.trim()).filter(Boolean) } : item)) }))} />
                <textarea value={variant.responseBlocks.join('\n')} placeholder="response block (newline)" className={`${textInputClass} min-h-20`} onChange={(e) => onUpdateScenePackage(activeScene.sceneId, (scenePackage) => ({ ...scenePackage, reactionVariants: scenePackage.reactionVariants.map((item, itemIdx) => (itemIdx === index ? { ...item, responseBlocks: e.target.value.split('\n').map((line) => line.trim()).filter(Boolean) } : item)) }))} />
                <select value={variant.convergencePolicy} className={textInputClass} onChange={(e) => onUpdateScenePackage(activeScene.sceneId, (scenePackage) => ({ ...scenePackage, reactionVariants: scenePackage.reactionVariants.map((item, itemIdx) => (itemIdx === index ? { ...item, convergencePolicy: e.target.value as ReactionVariant['convergencePolicy'] } : item)) }))}>
                  {convergencePolicies.map((policy) => (
                    <option key={policy} value={policy}>{policy}</option>
                  ))}
                </select>
                <button className="text-xs text-rose-300 text-left" onClick={() => onUpdateScenePackage(activeScene.sceneId, (scenePackage) => ({ ...scenePackage, reactionVariants: scenePackage.reactionVariants.filter((_, itemIdx) => itemIdx !== index) }))}>削除</button>
              </div>
            ))}
          </div>

          <button
            onClick={() => setShowAdvancedJson((prev) => !prev)}
            className="w-full text-left text-xs text-stone-400 hover:text-stone-200 flex items-center gap-2"
          >
            {showAdvancedJson ? <ChevronUp size={14} /> : <ChevronDown size={14} />} Advanced JSON Editor
          </button>
          {showAdvancedJson && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs text-stone-400">Choice Points (JSON)</label>
                <textarea
                  value={choiceJson}
                  onChange={(e) => {
                    const value = e.target.value;
                    setChoiceJson(value);
                    const parsed = parseAndValidateArray(value, ChoicePointSchema, 'ChoicePoints');
                    if (!parsed) return;
                    onUpdateScenePackage(activeScene.sceneId, (scenePackage) => ({ ...scenePackage, choicePoints: parsed }));
                  }}
                  className={`${textInputClass} min-h-64 font-mono text-xs`}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-stone-400">Reaction Variants (JSON)</label>
                <textarea
                  value={variantJson}
                  onChange={(e) => {
                    const value = e.target.value;
                    setVariantJson(value);
                    const parsed = parseAndValidateArray(value, ReactionVariantSchema, 'ReactionVariants');
                    if (!parsed) return;
                    onUpdateScenePackage(activeScene.sceneId, (scenePackage) => ({ ...scenePackage, reactionVariants: parsed }));
                  }}
                  className={`${textInputClass} min-h-64 font-mono text-xs`}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {editorError && <p className="text-xs text-rose-400">{editorError}</p>}

      {mode === 'convergence' && (
        <div className="space-y-3">
          <div className="space-y-1">
            <label className="text-xs text-stone-400">Convergence Target Block</label>
            <input
              value={activeScene.convergencePoint?.targetBlockId || ''}
              onChange={(e) => {
                const value = e.target.value;
                onUpdateScenePackage(activeScene.sceneId, (scenePackage) => ({
                  ...scenePackage,
                  convergencePoint: upsertConvergencePoint(scenePackage, { targetBlockId: value }),
                }));
              }}
              className={textInputClass}
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs text-stone-400">Convergence Policy</label>
            <select
              value={activeScene.convergencePoint?.convergencePolicy || 'normalize_scene_state'}
              onChange={(e) => {
                onUpdateScenePackage(activeScene.sceneId, (scenePackage) => ({
                  ...scenePackage,
                  convergencePoint: upsertConvergencePoint(scenePackage, {
                    convergencePolicy: e.target.value as ConvergencePoint['convergencePolicy'],
                  }),
                }));
              }}
              className={textInputClass}
            >
              {convergencePolicies.map((policy) => (
                <option key={policy} value={policy}>
                  {policy}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}
    </div>
  );
};
