
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
    const lang = project.meta.language || 'ja';

    if (isContextActive) {
      try {
        cacheName = await cacheManager.getArchitectCache(project, this.logCallback);
        systemInstruction = PromptBuilder.buildDynamicArchitectContext(memory, relevantIds, true, lang);
      } catch (e) {
        console.warn("Cache failed, falling back to full context injection.");
        systemInstruction = PromptBuilder.buildArchitectMTP(project, memory, relevantIds, true);
      }
    } else {
      systemInstruction = PromptBuilder.buildArchitectMTP(project, memory, relevantIds, false);
    }

    const dynamicSystemInstruction = `
${systemInstruction}

# Response Rules:
- Communicate in natural ${lang === 'ja' ? 'Japanese' : 'English'}.
- Stimulate the writer's creativity.
- If the user seems to want to "finalize settings", encourage Neural Sync.
`.trim();

    return runGeminiRequest({
      model: 'gemini-3-pro-preview',
      contents: [...history, { role: 'user', parts: [{ text: input }] }],
      config: {
        systemInstruction: dynamicSystemInstruction,
        cachedContent: cacheName,
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
    const lang = project.meta.language || 'ja';

    if (isContextActive) {
      try {
        cacheName = await cacheManager.getArchitectCache(project, this.logCallback);
        systemInstruction = PromptBuilder.buildDynamicArchitectContext(memory, relevantIds, true, lang);
      } catch (e) {
        console.warn("Cache failed, falling back.");
        systemInstruction = PromptBuilder.buildArchitectMTP(project, memory, relevantIds, true);
      }
    } else {
      systemInstruction = PromptBuilder.buildArchitectMTP(project, memory, relevantIds, false);
    }

    const dynamicSystemInstruction = `
${systemInstruction}

# Response Rules:
- Communicate in natural ${lang === 'ja' ? 'Japanese' : 'English'}.
- Stimulate the writer's creativity.
- If the user seems to want to "finalize settings", encourage Neural Sync.
`.trim();

    const ai = getClient();
    const contents = [...history, { role: 'user', parts: [{ text: input }] }];

    try {
      const config = {
        systemInstruction: dynamicSystemInstruction,
        cachedContent: cacheName, 
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
      if (allowSearch) {
        this.logCallback('info', 'Architect', 'Retrying without search...');
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
    // Intent Detection handles limited languages so use JA default for now or switch context
    // Actually, detector should understand the language of input.
    // We will use English for system instructions to ensuring better instruction following, but output is JSON anyway.
    return runGeminiRequest({
      model: 'gemini-3-flash-preview',
      contents: Prompts.DETECTION_PROMPT(input),
      config: { 
        systemInstruction: `${Prompts.DETECTOR_SOUL('en')}\n\n${Prompts.STRICT_JSON_ENFORCEMENT}`,
        responseMimeType: "application/json", 
        responseSchema: Schemas.getDetectionSchema('en') 
      },
      usageLabel: 'Architect/IntentDetection',
      onUsage: this.onUsage,
      logCallback: this.logCallback,
      mapper: (res) => safeJsonParse<DetectionResult>(res.text, 'Detector').value || Schemas.DEFAULT_RESPONSES.DETECTION
    });
  }

  async extractSyncOps(history: GeminiContent[], project: StoryProject, memory: string, detection: DetectionResult, processOps: (json: any) => ExtractionResult): Promise<ExtractionResult> {
    const conversationText = history.map(h => h.parts.map(p => p.text).join(" ")).join("\n");
    const relevantIds = await this.librarian.identifyRelevantEntities(conversationText, project);
    const storyData = PromptBuilder.buildStructuredStoryData(project, undefined, relevantIds);
    const lang = project.meta.language || 'ja';
    const persona = project.meta.preferences?.aiPersona || "STANDARD";
    
    const basePrompt = `
Extract story setting changes from the dialogue history and output in JSON.
【STORY_DATA】
${storyData}
【MEMORY】
${memory || "None"}
【HISTORY】
${JSON.stringify(history)}
`.trim();

    const tasks: Promise<ExtractionResult>[] = [];
    const domains = detection.domains || [];

    // Use specific language instructions
    if (domains.length === 0) {
      tasks.push(this._runExtraction(basePrompt, Prompts.SYNC_EXTRACTOR_SOUL(lang), 'Architect/Extraction:General', processOps, lang));
    } else {
      if (domains.includes('ENTITIES')) tasks.push(this._runExtraction(basePrompt, Prompts.EXTRACTOR_SOUL_ENTITIES(lang), 'Architect/Extraction:Entities', processOps, lang));
      if (domains.includes('FOUNDATION')) tasks.push(this._runExtraction(basePrompt, Prompts.EXTRACTOR_SOUL_FOUNDATION(lang), 'Architect/Extraction:Foundation', processOps, lang));
      if (domains.includes('FORESHADOWING')) tasks.push(this._runExtraction(basePrompt, Prompts.EXTRACTOR_SOUL_FORESHADOWING(lang), 'Architect/Extraction:Foreshadowing', processOps, lang));
      if (domains.includes('NARRATIVE')) tasks.push(this._runExtraction(basePrompt, Prompts.EXTRACTOR_SOUL_NARRATIVE(lang), 'Architect/Extraction:Narrative', processOps, lang));
    }

    if (tasks.length === 0) tasks.push(this._runExtraction(basePrompt, Prompts.SYNC_EXTRACTOR_SOUL(lang), 'Architect/Extraction:Fallback', processOps, lang));

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

  private async _runExtraction(content: string, systemInstruction: string, label: string, processOps: (json: any) => ExtractionResult, lang: 'ja' | 'en'): Promise<ExtractionResult> {
    return runGeminiRequest({
       model: 'gemini-3-pro-preview',
       contents: [{ role: 'user', parts: [{ text: content }] }],
       config: {
         systemInstruction: `${systemInstruction}\n\n${Prompts.STRICT_JSON_ENFORCEMENT}`,
         responseMimeType: "application/json",
         responseSchema: { type: Type.ARRAY, items: { ...Schemas.getSyncOperationSchema(lang) } },
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
Extract "Decisions" and "Open Questions" regarding story settings from the following dialogue history, and update the JSON summary.
Overwrite and integrate with the current memory to maintain the latest state.

【CURRENT MEMORY】
${currentMemory || "None"}

【ADDITIONAL DIALOGUE】
${JSON.stringify(oldMessages)}
`.trim();

    return runGeminiRequest({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        systemInstruction: `You are a story librarian. Extract key decisions and return in JSON.\n${Prompts.STRICT_JSON_ENFORCEMENT}`,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            decisions: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Decided settings or plot points" },
            open_questions: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Items requiring further discussion" }
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
    const lang = project.meta.language || 'ja';
    return runGeminiRequest({
      model: 'gemini-3-flash-preview',
      contents: `【STORY_DATA】\n${storyData}\n【CHUNK】\n"${chunk}"`,
      config: { 
        systemInstruction: `${Prompts.WHISPER_SOUL(lang)}\n\n${Prompts.STRICT_JSON_ENFORCEMENT}`,
        responseMimeType: "application/json", 
        responseSchema: Schemas.getWhisperSchema(lang)
      },
      usageLabel: 'Architect/WhisperScan',
      onUsage: this.onUsage,
      logCallback: this.logCallback,
      mapper: (res) => res.text?.includes("なし") || res.text?.includes("None") ? null : safeJsonParse<WhisperAdvice>(res.text, 'Whisper').value || null
    });
  }

  async genesisFill(project: StoryProject, currentProfile: any, fieldLabel: string): Promise<string> {
    const lang = project.meta.language || 'ja';
    const worldContext = `Setting: ${project.bible.setting}\nTone: ${project.bible.tone}`;
    const profileStr = JSON.stringify(currentProfile, null, 2);

    return runGeminiRequest({
      model: 'gemini-3-flash-preview',
      contents: Prompts.GENESIS_FILL_PROMPT(fieldLabel, profileStr, worldContext, lang),
      config: {
        maxOutputTokens: 200,
        temperature: 0.8 // Slightly creative
      },
      usageLabel: 'Architect/GenesisFill',
      onUsage: this.onUsage,
      logCallback: this.logCallback,
      mapper: (res) => res.text.trim()
    });
  }
}
