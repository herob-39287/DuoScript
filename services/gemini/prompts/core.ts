
export const COMMON_JSON_RULE = `
# ABSOLUTE COMPLIANCE RULE:
- Your response MUST be valid JSON only.
- PROHIBITED: Conversational text, Markdown wrappers (json), and explanations.
`.trim();

export const STRICT_JSON_ENFORCEMENT = COMMON_JSON_RULE;

export type PromptResource = {
  [key: string]: string | ((...args: any[]) => string) | PromptResource;
};
