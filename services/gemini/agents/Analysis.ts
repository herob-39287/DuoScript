
import { AiModel, StoryProject, UsageCallback, LogCallback, BibleIssue, NexusBranch, ProjectGenerationResponse, IntegrityScanResponse, NexusSimulationResponse } from "../../../types";
import { runGeminiRequest } from "../core";
import { PromptBuilder } from "../promptBuilder";
import { safeJsonParse } from "../utils";
import * as Prompts from "../prompts";
import * as Schemas from "../schemas";
import { Type } from "@google/genai";

export class AnalysisAgent {
  constructor(private onUsage?: UsageCallback, private logCallback: LogCallback = () => {}) {}

  /**
   * 整合性スキャン（軽量版）
   * 全章の本文は送らず、あらすじ、登場人物リスト、および「アクティブな章」の最新部分のみを送信する。
   */
  async scanIntegrity(project: StoryProject, activeChapterId?: string): Promise<BibleIssue[]> {
    const bible = project.bible;
    
    // 軽量なデータマップの作成
    const chapterMap = project.chapters.map(c => {
      // キャラクターIDを名前に変換
      const characters = (c.involvedCharacterIds || [])
        .map(id => bible.characters.find(char => char.id === id)?.profile.name)
        .filter(Boolean);

      return {
        id: c.id,
        title: c.title,
        summary: c.summary,
        involvedCharacters: characters,
        // アクティブな章（執筆中の章）のみ、直近の本文を少し含める
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
    
    return runGeminiRequest({
      model: AiModel.FAST,
      contents: Prompts.INTEGRITY_SCAN_PROMPT.replace('{{BIBLE_DATA}}', bibleData),
      config: { 
        systemInstruction: `${Prompts.ANALYST_SOUL}\n\n${Prompts.STRICT_JSON_ENFORCEMENT}`,
        responseMimeType: "application/json", 
        responseSchema: Schemas.integrityScanSchema 
      },
      usageLabel: 'Analysis/IntegrityLinter',
      onUsage: this.onUsage,
      logCallback: this.logCallback,
      mapper: (res) => (safeJsonParse<IntegrityScanResponse>(res.text, 'Linter').value?.issues || []).map(i => ({ ...i, id: crypto.randomUUID() }))
    });
  }

  async simulateNexus(hypothesis: string, project: StoryProject): Promise<NexusBranch> {
    const ctx = PromptBuilder.buildStructuredStoryData(project);
    return runGeminiRequest({
      model: AiModel.FAST,
      contents: Prompts.NEXUS_SIM_PROMPT(hypothesis, ctx),
      config: { 
        systemInstruction: `${Prompts.ARCHITECT_MTP}\n\n${Prompts.STRICT_JSON_ENFORCEMENT}`,
        responseMimeType: "application/json", 
        responseSchema: Schemas.nexusSchema 
      },
      usageLabel: 'Analysis/NexusSimulation',
      onUsage: this.onUsage,
      logCallback: this.logCallback,
      mapper: (res) => {
        const sim = safeJsonParse<NexusSimulationResponse>(res.text, 'Nexus').value || Schemas.DEFAULT_RESPONSES.NEXUS;
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

  async generateProject(theme: string): Promise<ProjectGenerationResponse> {
    return runGeminiRequest({
      model: AiModel.FAST,
      contents: Prompts.PROJECT_GEN_PROMPT(theme),
      config: { 
        systemInstruction: `${Prompts.ARCHITECT_MTP}\n\n${Prompts.STRICT_JSON_ENFORCEMENT}`,
        responseMimeType: "application/json", 
        responseSchema: Schemas.projectGenSchema 
      },
      usageLabel: 'Analysis/MuseIdeaGen',
      onUsage: this.onUsage,
      logCallback: this.logCallback,
      mapper: (res) => safeJsonParse<ProjectGenerationResponse>(res.text, 'Muse').value || Schemas.DEFAULT_RESPONSES.PROJECT_GEN
    });
  }

  async getSafetyAlternatives(input: string, category: string, logCb: LogCallback): Promise<string[]> {
    return runGeminiRequest({
      model: AiModel.FAST,
      contents: Prompts.SAFETY_ALTERNATIVES_PROMPT(input, category),
      config: { 
        systemInstruction: `あなたは作家を支援する安全ガイドです。\n\n${Prompts.STRICT_JSON_ENFORCEMENT}`,
        responseMimeType: "application/json", 
        responseSchema: { type: Type.ARRAY, items: { type: Type.STRING } } 
      },
      usageLabel: 'Analysis/SafetyAlternatives',
      logCallback: this.logCallback,
      mapper: (res) => safeJsonParse<string[]>(res.text, 'Safety').value || []
    });
  }
}
