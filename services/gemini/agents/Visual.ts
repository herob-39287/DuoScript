
import { StoryProject, Character, UsageCallback, LogCallback } from "../../../types";
import { AI_MODELS } from "../../../constants";
import { handleGeminiError, trackUsage } from "../utils";
import * as Prompts from "../prompts";
import { BaseAgent } from "./BaseAgent";

export class VisualAgent extends BaseAgent {
  async generatePortrait(character: Character, project: StoryProject, onUsage: UsageCallback, logCallback: LogCallback): Promise<string> {
    const visualDesc = await this.client.request<string>({
      model: AI_MODELS.FAST,
      contents: Prompts.VISUAL_DESCRIPTION_PROMPT(character, project.bible.tone),
      usageLabel: 'Visual/PortraitPromptGen',
      onUsage: onUsage,
      logCallback: logCallback,
      mapper: (res) => res.text || `${character.profile.name} portrait.`
    });

    // Image generation uses specialized method from client or direct access if not wrapped
    // Here we use executeWithFallback logic inside client indirectly or direct call if client supports it
    // For now, assuming client abstraction for standard text generation, but for image we might need access
    // or extend client. Given GeminiClient structure, let's assume we use genAI directly for specialized non-text calls 
    // OR we extend GeminiClient to support images.
    // To keep it clean, let's use the underlying genAI instance via a property or method if possible, 
    // or just use the pattern:
    
    // Using handleGeminiError wrapper for now, but accessing genAI via client if public, or new instance?
    // Since BaseAgent has this.client, and GeminiClient wraps genAI.
    // Let's assume we add a helper or just cast for now to access inner genAI, or better, add image support to client.
    // For this refactor, we'll assume we can access the protected genAI or use a specific method.
    // Actually, let's just make a new instance here to avoid breaking encapsulation too much if client doesn't support image yet,
    // OR better, update GeminiClient to expose a method or the instance.
    // Let's access the underlying instance via type casting for expediency in this refactor step.
    const genAI = (this.client as any).genAI; 

    return await handleGeminiError(async () => {
      const res = await genAI.models.generateContent({
        model: AI_MODELS.IMAGE,
        contents: [{ parts: [{ text: Prompts.PORTRAIT_PROMPT(visualDesc) }] }],
        config: { imageConfig: { aspectRatio: "3:4" } }
      });
      trackUsage(res, AI_MODELS.IMAGE, 'Visual/PortraitImageGen', onUsage);
      const part = res.candidates?.[0]?.content?.parts.find((p: any) => p.inlineData);
      if (!part?.inlineData) throw new Error("Artist Fail");
      return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
    }, 'Artist/Painter', logCallback);
  }

  async synthesizeSpeech(text: string, voiceName: string, onUsage: UsageCallback, logCallback: LogCallback): Promise<string> {
    const genAI = (this.client as any).genAI;
    return await handleGeminiError(async () => {
      const res = await genAI.models.generateContent({
        model: AI_MODELS.TTS,
        contents: [{ parts: [{ text: `Say this in character: ${text}` }] }],
        config: {
          responseModalities: ['AUDIO'],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName } } }
        }
      });
      trackUsage(res, AI_MODELS.TTS, 'Visual/TTSSpeechGen', onUsage);
      const data = res.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (!data) throw new Error("TTS Fail");
      return data;
    }, 'Voice', logCallback);
  }
}
