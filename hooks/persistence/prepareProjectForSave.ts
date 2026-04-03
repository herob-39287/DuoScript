import { StoryProject } from '../../types';
import {
  syncChapterCompiledContentFromScenePackages,
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

const toIssue = (issue: { level: 'error' | 'warning'; message: string }): SaveValidationIssue => ({
  level: issue.level,
  message: issue.message,
});

export const prepareProjectForSave = (project: StoryProject): SavePreparationResult => {
  const syncedChapters = project.chapters.map((chapter) => {
    const authoringMode = chapter.authoringMode || 'freeform';
    const legacyContent = chapter.content ?? '';

    if (authoringMode === 'structured') {
      return syncChapterCompiledContentFromScenePackages({
        ...chapter,
        authoringMode,
        compiledContent: chapter.compiledContent ?? legacyContent,
      });
    }

    const draftText = chapter.draftText ?? legacyContent;
    return {
      ...chapter,
      authoringMode,
      draftText,
      compiledContent: chapter.compiledContent ?? draftText,
      wordCount: draftText.length,
    };
  });

  const didSyncChapterContent = syncedChapters.some(
    (chapter, idx) =>
      chapter.compiledContent !== project.chapters[idx].compiledContent ||
      chapter.draftText !== project.chapters[idx].draftText ||
      chapter.authoringMode !== (project.chapters[idx].authoringMode || 'freeform'),
  );

  const chapterIssues = syncedChapters.flatMap((chapter) =>
    validateChapterScenePackages(chapter, project.bible).map(toIssue),
  );
  const projectIssues = validateProjectBranches(syncedChapters, project.bible).map(toIssue);
  const issues = [...chapterIssues, ...projectIssues];
  const blockingIssues = issues.filter((issue) => issue.level === 'error');

  const projectToSave = didSyncChapterContent ? { ...project, chapters: syncedChapters } : project;

  return {
    projectToSave,
    didSyncChapterContent,
    issues,
    blockingIssues,
  };
};
