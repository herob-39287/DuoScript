
import { StoryProject, UsageCallback, LogCallback, BibleIssue, NexusBranch, ProjectGenerationResponse, IntegrityScanResponse, NexusSimulationResponse } from "../../../types";
import { PromptBuilder } from "../promptBuilder";
import { parseWithSchema } from "../utils";
import * as Prompts from "../prompts";
import { STRICT_JSON_ENFORCEMENT } from "../prompts/resources";
import * as Schemas from "../schemas";
import { IntegrityScanZodSchema, NexusSimulationZodSchema } from "../../validation/schemas";
import { Type } from "@google/genai";
import { z } from "zod";
import { AI_MODELS, TOKEN_LIMITS } from "../../../constants";
import { BaseAgent } from "./BaseAgent";
import { GeminiClient } from "../core";

export class AnalysisAgent extends BaseAgent {
  constructor(client: GeminiClient) {
    super(client);
  }
  
  async scanIntegrity(project: StoryProject, onUsage: UsageCallback, logCallback: LogCallback, activeChapterId?: string): Promise<BibleIssue[]> {
    const bible = project.bible;
    const lang = project.meta.language || 'ja';
    
    const chapterMap = project.chapters.map(c => {
      const characters = (c.involvedCharacterIds || [])
        .map(id => bible.characters.find(char => char.id === id)?.profile.name)
        .filter(Boolean);

      return {
        id: c.id,
        title: c.title,
        summary: c.summary,
        involvedCharacters: characters,
        contentSnippet: (activeChapterId === c.id && c.content) 
          ? c.content.slice(-2000) 
          : undefined
      };
    });

    const bibleData = JSON.stringify({ 
      bible: {
        setting: bible.setting,
        laws: bible.laws,
        grandArc: bible.grandArc,
        characters: bible.characters.map(char => ({
          name: char.profile.name,
          role: char.profile.role,
          description: char.profile.description,
          traits: char.profile.traits,
          state: char.state
        })),
        timeline: bible.timeline
      },
      chapters: chapterMap
    });
    
    return this.client.request({
      model: AI_MODELS.FAST,
      contents: Prompts.INTEGRITY_SCAN_PROMPT(lang, bibleData),
      config: { 
        systemInstruction: `${Prompts.ANALYST_SOUL(lang)}\n\n${STRICT_JSON_ENFORCEMENT}`,
        responseMimeType: "application/json", 
        responseSchema: Schemas.getIntegrityScanSchema(lang)
      },
      usageLabel: 'Analysis/IntegrityLinter',
      onUsage: onUsage,
      logCallback: logCallback,
      mapper: (res) => {
        const data = parseWithSchema<IntegrityScanResponse>(res.text, IntegrityScanZodSchema, 'Linter', { issues: [] });
        return (data.issues || []).map(i => ({ ...i, id: crypto.randomUUID() })) as BibleIssue[];
      }
    });
  }

  async simulateNexus(hypothesis: string, project: StoryProject, onUsage: UsageCallback, logCallback: LogCallback): Promise<NexusBranch> {
    const index = PromptBuilder.buildIndexData(project);
    const laws = JSON.stringify(project.bible.laws);
    const ctx = `INDEX:\n${index}\nFULL LAWS:\n${laws}`;
    const lang = project.meta.language || 'ja';

    return this.client.request({
      model: AI_MODELS.REASONING,
      contents: Prompts.NEXUS_SIM_PROMPT(hypothesis, ctx, lang),
      config: { 
        systemInstruction: `${Prompts.ARCHITECT_MTP(lang)}\n\n${STRICT_JSON_ENFORCEMENT}`,
        responseMimeType: "application/json", 
        responseSchema: Schemas.getNexusSchema(lang),
        thinkingConfig: { thinkingBudget: TOKEN_LIMITS.THINKING_MEDIUM }
      },
      usageLabel: 'Analysis/NexusSimulation',
      onUsage: onUsage,
      logCallback: logCallback,
      mapper: (res) => {
        const sim = parseWithSchema<NexusSimulationResponse>(res.text, NexusSimulationZodSchema, 'Nexus', Schemas.DEFAULT_RESPONSES.NEXUS);
        return { 
          id: crypto.randomUUID(), 
          hypothesis: hypothesis, 
          impactOnCanon: sim.impactOnCanon, 
          impactOnState: sim.impactOnState, 
          alternateTimeline: sim.alternateTimeline || [], 
          timestamp: Date.now() 
        };
      }
    });
  }

