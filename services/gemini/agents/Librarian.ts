import { StoryProject, UsageCallback, LogCallback } from '../../../types';
import { parseWithSchema } from '../utils';
import { Type } from '@google/genai';
import * as Prompts from '../prompts';
import { STRICT_JSON_ENFORCEMENT } from '../prompts/resources';
import { ragService } from '../../ragService';
import { z } from 'zod';
import { AI_MODELS } from '../../../constants';
import { BaseAgent } from './BaseAgent';
import { GeminiClient } from '../core';

export class LibrarianAgent extends BaseAgent {
  constructor(client: GeminiClient) {
    super(client);
  }

  async identifyRelevantEntities(
    text: string,
    project: StoryProject,
    onUsage: UsageCallback,
    logCallback: LogCallback,
  ): Promise<string[]> {
    const textSnippet = text.slice(-2000);
    const lang = project.meta.language || 'ja';

    // Step 1: Hybrid Search (RAG)
    const contextQuery = `${textSnippet}\n${project.sync.chatHistory
      .slice(-2)
      .map((m) => m.content)
      .join('\n')}`.slice(-1000);
    const ragResults = await ragService.hybridSearch(contextQuery, project, 20);

    if (ragResults.length === 0) return [];

    // Step 2: LLM Re-ranking (Tier 3)
    const candidatesForPrompt = ragResults.map((r) => ({
      id: r.id,
      name: r.name,
      type: r.type,
      relevance: r.reason,
    }));
    const prompt = `Identify the IDs of items whose detailed settings need to be referenced in the context of the following text.\n\n【TEXT】\n"${textSnippet}"\n\n【CANDIDATES】\n${JSON.stringify(candidatesForPrompt)}`;

    return this.client.request({
      model: AI_MODELS.FAST,
      contents: prompt,
      config: {
        systemInstruction: `${Prompts.LIBRARIAN_SOUL(lang)}\n\n${STRICT_JSON_ENFORCEMENT}`,
        responseMimeType: 'application/json',
        responseSchema: { type: Type.ARRAY, items: { type: Type.STRING } },
      },
      usageLabel: 'Librarian/ContextAnalysis',
      onUsage: onUsage,
      logCallback: logCallback,
      mapper: (res) => parseWithSchema<string[]>(res.text, z.array(z.string()), 'Librarian', []),
    });
  }
}
