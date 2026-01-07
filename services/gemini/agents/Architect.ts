
import { AiModel, StoryProject, GeminiContent, UsageCallback, LogCallback, DetectionResult, ExtractionResult, WhisperAdvice, SyncOperation } from "../../../types";
import { runGeminiRequest, getClient } from "../core";
import { PromptBuilder } from "../promptBuilder";
import { LibrarianAgent } from "./Librarian";
import { safeJsonParse, trackUsage, getSafetySettings } from "../utils";
import * as Prompts from "../prompts";
import * as Schemas from "../schemas";
import { Type } from "@google/genai";
import { normalizeJapanese } from "../../../utils/stringUtils";
import { cacheManager } from "../cacheManager";

export interface DecisionLog {
  decisions: string[];
  open_questions: string[];
}

export class ArchitectAgent {
  private librarian: LibrarianAgent;
  constructor(private onUsage?: UsageCallback, private logCallback: LogCallback = () => {}) {
    this.librarian = new LibrarianAgent(onUsage, logCallback);
  }

  async chat(history: GeminiContent[], input: string, project: StoryProject, memory: string, allowSearch: boolean, isContextActive: boolean = true) {
    const conversationText = history.map(h => h.parts.map(p => p.text).join(" ")).join("\n");
    const relevantIds = isContextActive ? await this.librarian.identifyRelevantEntities(conversationText, project) : [];
    
    let cacheName: string | undefined = undefined;
    let systemInstruction = "";

    // キャッシュ利用判定
    if (isContextActive) {
      try {
        cacheName = await cacheManager.getArchitectCache(project, this.logCallback);
        // キャッシュ有効時: 動的部分のみをInstructionにする
        systemInstruction = PromptBuilder.buildDynamicArchitectContext(memory, relevantIds, true);
      } catch (e) {
        // キャッシュ作成失敗時はフォールバック (全結合プロンプト)
        console.warn("Cache failed, falling back to full context injection.");
        systemInstruction = PromptBuilder.buildArchitectMTP(project, memory, relevantIds, true);
      }
    } else {
      // コンテキスト無効時: 通常のプロンプト
      systemInstruction = PromptBuilder.buildArchitectMTP(project, memory, relevantIds, false);
    }

    const dynamicSystemInstruction = `
${systemInstruction}

# 応答のルール:
- 自然な日本語で、作家の創造性を刺激する対話を行ってください。
- ユーザーが「設定を確定」させたい様子であれば、Neural Sync（設定抽出）を促してください。
`.trim();

    return runGeminiRequest({
      model: 'gemini-3-pro-preview',
      contents: [...history, { role: 'user', parts: [{ text: input }] }],
      config: {
        systemInstruction: dynamicSystemInstruction,
        cachedContent: cacheName, // キャッシュがある場合はここで指定
        tools: allowSearch ? [{ googleSearch: {} }] : [],
        safetySettings: getSafetySettings(),
        thinkingConfig: { thinkingBudget: 4000 }, 
        maxOutputTokens: 32768
      },
      usageLabel: cacheName ? 'Architect/Chat(Cached)' : 'Architect/Chat',
      onUsage: this.onUsage,
      logCallback: this.logCallback,
      mapper: (res) => ({
        text: res.text,
        sources: res.candidates?.[0]?.groundingMetadata?.groundingChunks?.map((c: any) => ({ 
          title: c.web?.title || "Ref", 
          uri: c.web?.uri || "" 
        })) || []
      })
    });
  }

