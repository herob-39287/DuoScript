import React from 'react';
import { CodexPatchOperation } from '../../services/workspace/patchTypes';

type Item = {
  op: CodexPatchOperation;
  selected: boolean;
  result?: { status: string; message: string };
};

type Props = {
  proposals: Item[];
  unresolved: string[];
  onApplyAll: () => void;
  onRejectAll: () => void;
  onApplyOne: (opId: string) => void;
  onRejectOne: (opId: string) => void;
};

export const CodexProposalList: React.FC<Props> = ({
  proposals,
  unresolved,
  onApplyAll,
  onRejectAll,
  onApplyOne,
  onRejectOne,
}) => {
  if (proposals.length === 0) return null;

  const buildTargetIdentifiers = (op: CodexPatchOperation): string[] => {
    if (op.type === 'upsertStateAxis') return [`stateKey:${op.axis.stateKey}`];
    if (op.type === 'upsertRoute') return [`routeId:${op.route.routeId}`];
    if (op.type === 'upsertRevealPlan') return [`revealId:${op.revealPlan.revealId}`];
    if (op.type === 'upsertBranchPolicy') return [`policyId:${op.policy.policyId}`];
    if (op.type === 'upsertChapter') return [`chapterId:${op.chapter.id}`];
    if (op.type === 'upsertScenePackage')
      return [`chapterId:${op.chapterId}`, `sceneId:${op.scenePackage.sceneId}`];
    if (op.type === 'deleteScenePackage') return [`chapterId:${op.chapterId}`, `sceneId:${op.sceneId}`];
    return [];
  };

  return (
    <div className="mb-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-xs text-emerald-100 space-y-3">
      <div className="font-black tracking-widest text-[10px]">Codex Ops</div>
      <div className="flex gap-2">
        <button onClick={onApplyAll} className="px-3 py-2 rounded-xl text-[10px] font-black tracking-widest text-emerald-100 bg-emerald-600/30">全件適用</button>
        <button onClick={onRejectAll} className="px-3 py-2 rounded-xl text-[10px] font-black tracking-widest text-rose-100 bg-rose-600/30">一括却下</button>
      </div>
      <ul className="space-y-2">
        {proposals.map(({ op, selected, result }) => (
          <li key={op.opId} className="rounded-xl border border-white/10 p-2 bg-stone-900/30">
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="font-mono text-[10px]">{op.type} ({op.opId})</div>
                {buildTargetIdentifiers(op).length > 0 && (
                  <div className="font-mono text-[10px] text-emerald-300/90">
                    {buildTargetIdentifiers(op).join(' / ')}
                  </div>
                )}
                {op.reason && <div className="text-stone-300">{op.reason}</div>}
                {result && <div className="text-[10px] text-stone-400">{result.status}: {result.message}</div>}
              </div>
              <div className="flex gap-1">
                <button onClick={() => onApplyOne(op.opId)} className="px-2 py-1 text-[10px] rounded bg-emerald-500/30" disabled={selected}>適用</button>
                <button onClick={() => onRejectOne(op.opId)} className="px-2 py-1 text-[10px] rounded bg-rose-500/30" disabled={!selected}>却下</button>
              </div>
            </div>
          </li>
        ))}
      </ul>
      {unresolved.length > 0 && (
        <div>
          <div className="font-black text-[10px] tracking-widest">Unresolved</div>
          <ul className="list-disc ml-4">
            {unresolved.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
