
import { StoryProject, GeminiContent, UsageCallback, LogCallback } from "../../../types";
import { PromptBuilder } from "../promptBuilder";
import { LibrarianAgent } from "./Librarian";
import { getSafetySettings } from "../utils";
import { cacheManager } from "../cacheManager";
import { AI_MODELS, TOKEN_LIMITS } from "../../../constants";
import { BaseAgent } from "./BaseAgent";
import { GeminiClient } from "../core";

export class ArchitectAgent extends BaseAgent {
  private librarian: LibrarianAgent;
  
  constructor(client?: GeminiClient) {
    super(client);
    this.librarian = new LibrarianAgent(client);
  }

  private async prepareContext(
    history: GeminiContent[],
    project: StoryProject,
    memory: string,
    onUsage: UsageCallback,
    logCallback: LogCallback,
    isContextActive: boolean,
    precomputedRelevantIds?: string[]
  ) {
    const conversationText = history.map(h => h.parts.map(p => p.text).join(" ")).join("\n");
    
    let relevantIds: string[] = [];
    if (precomputedRelevantIds) {
      relevantIds = precomputedRelevantIds;
    } else if (isContextActive) {
      relevantIds = await this.librarian.identifyRelevantEntities(conversationText, project, onUsage, logCallback);
    }
    
    let cacheName: string | undefined = undefined;
    let useCache = false;

    if (isContextActive) {
      try {
        cacheName = await cacheManager.getArchitectCache(project, logCallback);
        useCache = !!cacheName;
      } catch (e) {
        console.warn("Cache failed, falling back to full context injection.");
      }
    }

    const dynamicSystemInstruction = PromptBuilder.buildArchitectSystemInstruction(
      project, memory, relevantIds, isContextActive, useCache
    );

    return { dynamicSystemInstruction, cacheName };
  }

  async chat(
    history: GeminiContent[], 
    input: string, 
    project: StoryProject, 
    memory: string, 
    allowSearch: boolean, 
    onUsage: UsageCallback,
    logCallback: LogCallback,
    isContextActive: boolean = true,
    precomputedRelevantIds?: string[]
  ) {
    const { dynamicSystemInstruction, cacheName } = await this.prepareContext(
      history, project, memory, onUsage, logCallback, isContextActive, precomputedRelevantIds
    );

    return this.client.request({
      model: AI_MODELS.REASONING,
      contents: [...history, { role: 'user', parts: [{ text: input }] }],
      config: {
        systemInstruction: dynamicSystemInstruction,
        cachedContent: cacheName,
        tools: allowSearch ? [{ googleSearch: {} }] : [],
        safetySettings: getSafetySettings(),
        thinkingConfig: { thinkingBudget: TOKEN_LIMITS.THINKING_MEDIUM }, 
        maxOutputTokens: TOKEN_LIMITS.DEFAULT_OUTPUT
      },
      usageLabel: cacheName ? 'Architect/Chat(Cached)' : 'Architect/Chat',
      onUsage: onUsage,
      logCallback: logCallback,
      mapper: (res) => ({
        text: res.text,
        sources: res.candidates?.[0]?.groundingMetadata?.groundingChunks?.map((c: any) => ({ 
          title: c.web?.title || "Ref", 
          uri: c.web?.uri || "" 
        })) || []
      })
    });
  }

  async *chatStream(
    history: GeminiContent[], 
    input: string, 
    project: StoryProject, 
    memory: string, 
    allowSearch: boolean, 
    onUsage: UsageCallback,
    logCallback: LogCallback,
    isContextActive: boolean = true,
    precomputedRelevantIds?: string[]
  ) {
    const { dynamicSystemInstruction, cacheName } = await this.prepareContext(
      history, project, memory, onUsage, logCallback, isContextActive, precomputedRelevantIds
    );

    const contents = [...history, { role: 'user', parts: [{ text: input }] }];
    const config = {
      systemInstruction: dynamicSystemInstruction,
      cachedContent: cacheName, 
      tools: allowSearch ? [{ googleSearch: {} }] : [],
      safetySettings: getSafetySettings(),
      thinkingConfig: { thinkingBudget: TOKEN_LIMITS.THINKING_MEDIUM }, 
      maxOutputTokens: TOKEN_LIMITS.DEFAULT_OUTPUT
    };

    const stream = this.client.stream({
      model: AI_MODELS.REASONING,
      contents,
      config,
      usageLabel: cacheName ? 'Architect/Chat(Cached)' : 'Architect/Chat',
      onUsage,
      logCallback
    });

    try {
      for await (const chunk of stream) {
        yield chunk;
      }
    } catch (e: any) {
      if (allowSearch && !e.message?.includes('SAFETY')) {
        logCallback('info', 'Architect', 'Retrying without search...');
        const fallbackConfig = { ...config, tools: [], thinkingConfig: { thinkingBudget: TOKEN_LIMITS.THINKING_LIGHT } };
        
        const fallbackStream = this.client.stream({
          model: AI_MODELS.REASONING,
          contents,
          config: fallbackConfig,
          usageLabel: 'Architect/Chat(Fallback)',
          onUsage,
          logCallback
        });

        for await (const chunk of fallbackStream) {
          yield chunk;
        }
      } else {
        throw e;
      }
    }
  }
}
