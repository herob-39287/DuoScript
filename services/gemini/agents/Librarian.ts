
import { AiModel, StoryProject, UsageCallback, LogCallback } from "../../../types";
import { runGeminiRequest } from "../core";
import { safeJsonParse } from "../utils";
import { Type } from "@google/genai";
import * as Prompts from "../prompts";
import { ragService } from "../../ragService";

export class LibrarianAgent {
  constructor(private onUsage?: UsageCallback, private logCallback: LogCallback = () => {}) {}

  async identifyRelevantEntities(text: string, project: StoryProject): Promise<string[]> {
    const textSnippet = text.slice(-2000);
    const lang = project.meta.language || 'ja';
    
    // Step 1: Hybrid Search (RAG)
    const contextQuery = `${textSnippet}\n${project.sync.chatHistory.slice(-2).map(m => m.content).join("\n")}`.slice(-1000);
    
    const ragResults = await ragService.hybridSearch(contextQuery, project, 20); // Top 20

    if (ragResults.length === 0) return [];

    // Step 2: LLM Re-ranking (Tier 3)
    const candidatesForPrompt = ragResults.map(r => ({
      id: r.id,
      name: r.name,
      type: r.type,
      relevance: r.reason
    }));

    const prompt = `
Identify the IDs of items whose detailed settings (motives, past, abilities, etc.) need to be referenced in the context of the following text.
Select only those deeply relevant to story consistency, not just mentions.

【TEXT】
"${textSnippet}"

【CANDIDATES】
${JSON.stringify(candidatesForPrompt)}
`.trim();

    return runGeminiRequest({
      model: AiModel.FAST,
      contents: prompt,
      config: {
        systemInstruction: `${Prompts.LIBRARIAN_SOUL(lang)}\n\n${Prompts.STRICT_JSON_ENFORCEMENT}`,
        responseMimeType: "application/json",
        responseSchema: { type: Type.ARRAY, items: { type: Type.STRING } }
      },
      usageLabel: 'Librarian/ContextAnalysis',
      onUsage: this.onUsage,
      logCallback: this.logCallback,
      mapper: (res) => safeJsonParse<string[]>(res.text, 'Librarian').value || []
    });
  }
}
