import { getTemplate } from './resources';
import { PromptTemplate } from '../promptTemplate';

export const VISUAL_DESCRIPTION_PROMPT = (characterName: string, tone: string) => {
  // Visual prompting is usually done in English for better model consistency
  return PromptTemplate.from(getTemplate('visual.description', 'en')).format({
    name: characterName,
    tone,
  });
};

export const PORTRAIT_PROMPT = (desc: string) => {
  return PromptTemplate.from(getTemplate('visual.portrait', 'en')).format({ desc });
};
