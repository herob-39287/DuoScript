
import { AppLanguage, AiPersona } from "../../../types";
import { getTemplate } from "./resources";
import { PromptTemplate } from "../promptTemplate";

export const ARCHITECT_MTP = (lang: AppLanguage, persona: AiPersona = AiPersona.STANDARD) => {
  const personaText = getTemplate(`personas.${persona}`, lang);
  return PromptTemplate.from(getTemplate('architect.mtp', lang)).format({ persona: personaText });
};

export const EXTRACTOR_SOUL_ENTITIES = (lang: AppLanguage) => {
  const base = getTemplate('architect.extractor.entities', lang);
  const constraint = getTemplate('core.languageConstraint', lang);
  return `${base}\n${constraint}`;
};

export const EXTRACTOR_SOUL_FOUNDATION = (lang: AppLanguage) => {
  const base = getTemplate('architect.extractor.foundation', lang);
  const constraint = getTemplate('core.languageConstraint', lang);
  return `${base}\n${constraint}`;
};

export const EXTRACTOR_SOUL_NARRATIVE = (lang: AppLanguage) => {
  const base = getTemplate('architect.extractor.narrative', lang);
  const constraint = getTemplate('core.languageConstraint', lang);
  return `${base}\n${constraint}`;
};

export const EXTRACTOR_SOUL_FORESHADOWING = (lang: AppLanguage) => {
  const base = getTemplate('architect.extractor.foreshadowing', lang);
  const constraint = getTemplate('core.languageConstraint', lang);
  return `${base}\n${constraint}`;
};

export const SYNC_EXTRACTOR_SOUL = (lang: AppLanguage) => {
  const base = getTemplate('architect.extractor.sync', lang);
  const constraint = getTemplate('core.languageConstraint', lang);
  return `${base}\n${constraint}`;
};

export const CHAT_SUMMARIZATION_PROMPT = (currentMemory: string, _oldMessages: any[], lang: AppLanguage = 'ja') => {
  return PromptTemplate.from(getTemplate('architect.summarization', lang)).format({ 
    memory: currentMemory || "None" 
  });
};

export const WHISPER_SOUL = (lang: AppLanguage) => {
  const base = getTemplate('architect.whisperSoul', lang);
  const constraint = getTemplate('core.languageConstraint', lang);
  return `${base}\n${constraint}`;
};

export const WHISPER_PROMPT = (lang: AppLanguage = 'ja') => {
  return getTemplate('architect.whisperPrompt', lang);
};

export const GENESIS_FILL_PROMPT = (fieldLabel: string, currentProfile: string, worldContext: string, lang: AppLanguage) => {
  return PromptTemplate.from(getTemplate('architect.genesisFill', lang)).format({
    field: fieldLabel,
    profile: currentProfile,
    world: worldContext
  });
};

export const AUTO_FILL_ITEM_PROMPT = (itemType: string, itemName: string, fieldLabel: string, currentItemJson: string, worldContext: string, lang: AppLanguage) => {
  return PromptTemplate.from(getTemplate('architect.autoFill', lang)).format({
    type: itemType,
    name: itemName,
    field: fieldLabel,
    item: currentItemJson,
    world: worldContext
  });
};

export const BRAINSTORM_PROMPT = (itemType: string, taskDescription: string, currentJson: string, worldContext: string, fieldHints: string, lang: AppLanguage) => {
  return PromptTemplate.from(getTemplate('architect.brainstorm', lang)).format({
    task: taskDescription,
    json: currentJson,
    world: worldContext,
    type: itemType,
    hints: fieldHints
  });
};
