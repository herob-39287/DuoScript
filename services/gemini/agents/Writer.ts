
import { StoryProject, ChapterLog, UsageCallback, LogCallback, ExtractionResult, ChapterPackageResponse } from "../../../types";
import { PromptBuilder } from "../promptBuilder";
import { parseWithSchema, getSafetySettings } from "../utils";
import * as Prompts from "../prompts";
import { STRICT_JSON_ENFORCEMENT } from "../prompts/resources";
import * as Schemas from "../schemas";
import { ChapterPackageZodSchema } from "../../validation/schemas";
import { Type } from "@google/genai";
import { z } from "zod";
import { AI_MODELS, TOKEN_LIMITS } from "../../../constants";
import { BaseAgent } from "./BaseAgent";

export class WriterAgent extends BaseAgent {
  
  async* streamDraft(
    chapter: ChapterLog, 
    tone: string, 
    usePro: boolean, 
    project: StoryProject, 
    previousContent: string,
    targetBeats: string[] | undefined,
    logCallback: LogCallback,
    isContextActive: boolean = true,
    onUsage?: UsageCallback
  ) {
    const lang = project.meta.language || 'ja';
    const systemInstruction = PromptBuilder.buildWriterMTP(project, chapter.id, tone, isContextActive);
    
    const beatsToUse = targetBeats && targetBeats.length > 0 
      ? targetBeats 
      : chapter.beats.map(b => b.text);
    
    const focusMode = !!(targetBeats && targetBeats.length > 0);

    const userPrompt = Prompts.DRAFT_PROMPT(
      chapter.title, 
      chapter.summary, 
      beatsToUse, 
      previousContent,
      lang,
      focusMode
    );

    const label = usePro ? 'Writer/Drafting:Reasoning' : 'Writer/Drafting:Fast';
    const model = usePro ? AI_MODELS.REASONING : AI_MODELS.FAST;
    const thinkingConfig = usePro ? { thinkingBudget: TOKEN_LIMITS.THINKING_MEDIUM } : undefined;

    const stream = this.client.stream({
      model,
      contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
      config: { 
        systemInstruction, 
        safetySettings: getSafetySettings(),
        thinkingConfig,
        maxOutputTokens: TOKEN_LIMITS.CHAPTER_DRAFT 
      },
      usageLabel: label,
      onUsage: onUsage,
      logCallback: logCallback
    });

    for await (const chunk of stream) {
      yield chunk;
    }
  }

  async suggest(content: string, project: StoryProject, activeChapterId: string, isContextActive: boolean = true, onUsage: UsageCallback, logCallback: LogCallback): Promise<string[]> {
    const storyData = isContextActive 
        ? PromptBuilder.buildFocalData(project, [], activeChapterId) 
        : "No Bible Reference";
    const lang = project.meta.language || 'ja';
    const userPrompt = `【STORY_DATA (JSON)】\n${storyData}\n\n${Prompts.NEXT_SENTENCE_PROMPT(content, lang)}`;

    return this.client.request({
      model: AI_MODELS.FAST,
      contents: userPrompt,
      config: { 
        systemInstruction: `${Prompts.COPILOT_SOUL(lang)}\n\n${STRICT_JSON_ENFORCEMENT}`,
        responseMimeType: "application/json", 
        responseSchema: Schemas.suggestionsSchema 
      },
      usageLabel: 'Writer/CopilotSuggestions',
      onUsage: onUsage,
      logCallback: logCallback,
      mapper: (res) => parseWithSchema<string[]>(res.text, z.array(z.string()), 'Copilot', Schemas.DEFAULT_RESPONSES.SUGGESTIONS)
    });
  }

  async scanDraft(draft: string, project: StoryProject, activeChapterId: string, processOps: (json: any) => ExtractionResult, onUsage: UsageCallback, logCallback: LogCallback): Promise<ExtractionResult> {
    const storyData = PromptBuilder.buildFocalData(project, [], activeChapterId);
    const lang = project.meta.language || 'ja';
    const userPrompt = `【STORY_DATA (JSON)】\n${storyData}\n\n${Prompts.DRAFT_SCAN_PROMPT(draft, lang)}`;

    return this.client.request({
      model: AI_MODELS.FAST,
      contents: userPrompt,
      config: {
        systemInstruction: `${Prompts.SYNC_EXTRACTOR_SOUL(lang)}\n\n${STRICT_JSON_ENFORCEMENT}`,
        responseMimeType: "application/json",
        responseSchema: { type: Type.ARRAY, items: Schemas.getSyncOperationSchema(lang) }
      },
      usageLabel: 'Writer/DraftConsistencyScanner',
      onUsage: onUsage,
      logCallback: logCallback,
      mapper: (res) => processOps(res.text)
    });
  }

  async generatePackage(project: StoryProject, chapter: ChapterLog, onUsage: UsageCallback, logCallback: LogCallback): Promise<ChapterPackageResponse> {
    const storyData = PromptBuilder.buildFocalData(project, [], chapter.id);
    const lang = project.meta.language || 'ja';
    const persona = project.meta.preferences?.aiPersona;
    const userPrompt = `【STORY_DATA (JSON)】\n${storyData}\n\n${Prompts.CHAPTER_PACKAGE_PROMPT(chapter.title, chapter.summary, lang)}`;

    return this.client.request({
      model: AI_MODELS.REASONING,
      contents: userPrompt,
      config: { 
        systemInstruction: `${Prompts.ARCHITECT_MTP(lang, persona)}\n\n${STRICT_JSON_ENFORCEMENT}`,
        responseMimeType: "application/json", 
        responseSchema: Schemas.getChapterPackageSchema(lang),
        thinkingConfig: { thinkingBudget: TOKEN_LIMITS.THINKING_MEDIUM },
        maxOutputTokens: TOKEN_LIMITS.DEFAULT_OUTPUT
      },
      usageLabel: 'Writer/PlotPackageGeneration',
      onUsage: onUsage,
      logCallback: logCallback,
      mapper: (res) => parseWithSchema<ChapterPackageResponse>(res.text, ChapterPackageZodSchema, 'Writer', Schemas.DEFAULT_RESPONSES.CHAPTER_PACKAGE)
    });
  }
}
