
/**
 * Prompt Template Engine
 * Handles variable injection and section management for prompts.
 */

export class PromptTemplate {
  constructor(private template: string) {}

  /**
   * Inject variables into the template.
   * Format: {{key}}
   */
  format(values: Record<string, string | undefined | null>): string {
    return this.template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
      const val = values[key];
      return val !== undefined && val !== null ? val : `{{${key}}}`; // Leave missing keys or replace with empty? Leaving allows multi-pass.
    });
  }

  /**
   * Clean up remaining placeholders.
   */
  clean(): string {
    return this.template.replace(/\{\{(\w+)\}\}/g, '');
  }

  static from(template: string): PromptTemplate {
    return new PromptTemplate(template);
  }

  static join(templates: string[], separator: string = "\n\n"): string {
    return templates.filter(t => t && t.trim().length > 0).join(separator);
  }
}
