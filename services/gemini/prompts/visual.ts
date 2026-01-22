
import { getPrompts } from "./resources";

// Visual prompting is usually done in English for better consistency with current models,
// but we use the 'en' resource primarily. If localized visual prompting is needed, pass 'ja'.
export const VISUAL_DESCRIPTION_PROMPT = (character: any, tone: string) => {
  const p = getPrompts('en');
  return p.visual.description(character.profile.name, tone);
};

export const PORTRAIT_PROMPT = (desc: string) => {
  const p = getPrompts('en');
  return p.visual.portrait(desc);
};
