
import { AiModel, StoryProject, Character, UsageCallback, LogCallback } from "../../../types";
import { runGeminiRequest, getClient } from "../core";
import { handleGeminiError, trackUsage } from "../utils";
import * as Prompts from "../prompts";
import { Modality } from "@google/genai";

export class VisualAgent {
  constructor(private onUsage?: UsageCallback, private logCallback: LogCallback = () => {}) {}

  async generatePortrait(character: Character, project: StoryProject): Promise<string> {
    const ai = getClient();
    const visualDesc = await runGeminiRequest({
      model: AiModel.FAST,
      contents: Prompts.VISUAL_DESCRIPTION_PROMPT(character, project.bible.tone),
      usageLabel: 'Artist/Desc',
      onUsage: this.onUsage,
      logCallback: this.logCallback,
      mapper: (res) => res.text || `${character.profile.name} portrait.`
    });

    return await handleGeminiError(async () => {
      const res = await ai.models.generateContent({
        model: AiModel.IMAGE,
        contents: [{ parts: [{ text: Prompts.PORTRAIT_PROMPT(visualDesc) }] }],
        config: { imageConfig: { aspectRatio: "3:4" } }
      });
      trackUsage(res, AiModel.IMAGE, 'Artist/Painter', this.onUsage);
      const part = res.candidates?.[0]?.content?.parts.find(p => p.inlineData);
      if (!part?.inlineData) throw new Error("Artist Fail");
      return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
    }, 'Artist/Painter', this.logCallback);
  }

  async synthesizeSpeech(text: string, voiceName: string): Promise<ArrayBuffer> {
    const ai = getClient();
    return await handleGeminiError(async () => {
      const res = await ai.models.generateContent({
        model: AiModel.TTS,
        contents: [{ parts: [{ text: `Say: ${text}` }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName } } }
        }
      });
      trackUsage(res, AiModel.TTS, 'Voice', this.onUsage);
      const data = res.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (!data) throw new Error("TTS Fail");
      const bin = atob(data); const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      return bytes.buffer;
    }, 'Voice', this.logCallback);
  }
}
