
import { AI_MODELS } from "../../../constants";
import { UsageCallback, LogCallback, DetectionResult } from "../../../types";
import * as Prompts from "../prompts";
import { STRICT_JSON_ENFORCEMENT } from "../prompts/resources";
import * as Schemas from "../schemas";
import { DetectionZodSchema } from "../../validation/schemas";
import { parseWithSchema } from "../utils";
import { BaseAgent } from "./BaseAgent";
import { GeminiClient } from "../core";

export class DetectorAgent extends BaseAgent {
  constructor(client: GeminiClient) {
    super(client);
  }

  async detectIntent(input: string, onUsage: UsageCallback, logCallback: LogCallback): Promise<DetectionResult> {
    return this.client.request({
      model: AI_MODELS.FAST,
      contents: Prompts.DETECTION_PROMPT(input),
      config: { 
        systemInstruction: `${Prompts.DETECTOR_SOUL('en')}\n\n${STRICT_JSON_ENFORCEMENT}`,
        responseMimeType: "application/json", 
        responseSchema: Schemas.getDetectionSchema('en') 
      },
      usageLabel: 'Architect/IntentDetection',
      onUsage: onUsage,
      logCallback: logCallback,
      mapper: (res) => parseWithSchema<DetectionResult>(res.text, DetectionZodSchema, 'Detector', Schemas.DEFAULT_RESPONSES.DETECTION)
    });
  }
}
