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

export const buildChapterDraftFromScenePackages = (chapter: ChapterLog): string => {
  const scenePackages = chapter.scenePackages || [];
  if (scenePackages.length === 0) {
    return chapter.content || '';
  }

  return scenePackages.map(buildScenePackageCanonicalText).join('\n\n---\n\n');
};

export const syncChapterContentFromScenePackages = (chapter: ChapterLog): ChapterLog => {
  const nextContent = buildChapterDraftFromScenePackages(chapter);
  return {
    ...chapter,
    content: nextContent,
    wordCount: nextContent.length,
  };
};

export const detectChapterContentDrift = (
  chapter: ChapterLog,
): {
  hasDrift: boolean;
  canonicalContent: string;
} => {
  const canonicalContent = buildChapterDraftFromScenePackages(chapter);
  const current = chapter.content || '';
  return {
    hasDrift: canonicalContent !== current,
    canonicalContent,
  };
};
