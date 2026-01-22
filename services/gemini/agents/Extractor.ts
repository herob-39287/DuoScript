
import { AI_MODELS, TOKEN_LIMITS } from "../../../constants";
import { StoryProject, GeminiContent, UsageCallback, LogCallback, DetectionResult, ExtractionResult, SyncOperation } from "../../../types";
import { PromptBuilder } from "../promptBuilder";
import { LibrarianAgent } from "./Librarian";
import * as Prompts from "../prompts";
import { STRICT_JSON_ENFORCEMENT } from "../prompts/resources";
import * as Schemas from "../schemas";
import { Type } from "@google/genai";
import { normalizeJapanese } from "../../../utils/stringUtils";
import { BaseAgent } from "./BaseAgent";
import { GeminiClient } from "../core";

export class ExtractorAgent extends BaseAgent {
  private librarian: LibrarianAgent;

  constructor(client?: GeminiClient) {
    super(client);
    this.librarian = new LibrarianAgent(client);
  }

  async extractSyncOps(
    history: GeminiContent[], 
    project: StoryProject, 
    memory: string, 
    detection: DetectionResult, 
    processOps: (json: any) => ExtractionResult,
    onUsage: UsageCallback,
    logCallback: LogCallback
  ): Promise<ExtractionResult> {
    const conversationText = history.map(h => h.parts.map(p => p.text).join(" ")).join("\n");
    const relevantIds = await this.librarian.identifyRelevantEntities(conversationText, project, onUsage, logCallback);
    
    const storyData = PromptBuilder.buildFocalData(project, relevantIds);
    const lang = project.meta.language || 'ja';
    
    const basePrompt = `Extract story setting changes from the dialogue history and output in JSON.\n【STORY_DATA】\n${storyData}\n【MEMORY】\n${memory || "None"}\n【HISTORY】\n${JSON.stringify(history)}`;

    const tasks: Promise<ExtractionResult>[] = [];
    const domains = detection.domains || [];

    if (domains.length === 0) {
      tasks.push(this._runExtraction(basePrompt, Prompts.SYNC_EXTRACTOR_SOUL(lang), 'Architect/Extraction:General', processOps, lang, onUsage, logCallback));
    } else {
      if (domains.includes('ENTITIES')) tasks.push(this._runExtraction(basePrompt, Prompts.EXTRACTOR_SOUL_ENTITIES(lang), 'Architect/Extraction:Entities', processOps, lang, onUsage, logCallback));
      if (domains.includes('FOUNDATION')) tasks.push(this._runExtraction(basePrompt, Prompts.EXTRACTOR_SOUL_FOUNDATION(lang), 'Architect/Extraction:Foundation', processOps, lang, onUsage, logCallback));
      if (domains.includes('FORESHADOWING')) tasks.push(this._runExtraction(basePrompt, Prompts.EXTRACTOR_SOUL_FORESHADOWING(lang), 'Architect/Extraction:Foreshadowing', processOps, lang, onUsage, logCallback));
      if (domains.includes('NARRATIVE')) tasks.push(this._runExtraction(basePrompt, Prompts.EXTRACTOR_SOUL_NARRATIVE(lang), 'Architect/Extraction:Narrative', processOps, lang, onUsage, logCallback));
    }

    if (tasks.length === 0) tasks.push(this._runExtraction(basePrompt, Prompts.SYNC_EXTRACTOR_SOUL(lang), 'Architect/Extraction:Fallback', processOps, lang, onUsage, logCallback));

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

  private async _runExtraction(
    content: string, 
    systemInstruction: string, 
    label: string, 
    processOps: (json: any) => ExtractionResult, 
    lang: 'ja' | 'en',
    onUsage: UsageCallback,
    logCallback: LogCallback
  ): Promise<ExtractionResult> {
    return this.client.request({
       model: AI_MODELS.REASONING,
       contents: [{ role: 'user', parts: [{ text: content }] }],
       config: {
         systemInstruction: `${systemInstruction}\n\n${STRICT_JSON_ENFORCEMENT}`,
         responseMimeType: "application/json",
         responseSchema: { type: Type.ARRAY, items: { ...Schemas.getSyncOperationSchema(lang) } },
         maxOutputTokens: TOKEN_LIMITS.DEFAULT_OUTPUT,
         thinkingConfig: { thinkingBudget: TOKEN_LIMITS.THINKING_MEDIUM } 
       },
       usageLabel: label,
       onUsage: onUsage,
       logCallback: logCallback,
       mapper: (res) => processOps(res.text)
    });
  }
}
