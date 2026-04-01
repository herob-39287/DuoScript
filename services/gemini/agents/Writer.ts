import {
  StoryProject,
  ChapterLog,
  UsageCallback,
  LogCallback,
  ExtractionResult,
  ChapterPackageResponse,
  ScenePackage,
} from '../../../types';
import { PromptBuilder } from '../promptBuilder';
import { parseWithSchema, getSafetySettings } from '../utils';
import * as Prompts from '../prompts';
import { STRICT_JSON_ENFORCEMENT } from '../prompts/resources';
import * as Schemas from '../schemas';
import {
  ChapterPackageZodSchema,
  ChoicePointSchema,
  ReactionVariantSchema,
  ConvergencePointSchema,
} from '../../validation/schemas';
import { Type } from '@google/genai';
import { z } from 'zod';
import { AI_MODELS, TOKEN_LIMITS } from '../../../constants';
import { BaseAgent } from './BaseAgent';
import { GeminiClient } from '../core';
import { zodToGeminiSchema } from '../schemaConverter';

const SharedSpineStageSchema = z.object({
  scenePackages: z.array(
    z.object({
      sceneId: z.string(),
      purpose: z.string(),
      mandatoryInfo: z.array(z.string()).default([]),
      sharedSpine: z.object({
        intro: z.string(),
        conflict: z.string(),
        deepen: z.string(),
        preChoiceBeat: z.string(),
        close: z.string(),
      }),
    }),
  ),
});

const VariantStageSchema = z.object({
  scenePackages: z.array(
    z.object({
      sceneId: z.string(),
      choicePoints: z.array(ChoicePointSchema).default([]),
      reactionVariants: z.array(ReactionVariantSchema).default([]),
      carryoverStateChanges: z.array(z.string()).default([]),
    }),
  ),
});

const ConvergenceStageSchema = z.object({
  scenePackages: z.array(
    z.object({
      sceneId: z.string(),
      convergencePoint: ConvergencePointSchema.optional(),
    }),
  ),
  content: z.string().optional(),
});

export class WriterAgent extends BaseAgent {
  constructor(client: GeminiClient) {
    super(client);
  }

