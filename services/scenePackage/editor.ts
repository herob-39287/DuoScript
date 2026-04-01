import {
  BranchLevel,
  ChoicePoint,
  ConvergencePoint,
  ReactionVariant,
  ScenePackage,
} from '../validation/schemas';

export type BranchGraphNode = {
  id: string;
  type: 'scene' | 'choice' | 'variant' | 'merge';
  label: string;
  branchLevel?: BranchLevel;
};

export type BranchGraphEdge = {
  from: string;
  to: string;
  kind: 'flow' | 'reaction' | 'merge';
};

export type BranchGraph = {
  nodes: BranchGraphNode[];
  edges: BranchGraphEdge[];
};

export type SceneBranchIssue = {
  code:
    | 'LOCAL_BRANCH_MISSING_CONVERGENCE_TARGET'
    | 'LOCAL_BRANCH_MISSING_VARIANT'
    | 'MISSING_CONVERGENCE_POINT'
    | 'CONVERGENCE_TARGET_MISMATCH';
  message: string;
  choiceId?: string;
};

export const upsertChoicePoint = (
  scenePackage: ScenePackage,
  choice: ChoicePoint,
): ScenePackage => {
  const idx = scenePackage.choicePoints.findIndex((c) => c.choiceId === choice.choiceId);
  if (idx < 0) {
    return { ...scenePackage, choicePoints: [...scenePackage.choicePoints, choice] };
  }

  const next = [...scenePackage.choicePoints];
  next[idx] = choice;
  return { ...scenePackage, choicePoints: next };
};

export const upsertReactionVariant = (
  scenePackage: ScenePackage,
  variant: ReactionVariant,
): ScenePackage => {
  const idx = scenePackage.reactionVariants.findIndex((v) => v.variantId === variant.variantId);
  if (idx < 0) {
    return { ...scenePackage, reactionVariants: [...scenePackage.reactionVariants, variant] };
  }

  const next = [...scenePackage.reactionVariants];
  next[idx] = variant;
  return { ...scenePackage, reactionVariants: next };
};

export const setConvergencePoint = (
  scenePackage: ScenePackage,
  convergencePoint: ConvergencePoint,
): ScenePackage => {
  return { ...scenePackage, convergencePoint };
};

export const buildSceneBranchGraph = (scenePackage: ScenePackage): BranchGraph => {
  const nodes: BranchGraphNode[] = [
    {
      id: scenePackage.sceneId,
      type: 'scene',
      label: scenePackage.title,
    },
  ];

  const edges: BranchGraphEdge[] = [];

  for (const choice of scenePackage.choicePoints) {
    const choiceNodeId = `choice:${choice.choiceId}`;
    nodes.push({
      id: choiceNodeId,
      type: 'choice',
      label: choice.text,
      branchLevel: choice.branchLevel,
    });

    edges.push({ from: scenePackage.sceneId, to: choiceNodeId, kind: 'flow' });

    const variantId = choice.reactionVariantId || choice.immediateReactionVariantId;
    if (variantId) {
      const variantNodeId = `variant:${variantId}`;
      if (!nodes.some((n) => n.id === variantNodeId)) {
        const variant = scenePackage.reactionVariants.find((v) => v.variantId === variantId);
        nodes.push({
          id: variantNodeId,
          type: 'variant',
          label: variant?.trigger || variantId,
        });
      }
      edges.push({ from: choiceNodeId, to: variantNodeId, kind: 'reaction' });

      if (choice.branchLevel === 'local_branch' && choice.convergenceTarget) {
        const mergeNodeId = `merge:${choice.convergenceTarget}`;
        if (!nodes.some((n) => n.id === mergeNodeId)) {
          nodes.push({
            id: mergeNodeId,
            type: 'merge',
            label: choice.convergenceTarget,
          });
        }
        edges.push({ from: variantNodeId, to: mergeNodeId, kind: 'merge' });
      }
    }
  }

  if (scenePackage.convergencePoint) {
    const mergeNodeId = `merge:${scenePackage.convergencePoint.targetBlockId}`;
    if (!nodes.some((n) => n.id === mergeNodeId)) {
      nodes.push({
        id: mergeNodeId,
        type: 'merge',
        label: scenePackage.convergencePoint.targetBlockId,
      });
    }
  }

  return { nodes, edges };
};

export const validateSceneBranching = (scenePackage: ScenePackage): SceneBranchIssue[] => {
  const issues: SceneBranchIssue[] = [];

  for (const choice of scenePackage.choicePoints) {
    if (choice.branchLevel !== 'local_branch') continue;

    if (!choice.convergenceTarget || choice.convergenceTarget.trim().length === 0) {
      issues.push({
        code: 'LOCAL_BRANCH_MISSING_CONVERGENCE_TARGET',
        message: `Choice ${choice.choiceId} is local_branch but has no convergenceTarget.`,
        choiceId: choice.choiceId,
      });
    }

    const variantId = choice.reactionVariantId || choice.immediateReactionVariantId;
    if (!variantId) {
      issues.push({
        code: 'LOCAL_BRANCH_MISSING_VARIANT',
        message: `Choice ${choice.choiceId} is local_branch but has no linked variant.`,
        choiceId: choice.choiceId,
      });
    }
  }

  const hasLocalBranch = scenePackage.choicePoints.some((c) => c.branchLevel === 'local_branch');
  if (hasLocalBranch && !scenePackage.convergencePoint) {
    issues.push({
      code: 'MISSING_CONVERGENCE_POINT',
      message: 'Scene has local_branch choices but no convergencePoint.',
    });
  }

  if (scenePackage.convergencePoint) {
    for (const choice of scenePackage.choicePoints) {
      if (choice.branchLevel !== 'local_branch') continue;
      if (!choice.convergenceTarget) continue;
      if (choice.convergenceTarget !== scenePackage.convergencePoint.targetBlockId) {
        issues.push({
          code: 'CONVERGENCE_TARGET_MISMATCH',
          message: `Choice ${choice.choiceId} convergenceTarget does not match scene convergencePoint targetBlockId.`,
          choiceId: choice.choiceId,
        });
      }
    }
  }

  return issues;
};
