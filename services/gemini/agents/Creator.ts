import { AI_MODELS, TOKEN_LIMITS } from '../../../constants';
import { CreatorContext, UsageCallback, LogCallback } from '../../../types';
import * as Prompts from '../prompts';
import { STRICT_JSON_ENFORCEMENT } from '../prompts/resources';
import { BrainstormArraySchema } from '../../validation/schemas';
import { parseWithSchema } from '../utils';
import { Type } from '@google/genai';
import { BaseAgent } from './BaseAgent';
import { GeminiClient } from '../core';

export class CreatorAgent extends BaseAgent {
  constructor(client: GeminiClient) {
    super(client);
  }

  async genesisFill(
    context: CreatorContext,
    currentProfile: any,
    fieldLabel: string,
    onUsage: UsageCallback,
    logCallback: LogCallback,
  ): Promise<string> {
    const lang = context.meta.language || 'ja';
    const worldContext = `Setting: ${context.bible.setting}\nTone: ${context.bible.tone}`;
    const profileStr = JSON.stringify(currentProfile, null, 2);

    return this.client.request({
      model: AI_MODELS.FAST,
      contents: Prompts.GENESIS_FILL_PROMPT(fieldLabel, profileStr, worldContext, lang),
      config: { maxOutputTokens: 200, temperature: 0.8 },
      usageLabel: 'Architect/GenesisFill',
      onUsage: onUsage,
      logCallback: logCallback,
      mapper: (res) => res.text.trim(),
    });
  }

  async autoFillItem(
    context: CreatorContext,
    itemType: string,
    itemName: string,
    fieldLabel: string,
    currentItem: any,
    onUsage: UsageCallback,
    logCallback: LogCallback,
  ): Promise<string> {
    const lang = context.meta.language || 'ja';
    const worldContext = `Setting: ${context.bible.setting}\nTone: ${context.bible.tone}\nLaws: ${context.bible.laws.map((l) => l.name).join(', ')}`;
    const itemStr = JSON.stringify(currentItem, null, 2);

    return this.client.request({
      model: AI_MODELS.FAST,
      contents: Prompts.AUTO_FILL_ITEM_PROMPT(
        itemType,
        itemName,
        fieldLabel,
        itemStr,
        worldContext,
        lang,
      ),
      config: { maxOutputTokens: 300, temperature: 0.8 },
      usageLabel: 'Architect/AutoFill',
      onUsage: onUsage,
      logCallback: logCallback,
      mapper: (res) => res.text.trim(),
    });
  }

  async brainstorm(
    context: CreatorContext,
    itemType: string,
    name: string | undefined,
    currentData: any,
    fieldHints: string,
    onUsage: UsageCallback,
    logCallback: LogCallback,
    count: number = 3,
  ): Promise<any[]> {
    const lang = context.meta.language || 'ja';
    const worldContext = `Setting: ${context.bible.setting}\nTone: ${context.bible.tone}\nLaws: ${context.bible.laws.map((l) => l.name).join(', ')}`;
    const currentJson = JSON.stringify(currentData);

    const taskDescription =
      name && name !== 'Unknown' && name.trim().length > 0
        ? `Generate ${count} distinct and creative variations for a "${itemType}" named "${name}".`
        : `Generate ${count} distinct and creative variations for a NEW "${itemType}". You MUST invent a unique Name/Title for each.`;

    const prompt = Prompts.BRAINSTORM_PROMPT(
      itemType,
      taskDescription,
      currentJson,
      worldContext,
      fieldHints,
      lang,
    );

    return this.client.request({
      model: AI_MODELS.REASONING,
      contents: prompt,
      config: {
        systemInstruction: `You are a creative concept artist.\n${STRICT_JSON_ENFORCEMENT}`,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: { name: { type: Type.STRING }, concept_note: { type: Type.STRING } },
          },
        },
        thinkingConfig: { thinkingBudget: TOKEN_LIMITS.THINKING_LIGHT },
      },
      usageLabel: 'Architect/Brainstorm',
      onUsage: onUsage,
      logCallback: logCallback,
      mapper: (res) => parseWithSchema<any[]>(res.text, BrainstormArraySchema, 'Brainstorm', []),
    });
  }
}
