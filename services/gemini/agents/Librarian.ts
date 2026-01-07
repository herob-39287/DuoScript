
import { AiModel, StoryProject, UsageCallback, LogCallback } from "../../../types";
import { runGeminiRequest } from "../core";
import { safeJsonParse } from "../utils";
import { Type } from "@google/genai";
import * as Prompts from "../prompts";
import { ragService } from "../../ragService";

export class LibrarianAgent {
  constructor(private onUsage?: UsageCallback, private logCallback: LogCallback = () => {}) {}

  /**
   * 文脈から「今詳細が必要な項目」を特定する。
   * RAG (Lexical + Vector) で候補を絞り込み、LLMで最終決定する。
   */
  async identifyRelevantEntities(text: string, project: StoryProject): Promise<string[]> {
    const textSnippet = text.slice(-2000);
    
    // Step 1: Hybrid Search (RAG)
    // テキスト全体から関連性の高いエンティティを検索
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
以下の文章の文脈において、詳細な設定（動機、過去、能力等）を参照する必要がある項目のIDを特定してください。
単に名前が出ただけでなく、その設定が物語の整合性に深く関わるものを選んでください。

【文章】
"${textSnippet}"

【候補リスト (Pre-filtered)】
${JSON.stringify(candidatesForPrompt)}
`.trim();

    return runGeminiRequest({
      model: AiModel.FAST,
      contents: prompt,
      config: {
        systemInstruction: `${Prompts.LIBRARIAN_SOUL}\n\n${Prompts.STRICT_JSON_ENFORCEMENT}`,
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
