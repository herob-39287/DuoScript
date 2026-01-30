/**
 * Prompt Template Engine
 * Handles variable injection and section management for prompts.
 * Enforces strict variable presence to prevent undefined placeholders.
 */

export class PromptTemplate {
  constructor(private template: string) {}

  /**
   * Inject variables into the template.
   * Format: {{key}}
   * Throws error if a placeholder exists in template but value is missing.
   */
  format(values: Record<string, string | number | undefined | null>): string {
    return this.template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      const val = values[key];
      if (val === undefined || val === null) {
        throw new Error(`PromptTemplate Error: Missing value for variable "{{${key}}}"`);
      }
      return String(val);
    });
  }

  /**
   * Clean up remaining placeholders (use with caution, mostly for optional sections).
   */
  clean(): string {
    return this.template.replace(/\{\{(\w+)\}\}/g, '');
  }

  static from(template: string): PromptTemplate {
    return new PromptTemplate(template);
  }

  static join(templates: string[], separator: string = '\n\n'): string {
    return templates.filter((t) => t && t.trim().length > 0).join(separator);
  }
}
