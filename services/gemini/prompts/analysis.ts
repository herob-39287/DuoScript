
import { AppLanguage } from "../../../types";
import { getTemplate } from "./resources";
import { PromptTemplate } from "../promptTemplate";

export const ANALYST_SOUL = (lang: AppLanguage) => {
  return getTemplate('analysis.analystSoul', lang);
};

export const DETECTOR_SOUL = (lang: AppLanguage) => {
  return getTemplate('analysis.detectorSoul', lang);
};

export const INTEGRITY_SCAN_PROMPT = (lang: AppLanguage, bibleData: string) => {
  return PromptTemplate.from(getTemplate('analysis.integrityScan', lang)).format({ bible: bibleData });
};

export const DETECTION_PROMPT = (userInput: string, lang: AppLanguage = 'ja') => {
  return PromptTemplate.from(getTemplate('analysis.detectorPrompt', lang)).format({ input: userInput });
};

export const PROJECT_GEN_BIBLE_PROMPT = (theme: string, lang: AppLanguage) => {
  return PromptTemplate.from(getTemplate('analysis.muse.bible', lang)).format({ theme });
};

export const INITIAL_CHAPTERS_PROMPT = (bibleJson: string, lang: AppLanguage) => {
  return PromptTemplate.from(getTemplate('analysis.muse.chapters', lang)).format({ bible: bibleJson });
};

export const INITIAL_FORESHADOWING_PROMPT = (bibleJson: string, chaptersJson: string, lang: AppLanguage) => {
  return PromptTemplate.from(getTemplate('analysis.muse.foreshadowing', lang)).format({ 
    bible: bibleJson,
    chapters: chaptersJson
  });
};

export const NEXUS_SIM_PROMPT = (hypothesis: string, context: string, lang: AppLanguage = 'ja') => {
  return PromptTemplate.from(getTemplate('analysis.nexusSim', lang)).format({ 
    hyp: hypothesis,
    ctx: context
  });
};

export const SAFETY_ALTERNATIVES_PROMPT = (input: string, _category: string, lang: AppLanguage = 'ja') => {
  // Input isn't used in the template currently, but kept in signature for API consistency
  return getTemplate('analysis.safetyAlternatives', lang);
};
