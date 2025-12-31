
import { AiModel, StoryProject, ChapterLog, UsageCallback, LogCallback, ExtractionResult, ChapterPackageResponse } from "../../../types";
import { runGeminiRequest, getClient } from "../core";
import { PromptBuilder } from "../promptBuilder";
import { withRetry, safeJsonParse, getSafetySettings } from "../utils";
import * as Prompts from "../prompts";
import * as Schemas from "../schemas";
import { Type } from "@google/genai";

export class WriterAgent {
  constructor(private onUsage?: UsageCallback, private logCallback: LogCallback = () => {}) {}

  async* streamDraft(chapter: ChapterLog, tone: string, usePro: boolean, project: StoryProject) {
    const ai = getClient();
    const context = PromptBuilder.buildTieredContext(project, chapter.id);
    const systemInstruction = PromptBuilder.writerSystem(context, tone);
    const prompt = Prompts.DRAFT_PROMPT(chapter.title, chapter.summary, chapter.beats);

    const result = await withRetry(async () => {
      return await ai.models.generateContentStream({
        model: usePro ? AiModel.REASONING : AiModel.FAST,
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: { systemInstruction, safetySettings: getSafetySettings() }
      });
    }, 'Writer', this.logCallback);

    for await (const chunk of result) {
      if (chunk.candidates?.[0]?.finishReason === 'SAFETY') throw new Error("SAFETY_BLOCK");
      yield chunk;
    }
  }

  async suggest(content: string, project: StoryProject, activeChapterId: string): Promise<string[]> {
    const context = PromptBuilder.buildTieredContext(project, activeChapterId);
    return runGeminiRequest({
      model: AiModel.FAST,
      contents: Prompts.NEXT_SENTENCE_PROMPT(content, context),
      config: { responseMimeType: "application/json", responseSchema: Schemas.suggestionsSchema },
      usageLabel: 'Writer/Copilot',
      onUsage: this.onUsage,
      logCallback: this.logCallback,
      mapper: (res) => safeJsonParse<string[]>(res.text, 'Copilot').value || Schemas.DEFAULT_RESPONSES.SUGGESTIONS
    });
  }

  async scanDraft(draft: string, project: StoryProject, activeChapterId: string, processOps: (json: any) => ExtractionResult): Promise<ExtractionResult> {
    const context = PromptBuilder.buildTieredContext(project, activeChapterId);
    return runGeminiRequest({
      model: AiModel.REASONING,
      contents: Prompts.DRAFT_SCAN_PROMPT(draft, context),
      config: {
        responseMimeType: "application/json",
        responseSchema: { type: Type.ARRAY, items: Schemas.syncOperationSchema }
      },
      usageLabel: 'NeuralSync/DraftScanner',
      onUsage: this.onUsage,
      logCallback: this.logCallback,
      mapper: (res) => processOps(res.text)
    });
  }

  async generatePackage(project: StoryProject, chapter: ChapterLog): Promise<ChapterPackageResponse> {
    const context = PromptBuilder.buildTieredContext(project, chapter.id);
    return runGeminiRequest({
      model: AiModel.REASONING,
      contents: Prompts.CHAPTER_PACKAGE_PROMPT(chapter.title, chapter.summary, context),
      config: { responseMimeType: "application/json", responseSchema: Schemas.chapterPackageSchema },
      usageLabel: 'Writer/Package',
      onUsage: this.onUsage,
      logCallback: this.logCallback,
      mapper: (res) => safeJsonParse<ChapterPackageResponse>(res.text, 'Writer').value || Schemas.DEFAULT_RESPONSES.CHAPTER_PACKAGE
    });
  }
}
