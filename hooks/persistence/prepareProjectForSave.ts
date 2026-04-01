import { StoryProject } from '../../types';
import {
  syncChapterContentFromScenePackages,
  validateChapterScenePackages,
  validateProjectBranches,
} from '../../services/scenePackage';

export type SaveValidationIssue = {
  level: 'error' | 'warning';
  message: string;
};

export type SavePreparationResult = {
  projectToSave: StoryProject;
  didSyncChapterContent: boolean;
  issues: SaveValidationIssue[];
  blockingIssues: SaveValidationIssue[];
};

const toIssue = (
  issue: { level: 'error' | 'warning'; message: string },
): SaveValidationIssue => ({
  level: issue.level,
  message: issue.message,
});

export const prepareProjectForSave = (project: StoryProject): SavePreparationResult => {
  const syncedChapters = project.chapters.map((chapter) => syncChapterContentFromScenePackages(chapter));

  const didSyncChapterContent = syncedChapters.some(
    (chapter, idx) => chapter.content !== project.chapters[idx].content,
  );

  const chapterIssues = syncedChapters.flatMap((chapter) =>
    validateChapterScenePackages(chapter, project.bible).map(toIssue),
  );
  const projectIssues = validateProjectBranches(syncedChapters, project.bible).map(toIssue);
  const issues = [...chapterIssues, ...projectIssues];
  const blockingIssues = issues.filter((issue) => issue.level === 'error');

  const projectToSave = didSyncChapterContent
    ? { ...project, chapters: syncedChapters }
    : project;

  return {
    projectToSave,
    didSyncChapterContent,
    issues,
    blockingIssues,
  };
};

