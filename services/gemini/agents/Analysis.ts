import { AiModel, StoryProject, UsageCallback, LogCallback, BibleIssue, NexusBranch, ProjectGenerationResponse, IntegrityScanResponse, NexusSimulationResponse } from "../../../types";
import { runGeminiRequest } from "../core";
import { PromptBuilder } from "../promptBuilder";
import { safeJsonParse } from "../utils";
import * as Prompts from "../prompts";
import * as Schemas from "../schemas";
import { Type } from "@google/genai";

export class AnalysisAgent {
  constructor(private onUsage?: UsageCallback, private logCallback: LogCallback = () => {}) {}

  async scanIntegrity(project: StoryProject): Promise<BibleIssue[]> {
    const bibleData = JSON.stringify({ bible: project.bible, chapters: project.chapters.map(c => ({ id: c.id, title: c.title, summary: c.summary })) });
    
    return runGeminiRequest({
      model: AiModel.REASONING,
      contents: Prompts.INTEGRITY_SCAN_PROMPT.replace('{{BIBLE_DATA}}', bibleData),
      config: { 
        systemInstruction: `${Prompts.ANALYST_SOUL}\n\n${Prompts.STRICT_JSON_ENFORCEMENT}`,
        responseMimeType: "application/json", 
        responseSchema: Schemas.integrityScanSchema 
      },
      usageLabel: 'Linter',
      onUsage: this.onUsage,
      logCallback: this.logCallback,
      mapper: (res) => (safeJsonParse<IntegrityScanResponse>(res.text, 'Linter').value?.issues || []).map(i => ({ ...i, id: crypto.randomUUID() }))
    });
  }

  async simulateNexus(hypothesis: string, project: StoryProject): Promise<NexusBranch> {
    // Fix: PromptBuilder.buildTieredContext was a typo for buildStructuredStoryData which generates the tiered context string
    const ctx = PromptBuilder.buildStructuredStoryData(project);
    return runGeminiRequest({
      model: AiModel.REASONING,
      contents: Prompts.NEXUS_SIM_PROMPT(hypothesis, ctx),
      config: { 
        systemInstruction: `${Prompts.ARCHITECT_MTP}\n\n${Prompts.STRICT_JSON_ENFORCEMENT}`,
        responseMimeType: "application/json", 
        responseSchema: Schemas.nexusSchema 
      },
      usageLabel: 'Nexus',
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
      usageLabel: 'Muse',
      onUsage: this.onUsage,
      logCallback: this.logCallback,
      mapper: (res) => safeJsonParse<ProjectGenerationResponse>(res.text, 'Muse').value || Schemas.DEFAULT_RESPONSES.PROJECT_GEN
    });
  }

  async getSafetyAlternatives(input: string, category: string): Promise<string[]> {
    return runGeminiRequest({
      model: AiModel.FAST,
      contents: Prompts.SAFETY_ALTERNATIVES_PROMPT(input, category),
      config: { 
        systemInstruction: `あなたは作家を支援する安全ガイドです。\n\n${Prompts.STRICT_JSON_ENFORCEMENT}`,
        responseMimeType: "application/json", 
        responseSchema: { type: Type.ARRAY, items: { type: Type.STRING } } 
      },
      usageLabel: 'Safety',
      logCallback: this.logCallback,
      mapper: (res) => safeJsonParse<string[]>(res.text, 'Safety').value || []
    });
  }
}