  async *chatStream(history: GeminiContent[], input: string, project: StoryProject, memory: string, allowSearch: boolean, isContextActive: boolean = true) {
    const conversationText = history.map(h => h.parts.map(p => p.text).join(" ")).join("\n");
    const relevantIds = isContextActive ? await this.librarian.identifyRelevantEntities(conversationText, project) : [];
    
    let cacheName: string | undefined = undefined;
    let systemInstruction = "";

    // キャッシュ利用判定
    if (isContextActive) {
      try {
        cacheName = await cacheManager.getArchitectCache(project, this.logCallback);
        systemInstruction = PromptBuilder.buildDynamicArchitectContext(memory, relevantIds, true);
      } catch (e) {
        console.warn("Cache failed, falling back.");
        systemInstruction = PromptBuilder.buildArchitectMTP(project, memory, relevantIds, true);
      }
    } else {
      systemInstruction = PromptBuilder.buildArchitectMTP(project, memory, relevantIds, false);
    }

    const dynamicSystemInstruction = `
${systemInstruction}

# 応答のルール:
- 自然な日本語で、作家の創造性を刺激する対話を行ってください。
- ユーザーが「設定を確定」させたい様子であれば、Neural Sync（設定抽出）を促してください。
`.trim();

    const ai = getClient();
    const contents = [...history, { role: 'user', parts: [{ text: input }] }];

    try {
      const config = {
        systemInstruction: dynamicSystemInstruction,
        cachedContent: cacheName, // キャッシュ適用
        tools: allowSearch ? [{ googleSearch: {} }] : [],
        safetySettings: getSafetySettings(),
        thinkingConfig: { thinkingBudget: 4000 }, 
        maxOutputTokens: 32768
      };

      const result = await ai.models.generateContentStream({
        model: 'gemini-3-pro-preview',
        contents: contents as any,
        config
      });

      for await (const chunk of result) {
        trackUsage(chunk, 'gemini-3-pro-preview', cacheName ? 'Architect/Chat(Cached)' : 'Architect/Chat', this.onUsage);
        yield {
          text: chunk.text || "",
          sources: chunk.candidates?.[0]?.groundingMetadata?.groundingChunks?.map((c: any) => ({ 
            title: c.web?.title || "Ref", 
            uri: c.web?.uri || "" 
          })) || []
        };
      }
    } catch (e: any) {
      // 検索エラーなどの場合のフォールバック（キャッシュはそのまま維持して再試行）
      if (allowSearch) {
        this.logCallback('info', 'Architect', '検索をオフにして再試行します...');
        const fallbackConfig = {
          systemInstruction: dynamicSystemInstruction,
          cachedContent: cacheName,
          safetySettings: getSafetySettings(),
          thinkingConfig: { thinkingBudget: 2048 },
          maxOutputTokens: 32768
        };
        const fallbackResult = await ai.models.generateContentStream({
          model: 'gemini-3-pro-preview',
          contents: contents as any,
          config: fallbackConfig
        });
        for await (const chunk of fallbackResult) {
          trackUsage(chunk, 'gemini-3-pro-preview', 'Architect/Chat(Fallback)', this.onUsage);
          yield { text: chunk.text || "", sources: [] };
        }
      } else {
        throw e;
      }
    }
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
      usageLabel: 'Architect/IntentDetection',
      onUsage: this.onUsage,
      logCallback: this.logCallback,
      mapper: (res) => safeJsonParse<DetectionResult>(res.text, 'Detector').value || Schemas.DEFAULT_RESPONSES.DETECTION
    });
  }

  async extractSyncOps(history: GeminiContent[], project: StoryProject, memory: string, detection: DetectionResult, processOps: (json: any) => ExtractionResult): Promise<ExtractionResult> {
    const conversationText = history.map(h => h.parts.map(p => p.text).join(" ")).join("\n");
    // Extraction does not rely on cacheManager yet as it's a one-off analytical task
    // It constructs its own specialized context.
    const relevantIds = await this.librarian.identifyRelevantEntities(conversationText, project);
    const storyData = PromptBuilder.buildStructuredStoryData(project, undefined, relevantIds);
    
    const basePrompt = `
対話履歴から物語設定の変更点を抽出し、JSON形式で出力せよ。
【STORY_DATA】
${storyData}
【MEMORY】
${memory || "なし"}
【HISTORY】
${JSON.stringify(history)}
`.trim();

    const tasks: Promise<ExtractionResult>[] = [];
    const domains = detection.domains || [];

    if (domains.length === 0) {
      tasks.push(this._runExtraction(basePrompt, Prompts.SYNC_EXTRACTOR_SOUL, 'Architect/Extraction:General', processOps));
    } else {
      if (domains.includes('ENTITIES')) tasks.push(this._runExtraction(basePrompt, Prompts.EXTRACTOR_SOUL_ENTITIES, 'Architect/Extraction:Entities', processOps));
      if (domains.includes('FOUNDATION')) tasks.push(this._runExtraction(basePrompt, Prompts.EXTRACTOR_SOUL_FOUNDATION, 'Architect/Extraction:Foundation', processOps));
      if (domains.includes('FORESHADOWING')) tasks.push(this._runExtraction(basePrompt, Prompts.EXTRACTOR_SOUL_FORESHADOWING, 'Architect/Extraction:Foreshadowing', processOps));
      if (domains.includes('NARRATIVE')) tasks.push(this._runExtraction(basePrompt, Prompts.EXTRACTOR_SOUL_NARRATIVE, 'Architect/Extraction:Narrative', processOps));
    }

    if (tasks.length === 0) tasks.push(this._runExtraction(basePrompt, Prompts.SYNC_EXTRACTOR_SOUL, 'Architect/Extraction:Fallback', processOps));

    const results = await Promise.all(tasks);
    const seenOps = new Map<string, SyncOperation>();
    const allQuarantine: any[] = [];

    results.forEach(res => {
      res.readyOps.forEach(op => {
        const normName = normalizeJapanese(op.targetName || (op.value as any)?.name || "").trim();
        let uniqueKey = op.targetId ? `${op.path}:${op.targetId}` : (normName ? `${op.path}:NAME:${normName}` : `raw:${op.id}`);
        if (seenOps.has(uniqueKey)) {
          if ((op.confidence || 0) > (seenOps.get(uniqueKey)!.confidence || 0)) seenOps.set(uniqueKey, op);
        } else seenOps.set(uniqueKey, op);
      });
      allQuarantine.push(...res.quarantineItems);
    });

    return { readyOps: Array.from(seenOps.values()), quarantineItems: allQuarantine };
  }

  private async _runExtraction(content: string, systemInstruction: string, label: string, processOps: (json: any) => ExtractionResult): Promise<ExtractionResult> {
    return runGeminiRequest({
       model: 'gemini-3-pro-preview',
       contents: [{ role: 'user', parts: [{ text: content }] }],
       config: {
         systemInstruction: `${systemInstruction}\n\n${Prompts.STRICT_JSON_ENFORCEMENT}`,
         responseMimeType: "application/json",
         responseSchema: { type: Type.ARRAY, items: { ...Schemas.syncOperationSchema } },
         maxOutputTokens: 32768,
         thinkingConfig: { thinkingBudget: 4000 } 
       },
       usageLabel: label,
       onUsage: this.onUsage,
       logCallback: this.logCallback,
       mapper: (res) => processOps(res.text)
    });
  }

  async summarize(currentMemory: string, oldMessages: GeminiContent[]): Promise<string> {
    const prompt = `
以下の対話履歴から、物語設定に関する「決定事項(Decisions)」と「未解決の課題(Open Questions)」を抽出し、JSON形式のサマリーを更新してください。
これまでのメモリを上書き・統合し、最新の状態を維持してください。

【現在のメモリ】
${currentMemory || "なし"}

【追加の対話】
${JSON.stringify(oldMessages)}
`.trim();

    return runGeminiRequest({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        systemInstruction: `あなたは物語の司書です。対話から重要な決定事項を抽出し、JSON形式で返してください。\n${Prompts.STRICT_JSON_ENFORCEMENT}`,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            decisions: { type: Type.ARRAY, items: { type: Type.STRING }, description: "確定した設定や展開" },
            open_questions: { type: Type.ARRAY, items: { type: Type.STRING }, description: "今後検討が必要な項目" }
          },
          required: ["decisions", "open_questions"]
        }
      },
      usageLabel: 'Architect/MemoryConsolidation',
      onUsage: this.onUsage,
      logCallback: this.logCallback,
      mapper: (res) => res.text || currentMemory
    });
  }

  async whisper(chunk: string, project: StoryProject, activeChapterId: string): Promise<WhisperAdvice | null> {
    const storyData = PromptBuilder.buildStructuredStoryData(project, activeChapterId);
    return runGeminiRequest({
      model: 'gemini-3-flash-preview',
      contents: `【STORY_DATA】\n${storyData}\n【CHUNK】\n"${chunk}"`,
      config: { 
        systemInstruction: `${Prompts.WHISPER_SOUL}\n\n${Prompts.STRICT_JSON_ENFORCEMENT}`,
        responseMimeType: "application/json", 
        responseSchema: Schemas.whisperSchema 
      },
      usageLabel: 'Architect/WhisperScan',
      onUsage: this.onUsage,
      logCallback: this.logCallback,
      mapper: (res) => res.text?.includes("なし") ? null : safeJsonParse<WhisperAdvice>(res.text, 'Whisper').value || null
    });
  }
}
