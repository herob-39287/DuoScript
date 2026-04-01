import { WorkspaceBundle } from './types';

export type WorkspaceDiff = {
  routeDiff: { added: string[]; removed: string[] };
  chapterDiff: { added: string[]; removed: string[] };
  sceneDiff: { added: string[]; removed: string[] };
  validatorDiff: { previous: number; next: number };
};

const toSet = (values: string[]) => new Set(values.filter(Boolean));

const setDiff = (before: Set<string>, after: Set<string>) => ({
  added: [...after].filter((id) => !before.has(id)),
  removed: [...before].filter((id) => !after.has(id)),
});

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
      (chapter.scenePackages || []).map((scenePackage) => scenePackage.sceneId),
    ),
  );
  const nextScenes = toSet(
    next.project.chapters.flatMap((chapter) =>
      (chapter.scenePackages || []).map((scenePackage) => scenePackage.sceneId),
    ),
  );

  const previousIssues = previous.project.reports.at(-1)?.issues.length || 0;
  const nextIssues = next.project.reports.at(-1)?.issues.length || 0;

  return {
    routeDiff: setDiff(previousRoutes, nextRoutes),
    chapterDiff: setDiff(previousChapters, nextChapters),
    sceneDiff: setDiff(previousScenes, nextScenes),
    validatorDiff: {
      previous: previousIssues,
      next: nextIssues,
    },
  };
};
