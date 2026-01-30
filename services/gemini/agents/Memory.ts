import { AI_MODELS } from '../../../constants';
import { GeminiContent, UsageCallback, LogCallback } from '../../../types';
import * as Prompts from '../prompts';
import { STRICT_JSON_ENFORCEMENT } from '../prompts/resources';
import { Type } from '@google/genai';
import { BaseAgent } from './BaseAgent';
import { GeminiClient } from '../core';

export class MemoryAgent extends BaseAgent {
  constructor(client: GeminiClient) {
    super(client);
  }

  async summarize(
    currentMemory: string,
    oldMessages: GeminiContent[],
    onUsage: UsageCallback,
    logCallback: LogCallback,
  ): Promise<string> {
    const prompt = Prompts.CHAT_SUMMARIZATION_PROMPT(currentMemory, oldMessages);

    return this.client.request({
      model: AI_MODELS.FAST,
      contents: prompt,
      config: {
        systemInstruction: `You are a story librarian. Extract key decisions and return in JSON.\n${STRICT_JSON_ENFORCEMENT}`,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            decisions: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: 'Decided settings or plot points',
            },
            open_questions: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: 'Items requiring further discussion',
            },
          },
          required: ['decisions', 'open_questions'],
        },
      },
      usageLabel: 'Architect/MemoryConsolidation',
      onUsage: onUsage,
      logCallback: logCallback,
      mapper: (res) => res.text || currentMemory,
    });
  }
}
