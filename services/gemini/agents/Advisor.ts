
import { AI_MODELS } from "../../../constants";
import { StoryProject, UsageCallback, LogCallback, WhisperAdvice } from "../../../types";
import { PromptBuilder } from "../promptBuilder";
import * as Prompts from "../prompts";
import { STRICT_JSON_ENFORCEMENT } from "../prompts/resources";
import * as Schemas from "../schemas";
import { WhisperZodSchema } from "../../validation/schemas";
import { parseWithSchema } from "../utils";
import { BaseAgent } from "./BaseAgent";

export class AdvisorAgent extends BaseAgent {
  async whisper(chunk: string, project: StoryProject, activeChapterId: string, onUsage: UsageCallback, logCallback: LogCallback): Promise<WhisperAdvice | null> {
    const storyData = PromptBuilder.buildFocalData(project, [], activeChapterId);
    const lang = project.meta.language || 'ja';
    return this.client.request({
      model: AI_MODELS.FAST,
      contents: `【STORY_DATA】\n${storyData}\n【CHUNK】\n"${chunk}"`,
      config: { 
        systemInstruction: `${Prompts.WHISPER_SOUL(lang)}\n\n${STRICT_JSON_ENFORCEMENT}`,
        responseMimeType: "application/json", 
        responseSchema: Schemas.getWhisperSchema(lang)
      },
      usageLabel: 'Architect/WhisperScan',
      onUsage: onUsage,
      logCallback: logCallback,
      mapper: (res) => res.text?.includes("なし") || res.text?.includes("None") ? null : parseWithSchema<WhisperAdvice | null>(res.text, WhisperZodSchema.nullable(), 'Whisper', null)
    });
  }
}
