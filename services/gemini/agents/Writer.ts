
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
    
    const systemInstruction = Prompts.WRITER_MTP.replace('{{TONE}}', tone);
    const storyData = PromptBuilder.buildStructuredStoryData(project, chapter.id);
    
    const userPrompt = `
【STORY_DATA (JSON)】
${storyData}

${Prompts.DRAFT_PROMPT(chapter.title, chapter.summary, chapter.beats)}
`.trim();

    const result = await withRetry(async () => {
      return await ai.models.generateContentStream({
        model: usePro ? AiModel.REASONING : AiModel.FAST,
        contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
        config: { systemInstruction, safetySettings: getSafetySettings() }
      });
    }, 'Writer', this.logCallback);

    for await (const chunk of result) {
      if (chunk.candidates?.[0]?.finishReason === 'SAFETY') throw new Error("SAFETY_BLOCK");
      yield chunk;
    }
  }

  async suggest(content: string, project: StoryProject, activeChapterId: string): Promise<string[]> {
    const storyData = PromptBuilder.buildStructuredStoryData(project, activeChapterId);
    const userPrompt = `
【STORY_DATA (JSON)】
${storyData}

${Prompts.NEXT_SENTENCE_PROMPT(content)}
`.trim();

    return runGeminiRequest({
      model: AiModel.FAST,
      contents: userPrompt,
      config: { 
        systemInstruction: `${Prompts.COPILOT_SOUL}\n\n${Prompts.STRICT_JSON_ENFORCEMENT}`,
        responseMimeType: "application/json", 
        responseSchema: Schemas.suggestionsSchema 
      },
      usageLabel: 'Writer/Copilot',
      onUsage: this.onUsage,
      logCallback: this.logCallback,
      mapper: (res) => safeJsonParse<string[]>(res.text, 'Copilot').value || Schemas.DEFAULT_RESPONSES.SUGGESTIONS
    });
  }

  async scanDraft(draft: string, project: StoryProject, activeChapterId: string, processOps: (json: any) => ExtractionResult): Promise<ExtractionResult> {
    const storyData = PromptBuilder.buildStructuredStoryData(project, activeChapterId);
    const userPrompt = `
【STORY_DATA (JSON)】
${storyData}

${Prompts.DRAFT_SCAN_PROMPT(draft)}
`.trim();

    return runGeminiRequest({
      model: AiModel.REASONING,
      contents: userPrompt,
      config: {
        systemInstruction: `${Prompts.SYNC_EXTRACTOR_SOUL}\n\n${Prompts.STRICT_JSON_ENFORCEMENT}`,
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
    const storyData = PromptBuilder.buildStructuredStoryData(project, chapter.id);
    const userPrompt = `
【STORY_DATA (JSON)】
${storyData}

${Prompts.CHAPTER_PACKAGE_PROMPT(chapter.title, chapter.summary)}
`.trim();

    return runGeminiRequest({
      model: AiModel.REASONING,
      contents: userPrompt,
      config: { 
        systemInstruction: `${Prompts.ARCHITECT_MTP}\n\n${Prompts.STRICT_JSON_ENFORCEMENT}`,
        responseMimeType: "application/json", 
        responseSchema: Schemas.chapterPackageSchema 
      },
      usageLabel: 'Writer/Package',
      onUsage: this.onUsage,
      logCallback: this.logCallback,
      mapper: (res) => safeJsonParse<ChapterPackageResponse>(res.text, 'Writer').value || Schemas.DEFAULT_RESPONSES.CHAPTER_PACKAGE
    });
  }
}
