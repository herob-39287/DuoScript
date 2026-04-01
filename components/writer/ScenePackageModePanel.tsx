import React, { useEffect, useMemo, useState } from 'react';
import { ChapterLog, ScenePackage } from '../../types';
import {
  ChoicePointSchema,
  ReactionVariantSchema,
  ConvergencePointSchema,
} from '../../services/validation/schemas';
import { z } from 'zod';

interface ScenePackageModePanelProps {
  mode: 'shared_spine' | 'choice_variant' | 'convergence' | 'validation' | 'final_draft';
  chapter?: ChapterLog;
  onUpdateScenePackage: (
    sceneId: string,
    updater: (scenePackage: ScenePackage) => ScenePackage,
  ) => void;
}

const textInputClass =
  'w-full px-3 py-2 bg-stone-950/40 border border-white/10 rounded-xl text-stone-200 text-sm outline-none focus:border-orange-400/50';

export const ScenePackageModePanel: React.FC<ScenePackageModePanelProps> = ({
  mode,
  chapter,
  onUpdateScenePackage,
}) => {
  const scenePackages = chapter?.scenePackages || [];
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

  if (!activeScene) {
    return (
      <div className="mb-4 rounded-2xl border border-dashed border-white/10 bg-stone-950/40 p-4 text-xs text-stone-400">
        Scene Package がありません。Plot 側で作成後に編集できます。
      </div>
    );
  }

  return (
    <div className="mb-4 rounded-2xl border border-white/10 bg-stone-900/60 p-4 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[10px] uppercase tracking-widest text-stone-500 font-black">
          Scene Package
        </span>
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
                onUpdateScenePackage(activeScene.sceneId, (scenePackage) => ({
                  ...scenePackage,
                  choicePoints: parsed,
                }));
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
                const parsed = parseAndValidateArray(
                  value,
                  ReactionVariantSchema,
                  'ReactionVariants',
                );
                if (!parsed) return;
                onUpdateScenePackage(activeScene.sceneId, (scenePackage) => ({
                  ...scenePackage,
                  reactionVariants: parsed,
                }));
              }}
              className={`${textInputClass} min-h-64 font-mono text-xs`}
            />
          </div>
        </div>
      )}

      {editorError && <p className="text-xs text-rose-400">{editorError}</p>}

      {mode === 'convergence' && (
        <div className="space-y-3">
          <div className="space-y-1">
            <label className="text-xs text-stone-400">Entry Condition</label>
            <input
              value={activeScene.entryConditions || ''}
              onChange={(e) => {
                const value = e.target.value || undefined;
                onUpdateScenePackage(activeScene.sceneId, (scenePackage) => ({
                  ...scenePackage,
                  entryConditions: value,
                }));
              }}
              className={textInputClass}
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-stone-400">Exit Effects (newline)</label>
            <textarea
              value={(activeScene.exitEffects || []).join('\n')}
              onChange={(e) => {
                const value = e.target.value
                  .split('\n')
                  .map((line) => line.trim())
                  .filter(Boolean);
                onUpdateScenePackage(activeScene.sceneId, (scenePackage) => ({
                  ...scenePackage,
                  exitEffects: value,
                }));
              }}
              className={`${textInputClass} min-h-28`}
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-stone-400">Convergence Target Block</label>
            <input
              value={activeScene.convergencePoint?.targetBlockId || ''}
              onChange={(e) => {
                const value = e.target.value;
                onUpdateScenePackage(activeScene.sceneId, (scenePackage) => ({
                  ...scenePackage,
                  convergencePoint: {
                    convergenceId:
                      scenePackage.convergencePoint?.convergenceId ||
                      `conv-${scenePackage.sceneId}`,
                    sceneId: scenePackage.sceneId,
                    targetBlockId: value,
                    convergencePolicy:
                      scenePackage.convergencePoint?.convergencePolicy || 'normalize_scene_state',
                  },
                }));
              }}
              className={textInputClass}
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs text-stone-400">Convergence Policy</label>
            <input
              value={activeScene.convergencePoint?.convergencePolicy || 'normalize_scene_state'}
              onChange={(e) => {
                const value = e.target.value as
                  | 'keep_state'
                  | 'merge_text_only'
                  | 'keep_knowledge'
                  | 'keep_affection_delta'
                  | 'normalize_scene_state';
                onUpdateScenePackage(activeScene.sceneId, (scenePackage) => ({
                  ...scenePackage,
                  convergencePoint: {
                    convergenceId:
                      scenePackage.convergencePoint?.convergenceId ||
                      `conv-${scenePackage.sceneId}`,
                    sceneId: scenePackage.sceneId,
                    targetBlockId: scenePackage.convergencePoint?.targetBlockId || '',
                    convergencePolicy: value,
                  },
                }));

                const check = ConvergencePointSchema.safeParse({
                  convergenceId:
                    activeScene.convergencePoint?.convergenceId || `conv-${activeScene.sceneId}`,
                  sceneId: activeScene.sceneId,
                  targetBlockId: activeScene.convergencePoint?.targetBlockId || '',
                  convergencePolicy: value,
                });
                if (!check.success) {
                  setEditorError(
                    `ConvergencePoint: ${check.error.issues[0]?.message || 'Invalid input'}`,
                  );
                } else {
                  setEditorError(null);
                }
              }}
              className={textInputClass}
            />
          </div>
        </div>
      )}
    </div>
  );
};
