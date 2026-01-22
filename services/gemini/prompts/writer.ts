
import { AppLanguage, AiPersona } from "../../../types";
import { PERSONA_INSTRUCTIONS } from "./core";
import { getPrompts } from "./resources";

export const WRITER_MTP = (lang: AppLanguage, persona: AiPersona = AiPersona.STANDARD) => {
  const p = getPrompts(lang);
  return p.writer.mtp(PERSONA_INSTRUCTIONS[persona][lang]);
};

export const COPILOT_SOUL = (lang: AppLanguage) => {
  const p = getPrompts(lang);
  return p.writer.copilotSoul;
};

export const DRAFT_PROMPT = (
  title: string, 
  summary: string, 
  beats: string[], 
  previousContent: string, 
  lang: AppLanguage,
  focusMode: boolean = false
) => {
  const p = getPrompts(lang);
  
  const beatsSection = focusMode 
    ? `【TARGET BEAT (FOCUS)】\n${beats.map(b => `- ${b}`).join("\n")}`
    : `【CHAPTER OUTLINE】\n${beats.map(b => `- ${b}`).join("\n")}`;

  return p.writer.draft(title, summary, beatsSection, previousContent, focusMode);
};

export const NEXT_SENTENCE_PROMPT = (content: string, lang: AppLanguage) => {
  const p = getPrompts(lang);
  return p.writer.nextSentence(content);
};

export const DRAFT_SCAN_PROMPT = (draft: string, lang: AppLanguage = 'ja') => {
  const p = getPrompts(lang);
  return p.writer.draftScan(draft);
};

export const CHAPTER_PACKAGE_PROMPT = (title: string, summary: string, lang: AppLanguage = 'ja') => {
  const p = getPrompts(lang);
  return p.writer.chapterPackage(title, summary);
};