  async generateProject(theme: string, onUsage: UsageCallback, logCallback: LogCallback): Promise<ProjectGenerationResponse> {
    logCallback('info', 'Architect', 'Step 1/3: 創世記（世界設定・用語）を構築中... (Deep Reasoning)');

    const bibleRes = await this.client.request<any>({
      model: AI_MODELS.REASONING, 
      contents: Prompts.PROJECT_GEN_BIBLE_PROMPT(theme, 'ja'),
      config: { 
        systemInstruction: `${Prompts.ARCHITECT_MTP('ja')}\n\n${STRICT_JSON_ENFORCEMENT}`,
        responseMimeType: "application/json", 
        responseSchema: Schemas.getGenesisBibleSchema('ja'),
        thinkingConfig: { thinkingBudget: 8192 },
        maxOutputTokens: TOKEN_LIMITS.GENESIS_BIBLE
      },
      usageLabel: 'Analysis/MuseBibleGen',
      onUsage: onUsage,
      logCallback: logCallback,
      mapper: (res) => parseWithSchema<any>(res.text, z.any(), 'MuseBible', {})
    });

    if (!bibleRes || !bibleRes.bible) throw new Error("Bible generation failed");

    logCallback('info', 'Architect', 'Step 2/3: 物語の章構成（プロット・年表）を設計中...');
    const bibleJson = JSON.stringify(bibleRes.bible);

    const chapterRes = await this.client.request<any>({
      model: AI_MODELS.REASONING,
      contents: Prompts.INITIAL_CHAPTERS_PROMPT(bibleJson, 'ja'),
      config: {
        systemInstruction: `${Prompts.ARCHITECT_MTP('ja')}\n\n${STRICT_JSON_ENFORCEMENT}`,
        responseMimeType: "application/json",
        responseSchema: Schemas.getInitialChaptersSchema('ja'),
        thinkingConfig: { thinkingBudget: TOKEN_LIMITS.THINKING_MEDIUM }, 
        maxOutputTokens: TOKEN_LIMITS.DEFAULT_OUTPUT
      },
      usageLabel: 'Analysis/MuseChapterGen',
      onUsage: onUsage,
      logCallback: logCallback,
      mapper: (res) => parseWithSchema<any>(res.text, z.any(), 'MuseChapters', {})
    });

    logCallback('info', 'Architect', 'Step 3/3: 確定したプロットに伏線とスレッドを仕込んでいます...');
    const chaptersJson = JSON.stringify(chapterRes?.chapters || []);

    const foreshadowingRes = await this.client.request<any>({
      model: AI_MODELS.REASONING,
      contents: Prompts.INITIAL_FORESHADOWING_PROMPT(bibleJson, chaptersJson, 'ja'),
      config: {
        systemInstruction: `${Prompts.ARCHITECT_MTP('ja')}\n\n${STRICT_JSON_ENFORCEMENT}`,
        responseMimeType: "application/json",
        responseSchema: Schemas.getInitialForeshadowingSchema('ja'),
        thinkingConfig: { thinkingBudget: TOKEN_LIMITS.THINKING_LIGHT },
        maxOutputTokens: 16384
      },
      usageLabel: 'Analysis/MuseForeshadowingGen',
      onUsage: onUsage,
      logCallback: logCallback,
      mapper: (res) => parseWithSchema<any>(res.text, z.any(), 'MuseForeshadowing', {})
    });

    return {
      title: bibleRes.title,
      genre: bibleRes.genre,
      bible: {
        ...bibleRes.bible,
        timeline: chapterRes?.timeline || [],
        storyStructure: chapterRes?.storyStructure || [],
        volumes: chapterRes?.volumes || [],
        foreshadowing: foreshadowingRes?.foreshadowing || [],
        storyThreads: foreshadowingRes?.storyThreads || []
      },
      chapters: chapterRes?.chapters || []
    };
  }

  async getSafetyAlternatives(input: string, category: string, logCallback: LogCallback): Promise<string[]> {
    return this.client.request({
      model: AI_MODELS.FAST,
      contents: Prompts.SAFETY_ALTERNATIVES_PROMPT(input, category, 'ja'),
      config: { 
        systemInstruction: `You are a safety guide assisting a writer.\n\n${STRICT_JSON_ENFORCEMENT}`,
        responseMimeType: "application/json", 
        responseSchema: { type: Type.ARRAY, items: { type: Type.STRING } } 
      },
      usageLabel: 'Analysis/SafetyAlternatives',
      logCallback: logCallback,
      mapper: (res) => parseWithSchema<string[]>(res.text, z.array(z.string()), 'Safety', [])
    });
  }
}
