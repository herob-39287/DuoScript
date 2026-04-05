import { StoryProject } from '../../types';
import { normalizeProject } from '../bibleManager';
import {
  compileChapterContentFromScenePackages,
  detectChapterContentDrift,
} from '../scenePackage/chapterAssembler';
import { validateProjectBranches } from '../validation/branchValidator';
import { WorkspaceBundleSchema } from './schema';
import { WorkspaceImportResult } from './types';
import { CodexOpsArtifactSchema, CodexQuestionsArtifactSchema } from './patchSchema';
import { CodexOpsArtifact, CodexQuestionsArtifact } from './patchTypes';

export type ParsedCodexArtifact =
  | { type: 'bundle'; bundle: unknown }
  | { type: 'ops'; ops: CodexOpsArtifact }
  | { type: 'questions'; questions: CodexQuestionsArtifact }
  | { type: 'questions'; questions: CodexQuestionsArtifact; source: 'markdown' };

export const parseWorkspaceBundle = (raw: unknown) => {
  return WorkspaceBundleSchema.parse(raw);
};

const parseQuestionsMarkdown = (rawText: string): string[] => {
  return rawText
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('- ') || /^\d+\./.test(line))
    .map((line) => line.replace(/^-\s*/, '').replace(/^\d+\.\s*/, '').trim())
    .filter(Boolean);
};

export const detectCodexArtifact = (raw: unknown, fallbackText?: string): ParsedCodexArtifact => {
  if (raw && typeof raw === 'object' && 'kind' in raw) {
    const kind = (raw as { kind?: string }).kind;
    if (kind === 'duoscript.workspace') return { type: 'bundle', bundle: raw };
    if (kind === 'duoscript.codex.ops') {
      return { type: 'ops', ops: CodexOpsArtifactSchema.parse(raw) };
    }
    if (kind === 'duoscript.codex.questions') {
      return { type: 'questions', questions: CodexQuestionsArtifactSchema.parse(raw) };
    }
  }

  if (typeof fallbackText === 'string' && fallbackText.trim().length > 0) {
    const questions = parseQuestionsMarkdown(fallbackText);
    if (questions.length > 0) {
      return {
        type: 'questions',
        source: 'markdown',
        questions: {
          kind: 'duoscript.codex.questions',
          version: 1,
          generatedAt: Date.now(),
          taskType: 'interactive refinement',
          responseMode: 'questions',
          questions,
        },
      };
    }
  }

  throw new Error('Unsupported Codex artifact format.');
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
    const mode =
      chapter.authoringMode || (chapter.scenePackages?.length ? 'structured' : 'freeform');
    const hasScenePackages = Boolean(chapter.scenePackages && chapter.scenePackages.length > 0);
    const withLegacyMigrated = {
      ...chapter,
      authoringMode: mode,
      draftText: chapter.draftText ?? (mode === 'freeform' ? (chapter.content ?? '') : undefined),
      compiledContent:
        chapter.compiledContent ?? (mode === 'structured' ? (chapter.content ?? '') : undefined),
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
