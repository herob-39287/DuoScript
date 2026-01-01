
import { AiModel, StoryProject, UsageCallback, LogCallback } from "../../../types";
import { runGeminiRequest } from "../core";
import { safeJsonParse } from "../utils";
import { Type } from "@google/genai";
import * as Prompts from "../prompts";

export class LibrarianAgent {
  constructor(private onUsage?: UsageCallback, private logCallback: LogCallback = () => {}) {}

  /**
   * 文脈から「今詳細が必要な項目」を特定する。
   * 全項目を送るのではなく、キーワードマッチングで候補を絞ってからAIに判断させることでトークンを節約。
   */
  async identifyRelevantEntities(text: string, project: StoryProject): Promise<string[]> {
    const textSnippet = text.slice(-2000).toLowerCase();
    
    // Step 1: 単純なキーワードマッチングで候補を絞る (AIに送るリストを最小化)
    const candidates = [
      ...project.bible.characters.map(c => ({ id: c.id, name: c.profile.name })),
      ...project.bible.entries.map(e => ({ id: e.id, name: e.title })),
      ...project.bible.locations.map(l => ({ id: l.id, name: l.name }))
    ].filter(item => 
      textSnippet.includes(item.name.toLowerCase()) || 
      (project.sync.chatHistory.slice(-2).some(h => h.content.toLowerCase().includes(item.name.toLowerCase())))
    );

    if (candidates.length === 0) return [];
    if (candidates.length > 30) {
      // 候補が多すぎる場合はさらに絞る
      candidates.splice(30);
    }

    const prompt = `
以下の文章の文脈において、詳細な設定（動機、過去、能力等）を参照する必要がある項目のIDを特定してください。
単に名前が出ただけでなく、その設定が物語の整合性に深く関わるものを選んでください。

【文章】
"${text.slice(-1000)}"

【候補リスト】
${JSON.stringify(candidates)}
`.trim();

    return runGeminiRequest({
      model: AiModel.FAST,
      contents: prompt,
      config: {
        systemInstruction: `${Prompts.LIBRARIAN_SOUL}\n\n${Prompts.STRICT_JSON_ENFORCEMENT}`,
        responseMimeType: "application/json",
        responseSchema: { type: Type.ARRAY, items: { type: Type.STRING } }
      },
      usageLabel: 'Librarian',
      onUsage: this.onUsage,
      logCallback: this.logCallback,
      mapper: (res) => safeJsonParse<string[]>(res.text, 'Librarian').value || []
    });
  }
}
