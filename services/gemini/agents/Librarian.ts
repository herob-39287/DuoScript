
import { AiModel, StoryProject, UsageCallback, LogCallback } from "../../../types";
import { runGeminiRequest } from "../core";
import { safeJsonParse } from "../utils";
import { Type } from "@google/genai";

export class LibrarianAgent {
  constructor(private onUsage?: UsageCallback, private logCallback: LogCallback = () => {}) {}

  async identifyRelevantEntities(text: string, project: StoryProject): Promise<string[]> {
    const bibleCompact = {
      characters: project.bible.characters.map(c => ({ id: c.id, name: c.profile.name })),
      entries: project.bible.entries.map(e => ({ id: e.id, title: e.title })),
      items: project.bible.keyItems.map(k => ({ id: k.id, name: k.name })),
      locations: project.bible.locations.map(l => ({ id: l.id, name: l.name }))
    };

    const prompt = `以下の内容に関係する設定項目のIDリストを抽出してください。\n【内容】\n"${text.slice(-2000)}"\n【設定】\n${JSON.stringify(bibleCompact)}`;

    return runGeminiRequest({
      model: AiModel.FAST,
      contents: prompt,
      config: {
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
