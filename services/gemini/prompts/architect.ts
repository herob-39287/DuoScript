
import { AppLanguage, AiPersona } from "../../../types";
import { PERSONA_INSTRUCTIONS } from "./core";
import { getPrompts } from "./resources";

export const ARCHITECT_MTP = (lang: AppLanguage, persona: AiPersona = AiPersona.STANDARD) => {
  const p = getPrompts(lang);
  return p.architect.mtp(PERSONA_INSTRUCTIONS[persona][lang]);
};

export const EXTRACTOR_SOUL_ENTITIES = (lang: AppLanguage) => {
  const p = getPrompts(lang);
  return `${p.architect.extractor.entities}\n${p.core.languageConstraint}`;
};

export const EXTRACTOR_SOUL_FOUNDATION = (lang: AppLanguage) => {
  const p = getPrompts(lang);
  return `${p.architect.extractor.foundation}\n${p.core.languageConstraint}`;
};

export const EXTRACTOR_SOUL_NARRATIVE = (lang: AppLanguage) => {
  const p = getPrompts(lang);
  return `${p.architect.extractor.narrative}\n${p.core.languageConstraint}`;
};

export const EXTRACTOR_SOUL_FORESHADOWING = (lang: AppLanguage) => {
  const p = getPrompts(lang);
  return `${p.architect.extractor.foreshadowing}\n${p.core.languageConstraint}`;
};

export const SYNC_EXTRACTOR_SOUL = (lang: AppLanguage) => {
  const p = getPrompts(lang);
  return `${p.architect.extractor.sync}\n${p.core.languageConstraint}`;
};

export const CHAT_SUMMARIZATION_PROMPT = (currentMemory: string, oldMessages: any[], lang: AppLanguage = 'ja') => {
  const p = getPrompts(lang);
  return p.architect.summarization(currentMemory);
};

export const WHISPER_SOUL = (lang: AppLanguage) => {
  const p = getPrompts(lang);
  return `${p.architect.whisperSoul}\n${p.core.languageConstraint}`;
};

export const WHISPER_PROMPT = (lang: AppLanguage = 'ja') => {
  const p = getPrompts(lang);
  return p.architect.whisperPrompt;
};

export const GENESIS_FILL_PROMPT = (fieldLabel: string, currentProfile: string, worldContext: string, lang: AppLanguage) => {
  const p = getPrompts(lang);
  return p.architect.genesisFill(fieldLabel, currentProfile, worldContext);
};

export const AUTO_FILL_ITEM_PROMPT = (itemType: string, itemName: string, fieldLabel: string, currentItemJson: string, worldContext: string, lang: AppLanguage) => {
  const p = getPrompts(lang);
  return p.architect.autoFill(itemType, itemName, fieldLabel, currentItemJson, worldContext);
};

export const BRAINSTORM_PROMPT = (itemType: string, taskDescription: string, currentJson: string, worldContext: string, fieldHints: string, lang: AppLanguage) => {
  const p = getPrompts(lang);
  return p.architect.brainstorm(itemType, taskDescription, currentJson, worldContext, fieldHints);
};
