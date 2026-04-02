import { WorkspaceBundle } from './types';

export type WorkspaceDiff = {
  routeDiff: { added: string[]; removed: string[]; modified: string[] };
  chapterDiff: { added: string[]; removed: string[]; modified: string[] };
  sceneDiff: { added: string[]; removed: string[]; modified: string[] };
  detailDiff: {
    modifiedScenePackages: string[];
    modifiedChoices: string[];
    modifiedReactionVariants: string[];
    modifiedConditions: string[];
  };
  validatorDiff: { previous: number; next: number };
};

const toSet = (values: string[]) => new Set(values.filter(Boolean));

const setDiff = (before: Set<string>, after: Set<string>) => ({
  added: [...after].filter((id) => !before.has(id)),
  removed: [...before].filter((id) => !after.has(id)),
});

const stableStringify = (value: unknown): string => JSON.stringify(value);

export const diffWorkspaceBundles = (
  previous: WorkspaceBundle,
  next: WorkspaceBundle,
): WorkspaceDiff => {
  const previousRoutes = toSet(previous.project.vnDesign.routes.map((route) => route.routeId));
  const nextRoutes = toSet(next.project.vnDesign.routes.map((route) => route.routeId));

  const previousChapters = toSet(previous.project.chapters.map((chapter) => chapter.id));
  const nextChapters = toSet(next.project.chapters.map((chapter) => chapter.id));

  const previousScenes = toSet(
    previous.project.chapters.flatMap((chapter) =>
      (chapter.scenePackages || []).map((scenePackage) => `${chapter.id}:${scenePackage.sceneId}`),
    ),
  );
  const nextScenes = toSet(
    next.project.chapters.flatMap((chapter) =>
      (chapter.scenePackages || []).map((scenePackage) => `${chapter.id}:${scenePackage.sceneId}`),
    ),
  );

  const routeDiffBase = setDiff(previousRoutes, nextRoutes);
  const chapterDiffBase = setDiff(previousChapters, nextChapters);
  const sceneDiffBase = setDiff(previousScenes, nextScenes);

  const previousRouteById = new Map(
    previous.project.vnDesign.routes.map((route) => [route.routeId, stableStringify(route)]),
  );
  const nextRouteById = new Map(
    next.project.vnDesign.routes.map((route) => [route.routeId, stableStringify(route)]),
  );

  const modifiedRoutes = [...previousRouteById.keys()].filter(
    (id) => nextRouteById.has(id) && previousRouteById.get(id) !== nextRouteById.get(id),
  );

  const previousChapterById = new Map(
    previous.project.chapters.map((chapter) => [chapter.id, stableStringify(chapter)]),
  );
  const nextChapterById = new Map(
    next.project.chapters.map((chapter) => [chapter.id, stableStringify(chapter)]),
  );

  const modifiedChapters = [...previousChapterById.keys()].filter(
    (id) => nextChapterById.has(id) && previousChapterById.get(id) !== nextChapterById.get(id),
  );

  const previousSceneById = new Map(
    previous.project.chapters.flatMap((chapter) =>
      (chapter.scenePackages || []).map(
        (scenePackage) => [`${chapter.id}:${scenePackage.sceneId}`, scenePackage] as const,
      ),
    ),
  );
  const nextSceneById = new Map(
    next.project.chapters.flatMap((chapter) =>
      (chapter.scenePackages || []).map(
        (scenePackage) => [`${chapter.id}:${scenePackage.sceneId}`, scenePackage] as const,
      ),
    ),
  );

  const modifiedScenes = [...previousSceneById.keys()].filter((id) => {
    if (!nextSceneById.has(id)) return false;
    return stableStringify(previousSceneById.get(id)) !== stableStringify(nextSceneById.get(id));
  });

  const modifiedChoices = modifiedScenes.flatMap((sceneKey) => {
    const before = previousSceneById.get(sceneKey);
    const after = nextSceneById.get(sceneKey);
    if (!before || !after) return [];

    const beforeChoices = new Map(
      before.choicePoints.map((choice) => [choice.choiceId, stableStringify(choice)]),
    );
    const afterChoices = new Map(
      after.choicePoints.map((choice) => [choice.choiceId, stableStringify(choice)]),
    );

    return [...new Set([...beforeChoices.keys(), ...afterChoices.keys()])]
      .filter((choiceId) => beforeChoices.get(choiceId) !== afterChoices.get(choiceId))
      .map((choiceId) => `${sceneKey}:${choiceId}`);
  });

  const modifiedReactionVariants = modifiedScenes.flatMap((sceneKey) => {
    const before = previousSceneById.get(sceneKey);
    const after = nextSceneById.get(sceneKey);
    if (!before || !after) return [];

    const beforeVariants = new Map(
      before.reactionVariants.map((variant) => [variant.variantId, stableStringify(variant)]),
    );
    const afterVariants = new Map(
      after.reactionVariants.map((variant) => [variant.variantId, stableStringify(variant)]),
    );

    return [...new Set([...beforeVariants.keys(), ...afterVariants.keys()])]
      .filter((variantId) => beforeVariants.get(variantId) !== afterVariants.get(variantId))
      .map((variantId) => `${sceneKey}:${variantId}`);
  });

  const modifiedConditions = modifiedScenes.flatMap((sceneKey) => {
    const before = previousSceneById.get(sceneKey);
    const after = nextSceneById.get(sceneKey);
    if (!before || !after) return [];

    const conditionChanges: string[] = [];
    if ((before.entryConditions || '') !== (after.entryConditions || '')) {
      conditionChanges.push(`${sceneKey}:entryConditions`);
    }

    const beforeChoices = new Map(before.choicePoints.map((choice) => [choice.choiceId, choice]));
    const afterChoices = new Map(after.choicePoints.map((choice) => [choice.choiceId, choice]));

    [...new Set([...beforeChoices.keys(), ...afterChoices.keys()])].forEach((choiceId) => {
      const prev = beforeChoices.get(choiceId);
      const nextChoice = afterChoices.get(choiceId);
      if (!prev || !nextChoice) {
        conditionChanges.push(`${sceneKey}:${choiceId}:choice-lifecycle`);
        return;
      }

      if ((prev.visibilityCondition || '') !== (nextChoice.visibilityCondition || '')) {
        conditionChanges.push(`${sceneKey}:${choiceId}:visibilityCondition`);
      }
      if ((prev.availabilityCondition || '') !== (nextChoice.availabilityCondition || '')) {
        conditionChanges.push(`${sceneKey}:${choiceId}:availabilityCondition`);
      }
    });

    return conditionChanges;
  });

  const previousIssues = previous.project.reports.at(-1)?.issues.length || 0;
  const nextIssues = next.project.reports.at(-1)?.issues.length || 0;

  return {
    routeDiff: {
      ...routeDiffBase,
      modified: modifiedRoutes,
    },
    chapterDiff: {
      ...chapterDiffBase,
      modified: modifiedChapters,
    },
    sceneDiff: {
      ...sceneDiffBase,
      modified: modifiedScenes,
    },
    detailDiff: {
      modifiedScenePackages: modifiedScenes,
      modifiedChoices,
      modifiedReactionVariants,
      modifiedConditions,
    },
    validatorDiff: {
      previous: previousIssues,
      next: nextIssues,
    },
  };
};
