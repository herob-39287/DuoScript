import { VisualContext, Character, UsageCallback, LogCallback } from '../../../types';
import { AI_MODELS } from '../../../constants';
import { handleGeminiError, trackUsage } from '../utils';
import * as Prompts from '../prompts';
import { BaseAgent } from './BaseAgent';
import { GeminiClient } from '../core';

export class VisualAgent extends BaseAgent {
  constructor(client: GeminiClient) {
    super(client);
  }

  async generatePortrait(
    character: Character,
    context: VisualContext,
    onUsage: UsageCallback,
    logCallback: LogCallback,
  ): Promise<string> {
    const visualDesc = await this.client.request<string>({
      model: AI_MODELS.FAST,
      contents: Prompts.VISUAL_DESCRIPTION_PROMPT(character.profile.name, context.bible.tone),
      usageLabel: 'Visual/PortraitPromptGen',
      onUsage: onUsage,
      logCallback: logCallback,
      mapper: (res) => res.text || `${character.profile.name} portrait.`,
    });

    return await handleGeminiError(
      async () => {
        const res = await this.client.genAI.models.generateContent({
          model: AI_MODELS.IMAGE,
          contents: [{ parts: [{ text: Prompts.PORTRAIT_PROMPT(visualDesc) }] }],
          config: { imageConfig: { aspectRatio: '3:4' } },
        });
        trackUsage(res, AI_MODELS.IMAGE, 'Visual/PortraitImageGen', onUsage);
        const part = res.candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData);
        if (!part?.inlineData) throw new Error('Artist Fail');
        return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
      },
      'Artist/Painter',
      logCallback,
    );
  }

  async synthesizeSpeech(
    text: string,
    voiceName: string,
    onUsage: UsageCallback,
    logCallback: LogCallback,
  ): Promise<string> {
    return await handleGeminiError(
      async () => {
        const res = await this.client.genAI.models.generateContent({
          model: AI_MODELS.TTS,
          contents: [{ parts: [{ text: `Say this in character: ${text}` }] }],
          config: {
            responseModalities: ['AUDIO'],
            speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName } } },
          },
        });
        trackUsage(res, AI_MODELS.TTS, 'Visual/TTSSpeechGen', onUsage);
        const data = res.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        if (!data) throw new Error('TTS Fail');
        return data;
      },
      'Voice',
      logCallback,
    );
  }
}
