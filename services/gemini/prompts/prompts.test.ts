
import { describe, it, expect } from 'vitest';
import { PROMPT_DEFINITIONS } from './definitions';

describe('Prompt Definitions Integrity', () => {
  const extractPlaceholders = (text: string) => {
    const matches = text.match(/\{\{(\w+)\}\}/g);
    return matches ? matches.map(m => m.replace(/\{\{|\}\}/g, '')).sort() : [];
  };

  const errors: string[] = [];

  const traverse = (node: any, path: string) => {
    // Check if node is likely a localized string object (has 'ja' or 'en' keys)
    const keys = Object.keys(node);
    const hasLangKey = keys.includes('ja') || keys.includes('en');

    if (hasLangKey) {
      // 1. Check for missing languages
      if (!('ja' in node)) errors.push(`[${path}] Missing 'ja' translation.`);
      if (!('en' in node)) errors.push(`[${path}] Missing 'en' translation.`);

      if ('ja' in node && 'en' in node) {
        const jaText = node.ja;
        const enText = node.en;

        // 2. Check types
        if (typeof jaText !== 'string') errors.push(`[${path}.ja] is not a string.`);
        if (typeof enText !== 'string') errors.push(`[${path}.en] is not a string.`);

        // 3. Check Placeholders consistency
        if (typeof jaText === 'string' && typeof enText === 'string') {
          const jaVars = extractPlaceholders(jaText);
          const enVars = extractPlaceholders(enText);
          
          // Check for mismatch
          const jaMissing = enVars.filter(v => !jaVars.includes(v));
          const enMissing = jaVars.filter(v => !enVars.includes(v));

          if (jaMissing.length > 0) {
            errors.push(`[${path}] 'ja' is missing placeholders found in 'en': ${jaMissing.join(', ')}`);
          }
          if (enMissing.length > 0) {
            errors.push(`[${path}] 'en' is missing placeholders found in 'ja': ${enMissing.join(', ')}`);
          }
        }
      }
      // Stop traversal at leaf (localized string object)
      return;
    }

    // Continue traversal for nested objects
    if (typeof node === 'object' && node !== null) {
      for (const key in node) {
        // Skip prototype properties
        if (Object.prototype.hasOwnProperty.call(node, key)) {
          traverse(node[key], path ? `${path}.${key}` : key);
        }
      }
    }
  };

  it('should have consistent ja/en translations and placeholders', () => {
    traverse(PROMPT_DEFINITIONS, 'PROMPT_DEFINITIONS');

    if (errors.length > 0) {
      throw new Error(`Prompt Integrity Check Failed:\n${errors.join('\n')}`);
    }
  });
});
