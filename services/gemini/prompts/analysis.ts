
import { AppLanguage } from "../../../types";
import { getPrompts } from "./resources";

export const ANALYST_SOUL = (lang: AppLanguage) => {
  const p = getPrompts(lang);
  return p.analysis.analystSoul;
};

export const DETECTOR_SOUL = (lang: AppLanguage) => {
  const p = getPrompts(lang);
  return p.analysis.detectorSoul;
};

export const INTEGRITY_SCAN_PROMPT = (lang: AppLanguage, bibleData: string) => {
  const p = getPrompts(lang);
  return p.analysis.integrityScan(bibleData);
};

export const DETECTION_PROMPT = (userInput: string, lang: AppLanguage = 'ja') => {
  const p = getPrompts(lang);
  return p.analysis.detectorPrompt(userInput);
};

export const PROJECT_GEN_BIBLE_PROMPT = (theme: string, lang: AppLanguage) => {
  const p = getPrompts(lang);
  return p.analysis.muse.bible(theme);
};

export const INITIAL_CHAPTERS_PROMPT = (bibleJson: string, lang: AppLanguage) => {
  const p = getPrompts(lang);
  return p.analysis.muse.chapters(bibleJson);
};

export const INITIAL_FORESHADOWING_PROMPT = (bibleJson: string, chaptersJson: string, lang: AppLanguage) => {
  const p = getPrompts(lang);
  return p.analysis.muse.foreshadowing(bibleJson, chaptersJson);
};

export const NEXUS_SIM_PROMPT = (hypothesis: string, context: string, lang: AppLanguage = 'ja') => {
  const p = getPrompts(lang);
  return p.analysis.nexusSim(hypothesis, context);
};

export const SAFETY_ALTERNATIVES_PROMPT = (input: string, category: string, lang: AppLanguage = 'ja') => {
  const p = getPrompts(lang);
  return p.analysis.safetyAlternatives(input);
};
