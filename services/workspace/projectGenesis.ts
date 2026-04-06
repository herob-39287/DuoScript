import { StoryProject } from '../../types';

export const isStarterProject = (project: StoryProject): boolean => {
  const hasRouteDesign =
    (project.bible.routes?.length || 0) > 0 ||
    (project.bible.revealPlans?.length || 0) > 0 ||
    (project.bible.stateAxes?.length || 0) > 0 ||
    (project.bible.branchPolicies?.length || 0) > 0;
  if (hasRouteDesign) return false;

  return !project.chapters.some((chapter) => {
    if ((chapter.scenePackages?.length || 0) > 0) return true;
    if ((chapter.draftText || '').trim().length > 0) return true;
    if ((chapter.compiledContent || '').trim().length > 0) return true;
    if ((chapter.content || '').trim().length > 0) return true;
    return false;
  });
};
