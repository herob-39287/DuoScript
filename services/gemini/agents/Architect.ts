
import { AiModel, StoryProject, GeminiContent, UsageCallback, LogCallback, DetectionResult, ExtractionResult, WhisperAdvice } from "../../../types";
// Fix: Added getClient to imports from ../core
import { runGeminiRequest, getClient } from "../core";
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
    
    // 動的な物語データとメモリを構築
    const storyData = PromptBuilder.buildStructuredStoryData(project, undefined, relevantIds);
    
    // ロール交互性違反を避けるため、コンテキストは systemInstruction に注入する
    const dynamicSystemInstruction = `
${Prompts.ARCHITECT_MTP}

【STORY_DATA (INTERNAL_USE)】
${storyData}

【LONG_TERM_MEMORY】
${memory || "なし"}
`.trim();

    return runGeminiRequest({
      model: 'gemini-3-pro-preview',
      contents: history, // history は PlotterView で作成された user/model の交互配列
      config: {
        systemInstruction: dynamicSystemInstruction,
        tools: allowSearch ? [{ googleSearch: {} }] : [],
        thinkingConfig: { thinkingBudget: 4000 }
      },
      usageLabel: 'ArchitectChat',
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
      model: 'gemini-3-flash-preview',
      contents: Prompts.DETECTION_PROMPT(input),
      config: { 
        systemInstruction: `${Prompts.DETECTOR_SOUL}\n\n${Prompts.STRICT_JSON_ENFORCEMENT}`,
        responseMimeType: "application/json", 
        responseSchema: Schemas.detectionSchema 
      },
      usageLabel: 'NeuralSync/Detector',
      onUsage: this.onUsage,
      logCallback: this.logCallback,
      mapper: (res) => safeJsonParse<DetectionResult>(res.text, 'Detector').value || Schemas.DEFAULT_RESPONSES.DETECTION
    });
  }

  async extractSyncOps(history: GeminiContent[], project: StoryProject, memory: string, detection: DetectionResult, processOps: (json: any) => ExtractionResult): Promise<ExtractionResult> {
    const conversationText = history.map(h => h.parts.map(p => p.text).join(" ")).join("\n");
    const relevantIds = await this.librarian.identifyRelevantEntities(conversationText, project);
    const storyData = PromptBuilder.buildStructuredStoryData(project, undefined, relevantIds);
    
    const extractionPrompt = `
対話履歴から物語の新しい真実（設定の変更点）を抽出し、JSON形式で出力せよ。
作家へのメッセージは一切含まず、データのみを出力すること。

【STORY_DATA】
${storyData}

【MEMORY】
${memory || "なし"}

【HISTORY】
${JSON.stringify(history)}
`.trim();

    return runGeminiRequest({
      model: 'gemini-3-pro-preview',
      contents: extractionPrompt,
      config: {
        systemInstruction: `${Prompts.SYNC_EXTRACTOR_SOUL}\n\n${Prompts.STRICT_JSON_ENFORCEMENT}`,
        responseMimeType: "application/json",
        responseSchema: { type: Type.ARRAY, items: { ...Schemas.syncOperationSchema, description: "抽出された変更操作。文字列は適切にエスケープすること。" } },
        maxOutputTokens: 32768, // Increase total token budget to allow large JSON output
        thinkingConfig: { thinkingBudget: 12288 }
      },
      usageLabel: 'NeuralSync/Extractor',
      onUsage: this.onUsage,
      logCallback: this.logCallback,
      mapper: (res) => processOps(res.text)
    });
  }

  async whisper(chunk: string, project: StoryProject, activeChapterId: string): Promise<WhisperAdvice | null> {
    const storyData = PromptBuilder.buildStructuredStoryData(project, activeChapterId);
    const whisperContent = `
【STORY_DATA】
${storyData}
【CHUNK】
"${chunk}"
`.trim();
    
    return runGeminiRequest({
      model: 'gemini-3-flash-preview',
      contents: whisperContent,
      config: { 
        systemInstruction: `${Prompts.WHISPER_SOUL}\n\n${Prompts.STRICT_JSON_ENFORCEMENT}`,
        responseMimeType: "application/json", 
        responseSchema: Schemas.whisperSchema 
      },
      usageLabel: 'Architect/Whisper',
      onUsage: this.onUsage,
      logCallback: this.logCallback,
      mapper: (res) => res.text?.includes("なし") ? null : safeJsonParse<WhisperAdvice>(res.text, 'Whisper').value || null
    });
  }

  async summarize(currentMemory: string, oldMessages: GeminiContent[]): Promise<string> {
    // Fix: Removed unused 'ai' variable that caused "Cannot find name 'getClient'" if not imported
    return runGeminiRequest({
      model: 'gemini-3-flash-preview',
      contents: Prompts.CHAT_SUMMARIZATION_PROMPT(currentMemory, oldMessages),
      config: {
        systemInstruction: Prompts.LIBRARIAN_SOUL
      },
      usageLabel: 'System/Memory',
      onUsage: this.onUsage,
      logCallback: this.logCallback,
      mapper: (res) => res.text || currentMemory
    });
  }
}