  async *streamDraft(
    chapter: ChapterLog,
    tone: string,
    usePro: boolean,
    project: StoryProject,
    previousContent: string,
    targetBeats: string[] | undefined,
    logCallback: LogCallback,
    isContextActive: boolean = true,
    onUsage?: UsageCallback,
  ) {
    const lang = project.meta.language || 'ja';
    const systemInstruction = PromptBuilder.buildWriterMTP(
      project,
      chapter.id,
      tone,
      isContextActive,
    );

    const beatsToUse =
      targetBeats && targetBeats.length > 0 ? targetBeats : chapter.beats.map((b) => b.text);

    const focusMode = !!(targetBeats && targetBeats.length > 0);

    const userPrompt = Prompts.DRAFT_PROMPT(
      chapter.title,
      chapter.summary,
      beatsToUse,
      previousContent,
      lang,
      focusMode,
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
        maxOutputTokens: TOKEN_LIMITS.CHAPTER_DRAFT,
      },
      usageLabel: label,
      onUsage: onUsage,
      logCallback: logCallback,
    });

    for await (const chunk of stream) {
      yield chunk;
    }
  }

  async suggest(
    content: string,
    project: StoryProject,
    activeChapterId: string,
    isContextActive: boolean = true,
    onUsage: UsageCallback,
    logCallback: LogCallback,
  ): Promise<string[]> {
    const storyData = isContextActive
      ? PromptBuilder.buildFocalData(project, [], activeChapterId)
      : 'No Bible Reference';
    const lang = project.meta.language || 'ja';
    const userPrompt = `【STORY_DATA (JSON)】\n${storyData}\n\n${Prompts.NEXT_SENTENCE_PROMPT(content, lang)}`;

    return this.client.request({
      model: AI_MODELS.FAST,
      contents: userPrompt,
      config: {
        systemInstruction: `${Prompts.COPILOT_SOUL(lang)}\n\n${STRICT_JSON_ENFORCEMENT}`,
        responseMimeType: 'application/json',
        responseSchema: Schemas.suggestionsSchema,
      },
      usageLabel: 'Writer/CopilotSuggestions',
      onUsage: onUsage,
      logCallback: logCallback,
      mapper: (res) =>
        parseWithSchema<string[]>(
          res.text,
          z.array(z.string()),
          'Copilot',
          Schemas.DEFAULT_RESPONSES.SUGGESTIONS,
        ),
    });
  }

  async scanDraft(
    draft: string,
    project: StoryProject,
    activeChapterId: string,
    processOps: (json: any) => ExtractionResult,
    onUsage: UsageCallback,
    logCallback: LogCallback,
  ): Promise<ExtractionResult> {
    const storyData = PromptBuilder.buildFocalData(project, [], activeChapterId);
    const lang = project.meta.language || 'ja';
    const userPrompt = `【STORY_DATA (JSON)】\n${storyData}\n\n${Prompts.DRAFT_SCAN_PROMPT(draft, lang)}`;

    return this.client.request({
      model: AI_MODELS.FAST,
      contents: userPrompt,
      config: {
        systemInstruction: `${Prompts.SYNC_EXTRACTOR_SOUL(lang)}\n\n${STRICT_JSON_ENFORCEMENT}`,
        responseMimeType: 'application/json',
        responseSchema: { type: Type.ARRAY, items: Schemas.getSyncOperationSchema(lang) },
      },
      usageLabel: 'Writer/DraftConsistencyScanner',
      onUsage: onUsage,
      logCallback: logCallback,
      mapper: (res) => processOps(res.text),
    });
  }

  async generatePackage(
    project: StoryProject,
    chapter: ChapterLog,
    onUsage: UsageCallback,
    logCallback: LogCallback,
  ): Promise<ChapterPackageResponse> {
    const storyData = PromptBuilder.buildFocalData(project, [], chapter.id);
    const lang = project.meta.language || 'ja';
    const persona = project.meta.preferences?.aiPersona;
    const userPrompt = `【STORY_DATA (JSON)】\n${storyData}\n\n${Prompts.CHAPTER_PACKAGE_PROMPT(chapter.title, chapter.summary, lang)}`;

    return this.client.request({
      model: AI_MODELS.REASONING,
      contents: userPrompt,
      config: {
        systemInstruction: `${Prompts.ARCHITECT_MTP(lang, persona)}\n\n${STRICT_JSON_ENFORCEMENT}`,
        responseMimeType: 'application/json',
        responseSchema: Schemas.getChapterPackageSchema(lang),
        thinkingConfig: { thinkingBudget: TOKEN_LIMITS.THINKING_MEDIUM },
        maxOutputTokens: TOKEN_LIMITS.DEFAULT_OUTPUT,
      },
      usageLabel: 'Writer/PlotPackageGeneration',
      onUsage: onUsage,
      logCallback: logCallback,
      mapper: (res) =>
        parseWithSchema<ChapterPackageResponse>(
          res.text,
          ChapterPackageZodSchema,
          'Writer',
          Schemas.DEFAULT_RESPONSES.CHAPTER_PACKAGE,
        ),
    });
  }

  async generateSharedSpineStage(
    project: StoryProject,
    chapter: ChapterLog,
    onUsage: UsageCallback,
    logCallback: LogCallback,
  ): Promise<z.infer<typeof SharedSpineStageSchema>> {
    const lang = project.meta.language || 'ja';
    const storyData = PromptBuilder.buildFocalData(project, [], chapter.id);
    const prompt = `【STORY_DATA(JSON)】\n${storyData}\n\n章「${chapter.title}」のScenePackageについて、sharedSpineのみを生成してください。\n必ずJSONのみで返し、scenePackages[].sharedSpine(intro/conflict/deepen/preChoiceBeat/close)を埋めてください。`;

    return this.client.request({
      model: AI_MODELS.REASONING,
      contents: prompt,
      config: {
        systemInstruction: `${Prompts.WRITER_MTP(lang)}\n\n${STRICT_JSON_ENFORCEMENT}`,
        responseMimeType: 'application/json',
        responseSchema: zodToGeminiSchema(SharedSpineStageSchema),
        thinkingConfig: { thinkingBudget: TOKEN_LIMITS.THINKING_MEDIUM },
      },
      usageLabel: 'Writer/Stage1SharedSpine',
      onUsage,
      logCallback,
      mapper: (res) =>
        parseWithSchema(res.text, SharedSpineStageSchema, 'WriterStage1', { scenePackages: [] }),
    });
  }

  async generateVariantStage(
    project: StoryProject,
    chapter: ChapterLog,
    scenePackages: ScenePackage[],
    onUsage: UsageCallback,
    logCallback: LogCallback,
  ): Promise<z.infer<typeof VariantStageSchema>> {
    const lang = project.meta.language || 'ja';
    const prompt = `章「${chapter.title}」のScenePackageに対してchoicePoints/reactionVariantsのみ生成してください。\n入力: ${JSON.stringify(scenePackages)}\n\nJSONのみ返してください。`;

    return this.client.request({
      model: AI_MODELS.REASONING,
      contents: prompt,
      config: {
        systemInstruction: `${Prompts.WRITER_MTP(lang)}\n\n${STRICT_JSON_ENFORCEMENT}`,
        responseMimeType: 'application/json',
        responseSchema: zodToGeminiSchema(VariantStageSchema),
        thinkingConfig: { thinkingBudget: TOKEN_LIMITS.THINKING_MEDIUM },
      },
      usageLabel: 'Writer/Stage2Variants',
      onUsage,
      logCallback,
      mapper: (res) =>
        parseWithSchema(res.text, VariantStageSchema, 'WriterStage2', { scenePackages: [] }),
    });
  }

  async generateConvergenceStage(
    project: StoryProject,
    chapter: ChapterLog,
    scenePackages: ScenePackage[],
    onUsage: UsageCallback,
    logCallback: LogCallback,
  ): Promise<z.infer<typeof ConvergenceStageSchema>> {
    const lang = project.meta.language || 'ja';
    const prompt = `章「${chapter.title}」について、convergencePointと最終整文contentを生成してください。\n入力: ${JSON.stringify(scenePackages)}\n\nJSONのみ返してください。`;

    return this.client.request({
      model: AI_MODELS.REASONING,
      contents: prompt,
      config: {
        systemInstruction: `${Prompts.WRITER_MTP(lang)}\n\n${STRICT_JSON_ENFORCEMENT}`,
        responseMimeType: 'application/json',
        responseSchema: zodToGeminiSchema(ConvergenceStageSchema),
        thinkingConfig: { thinkingBudget: TOKEN_LIMITS.THINKING_MEDIUM },
      },
      usageLabel: 'Writer/Stage3ConvergencePolish',
      onUsage,
      logCallback,
      mapper: (res) =>
        parseWithSchema(res.text, ConvergenceStageSchema, 'WriterStage3', {
          scenePackages: [],
          content: '',
        }),
    });
  }
}
