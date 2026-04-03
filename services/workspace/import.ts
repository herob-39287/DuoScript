import { StoryProject } from '../../types';
import { normalizeProject } from '../bibleManager';
import {
  compileChapterContentFromScenePackages,
  detectChapterContentDrift,
} from '../scenePackage/chapterAssembler';
import { validateProjectBranches } from '../validation/branchValidator';
import { WorkspaceBundleSchema } from './schema';
import { WorkspaceImportResult } from './types';

export const parseWorkspaceBundle = (raw: unknown) => {
  return WorkspaceBundleSchema.parse(raw);
};

export const workspaceBundleToProject = (
  currentProject: StoryProject,
  raw: unknown,
): WorkspaceImportResult => {
  const bundle = parseWorkspaceBundle(raw);
  const importedAt = Date.now();

  const next: StoryProject = normalizeProject({
    ...currentProject,
    meta: {
      ...currentProject.meta,
      ...bundle.project.meta,
      updatedAt: importedAt,
    },
    bible: {
      ...bundle.project.bible,
      routes: bundle.project.vnDesign.routes,
      revealPlans: bundle.project.vnDesign.revealPlans,
      stateAxes: bundle.project.vnDesign.stateAxes,
      branchPolicies: bundle.project.vnDesign.branchPolicies,
    },
    chapters: bundle.project.chapters.map((chapter) => ({
      ...chapter,
      codexImportedAt: importedAt,
    })),
  });

  const rebuiltChapterIds: string[] = [];
  const rebuiltChapters = next.chapters.map((chapter) => {
    const mode = chapter.authoringMode || (chapter.scenePackages?.length ? 'structured' : 'freeform');
    const hasScenePackages = Boolean(chapter.scenePackages && chapter.scenePackages.length > 0);
    const withLegacyMigrated = {
      ...chapter,
      authoringMode: mode,
      draftText:
        chapter.draftText ??
        (mode === 'freeform' ? chapter.content ?? '' : undefined),
      compiledContent:
        chapter.compiledContent ??
        (mode === 'structured' ? chapter.content ?? '' : undefined),
    };

    if (!hasScenePackages || mode === 'freeform') {
      const draftText = withLegacyMigrated.draftText ?? '';
      return {
        ...withLegacyMigrated,
        draftText,
        compiledContent: withLegacyMigrated.compiledContent ?? draftText,
        wordCount: draftText.length,
      };
    }

    const drift = detectChapterContentDrift(withLegacyMigrated);
    if (!drift.hasDrift) return withLegacyMigrated;

    const rebuilt = compileChapterContentFromScenePackages(withLegacyMigrated);
    rebuiltChapterIds.push(chapter.id);
    return {
      ...withLegacyMigrated,
      compiledContent: rebuilt,
      wordCount: rebuilt.length,
    };
  });

  const finalizedProject: StoryProject = {
    ...next,
    chapters: rebuiltChapters,
  };
  const validationIssueCount = validateProjectBranches(
    finalizedProject.chapters,
    finalizedProject.bible,
  ).length;

  return {
    project: finalizedProject,
    bundle,
    validationIssueCount,
    rebuiltChapterIds,
  };
};
