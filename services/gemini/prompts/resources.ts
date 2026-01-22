
import { AppLanguage } from "../../../types";
import { JA_PROMPTS } from "./ja";
import { EN_PROMPTS } from "./en";
export { STRICT_JSON_ENFORCEMENT, PromptResource } from "./core";

export const getPrompts = (lang: AppLanguage) => lang === 'ja' ? JA_PROMPTS : EN_PROMPTS;
