import { AppLanguage } from '../../../types';
import { PROMPT_DEFINITIONS } from './definitions';
import { STRICT_JSON_ENFORCEMENT } from './core';

export { STRICT_JSON_ENFORCEMENT };

// Flatten the nested structure for easy access if needed, or provide a helper
// Here we provide a helper to get the raw string for a specific path and language.

type NestedStringObject = { [key: string]: string | NestedStringObject };

/**
 * Retrieves a prompt template from the manifest.
 * @param path Dot-separated path to the prompt (e.g., 'architect.mtp')
 * @param lang 'ja' or 'en'
 */
export const getTemplate = (path: string, lang: AppLanguage): string => {
  const parts = path.split('.');
  let current: any = PROMPT_DEFINITIONS;

  for (const part of parts) {
    if (current[part] === undefined) {
      console.error(`Prompt template not found: ${path} (${lang})`);
      return '';
    }
    current = current[part];
  }

  // At the leaf, we expect an object with 'ja' and 'en' keys
  if (typeof current[lang] === 'string') {
    return current[lang];
  }

  // Fallback to English if key exists but lang is missing (should not happen with strict types)
  if (typeof current['en'] === 'string') {
    return current['en'];
  }

  console.error(`Prompt definition at ${path} is not a valid localized string object.`);
  return '';
};
