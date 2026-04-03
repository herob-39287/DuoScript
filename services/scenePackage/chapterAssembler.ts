import { ChapterLog, ScenePackage } from '../validation/schemas';

const stringifyList = (items: string[]): string => (items.length > 0 ? items.join('、') : '');

export const buildScenePackageCanonicalText = (scenePackage: ScenePackage): string => {
  const header = `## ${scenePackage.title} (${scenePackage.sceneId})`;
  const purpose = scenePackage.purpose ? `目的: ${scenePackage.purpose}` : '';
  const mandatoryInfo = scenePackage.mandatoryInfo.length
    ? `必須情報: ${stringifyList(scenePackage.mandatoryInfo)}`
    : '';

  const shared = [
    scenePackage.sharedSpine.intro,
    scenePackage.sharedSpine.conflict,
    scenePackage.sharedSpine.deepen,
    scenePackage.sharedSpine.preChoiceBeat,
    scenePackage.sharedSpine.close,
  ]
    .filter(Boolean)
    .join('\n');

  const variants = scenePackage.reactionVariants
    .map((variant) => `- [${variant.variantId}] ${variant.responseBlocks.join(' ')}`)
    .join('\n');

  const convergence = scenePackage.convergencePoint
    ? `合流: ${scenePackage.convergencePoint.targetBlockId} (${scenePackage.convergencePoint.convergencePolicy})`
    : '';

  return [header, purpose, mandatoryInfo, shared, variants ? `差分:\n${variants}` : '', convergence]
    .filter(Boolean)
    .join('\n\n')
    .trim();
};

const getLegacyChapterContent = (chapter: ChapterLog): string => {
  if (chapter.compiledContent !== undefined) return chapter.compiledContent || '';
  if (chapter.content !== undefined) return chapter.content || '';
  return chapter.draftText || '';
};

export const compileChapterContentFromScenePackages = (chapter: ChapterLog): string => {
  const scenePackages = chapter.scenePackages || [];
  if (scenePackages.length === 0) {
    return getLegacyChapterContent(chapter);
  }

  return scenePackages.map(buildScenePackageCanonicalText).join('\n\n---\n\n');
};

export const syncChapterCompiledContentFromScenePackages = (chapter: ChapterLog): ChapterLog => {
  if (chapter.authoringMode === 'freeform') {
    const draftText = chapter.draftText ?? chapter.content ?? '';
    return {
      ...chapter,
      draftText,
      compiledContent: chapter.compiledContent ?? draftText,
      wordCount: draftText.length,
    };
  }

  const nextContent = compileChapterContentFromScenePackages(chapter);
  return {
    ...chapter,
    compiledContent: nextContent,
    wordCount: nextContent.length,
  };
};

export const detectChapterContentDrift = (
  chapter: ChapterLog,
): {
  hasDrift: boolean;
  canonicalContent: string;
} => {
  const canonicalContent = compileChapterContentFromScenePackages(chapter);
  const current = chapter.compiledContent ?? chapter.content ?? '';
  return {
    hasDrift: canonicalContent !== current,
    canonicalContent,
  };
};
