
import { AiModel, StoryProject, GeminiContent, UsageCallback, LogCallback, DetectionResult, ExtractionResult, WhisperAdvice } from "../../../types";
import { runGeminiRequest } from "../core";
import { PromptBuilder } from "../promptBuilder";
import { LibrarianAgent } from "./Librarian";
import { safeJsonParse } from "../utils";
import * as Prompts from "../prompts";
import * as Schemas from "../schemas";
import { Type } from "@google/genai";

export class ArchitectAgent {
  private librarian: LibrarianAgent;
  constructor(private onUsage?: UsageCallback, private logCallback: LogCallback = () => {}) {
    this.librarian = new LibrarianAgent(onUsage, logCallback);
  }

  async chat(history: GeminiContent[], input: string, project: StoryProject, memory: string, allowSearch: boolean) {
    const conversationText = history.map(h => h.parts.map(p => p.text).join(" ")).join("\n");
    const relevantIds = await this.librarian.identifyRelevantEntities(conversationText, project);
    const ctx = PromptBuilder.buildTieredContext(project, undefined, relevantIds);
    
    return runGeminiRequest({
      model: AiModel.REASONING,
      contents: history,
      config: {
        systemInstruction: PromptBuilder.architectSystem(ctx, memory),
        tools: allowSearch ? [{ googleSearch: {} }] : [],
      },
      usageLabel: 'Architect',
      onUsage: this.onUsage,
      logCallback: this.logCallback,
      mapper: (res) => ({
        text: res.text || "...",
        sources: res.candidates?.[0]?.groundingMetadata?.groundingChunks?.map((c: any) => ({ title: c.web?.title || "Ref", uri: c.web?.uri || "" })) || []
      })
    });
  }

  async detectIntent(input: string): Promise<DetectionResult> {
    return runGeminiRequest({
      model: AiModel.FAST,
      contents: Prompts.DETECTION_PROMPT(input),
      config: { responseMimeType: "application/json", responseSchema: Schemas.detectionSchema },
      usageLabel: 'NeuralSync/Detector',
      onUsage: this.onUsage,
      logCallback: this.logCallback,
      mapper: (res) => safeJsonParse<DetectionResult>(res.text, 'Detector').value || Schemas.DEFAULT_RESPONSES.DETECTION
    });
  }

  async extractSyncOps(history: GeminiContent[], project: StoryProject, memory: string, detection: DetectionResult, processOps: (json: any) => ExtractionResult): Promise<ExtractionResult> {
    const conversationText = history.map(h => h.parts.map(p => p.text).join(" ")).join("\n");
    const relevantIds = await this.librarian.identifyRelevantEntities(conversationText, project);
    const context = PromptBuilder.buildTieredContext(project, undefined, relevantIds);
    
    return runGeminiRequest({
      model: AiModel.REASONING,
      contents: Prompts.SYNC_EXTRACT_PROMPT(history, memory, context, detection.categories, detection.isHypothetical),
      config: {
        responseMimeType: "application/json",
        responseSchema: { type: Type.ARRAY, items: Schemas.syncOperationSchema }
      },
      usageLabel: 'NeuralSync/Extractor',
      onUsage: this.onUsage,
      logCallback: this.logCallback,
      mapper: (res) => processOps(res.text)
    });
  }

  async whisper(chunk: string, project: StoryProject, activeChapterId: string): Promise<WhisperAdvice | null> {
    const context = PromptBuilder.buildTieredContext(project, activeChapterId);
    return runGeminiRequest({
      model: AiModel.FAST,
      contents: PromptBuilder.whisperPrompt(chunk, context),
      config: { responseMimeType: "application/json", responseSchema: Schemas.whisperSchema },
      usageLabel: 'Architect/Whisper',
      onUsage: this.onUsage,
      logCallback: this.logCallback,
      mapper: (res) => res.text?.includes("なし") ? null : safeJsonParse<WhisperAdvice>(res.text, 'Whisper').value || null
    });
  }

  async summarize(currentMemory: string, oldMessages: GeminiContent[]): Promise<string> {
    return runGeminiRequest({
      model: AiModel.FAST,
      contents: Prompts.CHAT_SUMMARIZATION_PROMPT(currentMemory, oldMessages),
      usageLabel: 'System/Memory',
      onUsage: this.onUsage,
      logCallback: this.logCallback,
      mapper: (res) => res.text || currentMemory
    });
  }
}
