
import { AppLanguage, AiPersona } from "../../../types";
import { getTemplate } from "./resources";
import { PromptTemplate } from "../promptTemplate";

export const WRITER_MTP = (lang: AppLanguage, persona: AiPersona = AiPersona.STANDARD) => {
  const personaText = getTemplate(`personas.${persona}`, lang);
  return PromptTemplate.from(getTemplate('writer.mtp', lang)).format({ persona: personaText });
};

export const COPILOT_SOUL = (lang: AppLanguage) => {
  return getTemplate('writer.copilotSoul', lang);
};

export const DRAFT_PROMPT = (
  title: string, 
  summary: string, 
  beats: string[], 
  previousContent: string, 
  lang: AppLanguage,
  focusMode: boolean = false
) => {
  const baseTemplate = getTemplate('writer.draft.base', lang);
  
  // Construct beats section
  const beatsSection = focusMode 
    ? `【TARGET BEAT (FOCUS)】\n${beats.map(b => `- ${b}`).join("\n")}`
    : `【CHAPTER OUTLINE】\n${beats.map(b => `- ${b}`).join("\n")}`;

  // Select mission text based on focus mode
  const missionText = focusMode
    ? getTemplate('writer.draft.missions.focus', lang)
    : getTemplate('writer.draft.missions.outline', lang);

  return PromptTemplate.from(baseTemplate).format({
    title,
    summary,
    prev: previousContent,
    mission: missionText,
    beats: beatsSection
  });
};

export const NEXT_SENTENCE_PROMPT = (content: string, lang: AppLanguage) => {
  return PromptTemplate.from(getTemplate('writer.nextSentence', lang)).format({ content });
};

export const DRAFT_SCAN_PROMPT = (draft: string, lang: AppLanguage = 'ja') => {
  return PromptTemplate.from(getTemplate('writer.draftScan', lang)).format({ draft });
};

export const CHAPTER_PACKAGE_PROMPT = (title: string, summary: string, lang: AppLanguage = 'ja') => {
  return PromptTemplate.from(getTemplate('writer.chapterPackage', lang)).format({ title, summary });
};
