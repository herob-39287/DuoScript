
import { GoogleGenAI, Modality, Type, GenerateContentResponse } from "@google/genai";
import { 
  AiModel, StoryProject, ChapterLog, SyncOperation, NexusBranch,
  DetectionResult, IntegrityScanResponse, NexusSimulationResponse,
  ChapterPackageResponse, ProjectGenerationResponse,
  BibleIssue, GeminiContent, UsageCallback, LogCallback
} from "../../types";
import { handleGeminiError, getCompressedContext, trackUsage, safeJsonParse, resolveModelConfig } from "./utils";
import * as Schemas from "./schemas";
import * as Prompts from "./prompts";

const getClient = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * Common helper for non-streaming Gemini API requests.
 */
async function runGeminiRequest<T>(params: {
  model: string;
  contents: string | GeminiContent[];
  config?: any;
  usageLabel: string;
  onUsage?: UsageCallback;
  logCallback: LogCallback;
  mapper: (response: GenerateContentResponse) => T;
}): Promise<T> {
  return handleGeminiError(async () => {
    const ai = getClient();
    const response = await ai.models.generateContent({
      model: params.model,
      contents: params.contents as any, 
      config: params.config,
    });

    trackUsage(response, params.model, params.usageLabel, params.onUsage);
    return params.mapper(response);
  }, params.usageLabel, params.logCallback);
}

export const chatWithArchitect = async (
  history: GeminiContent[], 
  userInput: string, 
  project: StoryProject, 
  useSearch: boolean,
  onUsage: UsageCallback,
  logCallback: LogCallback
): Promise<{ text: string; sources?: any[] }> => {
  const { model, thinkingBudget } = resolveModelConfig('CHAT', userInput.length > 200 ? 'complex' : 'basic');
  const ctx = getCompressedContext(project);

  return runGeminiRequest({
    model,
    contents: history,
    usageLabel: 'Architect Chat',
    onUsage,
    logCallback,
    config: {
      systemInstruction: Prompts.ARCHITECT_SYSTEM_INSTRUCTION(ctx),
      thinkingConfig: thinkingBudget ? { thinkingBudget } : undefined,
      tools: useSearch ? [{ googleSearch: {} }] : undefined
    },
    mapper: (response) => {
      let sources: any[] = [];
      if (response.candidates?.[0]?.groundingMetadata?.groundingChunks) {
        sources = response.candidates[0].groundingMetadata.groundingChunks
          .filter((c: any) => c.web)
          .map((c: any) => ({ title: c.web.title, uri: c.web.uri }));
      }
      return { text: response.text || "", sources };
    }
  });
};

export const generateDraftStream = async (
  chapter: ChapterLog,
  tone: string,
  useThinking: boolean,
  project: StoryProject,
  logCallback: LogCallback
) => {
  const ai = getClient();
  const { model, thinkingBudget } = resolveModelConfig('DRAFT', useThinking ? 'creative' : 'basic');
  const ctx = getCompressedContext(project);

  return ai.models.generateContentStream({
    model,
    contents: [{ 
      role: 'user', 
      parts: [{ 
        text: Prompts.DRAFT_PROMPT(chapter.title, chapter.summary, chapter.beats)
      }] 
    }],
    config: {
      systemInstruction: Prompts.WRITER_SYSTEM_INSTRUCTION(ctx, tone),
      thinkingConfig: thinkingBudget ? { thinkingBudget } : undefined
    },
  });
};

export const generateCharacterPortrait = async (
  characterDescription: string,
  onUsage: UsageCallback,
  logCallback: LogCallback
): Promise<string> => {
  const { model } = resolveModelConfig('IMAGE');
  return runGeminiRequest({
    model,
    contents: [{
      parts: [{ text: Prompts.PORTRAIT_PROMPT(characterDescription) }]
    } as any],
    usageLabel: 'Portrait Generator',
    onUsage,
    logCallback,
    config: {
      imageConfig: { aspectRatio: "3:4" }
    },
    mapper: (response) => {
      for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) {
          return `data:image/png;base64,${part.inlineData.data}`;
        }
      }
      throw new Error("画像データが生成されませんでした。");
    }
  });
};

export const generateSpeech = async (
  text: string,
  voiceName: string = 'Zephyr',
  onUsage: UsageCallback,
  logCallback: LogCallback
): Promise<ArrayBuffer> => {
  const { model } = resolveModelConfig('TTS');
  return runGeminiRequest({
    model,
    contents: [{ parts: [{ text }] } as any],
    usageLabel: 'Speech Generator',
    onUsage,
    logCallback,
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName }
        }
      }
    },
    mapper: (response) => {
      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (!base64Audio) throw new Error("音声データが生成されませんでした。");

      const binaryString = atob(base64Audio);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      return bytes.buffer;
    }
  });
};

export const getArchitectWhisper = async (
  lastChunk: string,
  project: StoryProject,
  onUsage: UsageCallback,
  logCallback: LogCallback
): Promise<{ text: string; type: 'info' | 'alert' } | null> => {
  const ctx = getCompressedContext(project);
  const { model } = resolveModelConfig('AUTO_GEN');
  return runGeminiRequest({
    model,
    contents: [{
      role: 'user',
      parts: [{ text: Prompts.WHISPER_PROMPT(lastChunk, ctx) }]
    } as any],
    usageLabel: 'Architect Whisper',
    onUsage,
    logCallback,
    config: {
      systemInstruction: "あなたは厳しいが信頼できる物語の設計士です。整合性への執着を持ってください。"
    },
    mapper: (response) => {
      const text = response.text?.trim() || "なし";
      if (text === "なし" || text.length < 5) return null;
      return { text, type: text.includes("矛盾") || text.includes("間違い") ? 'alert' : 'info' };
    }
  });
};

export const detectSettingChange = async (
  userInput: string,
  onUsage: UsageCallback,
  logCallback: LogCallback
): Promise<DetectionResult> => {
  const { model } = resolveModelConfig('AUTO_GEN');
  return runGeminiRequest({
    model,
    contents: [{ role: 'user', parts: [{ text: Prompts.DETECTION_PROMPT(userInput) }] } as any],
    usageLabel: 'Intent Detector',
    onUsage,
    logCallback,
    config: { 
      responseMimeType: "application/json",
      responseSchema: Schemas.detectionSchema
    },
    mapper: (response) => safeJsonParse<DetectionResult>(response.text, Schemas.DEFAULT_RESPONSES.DETECTION, logCallback)
  });
};

export const extractSettingsFromChat = async (
  history: GeminiContent[], 
  project: StoryProject,
  detection: DetectionResult,
  onUsage: UsageCallback,
  logCallback: LogCallback
): Promise<SyncOperation[]> => {
  const { model, thinkingBudget } = resolveModelConfig('CHAT', 'complex');
  return runGeminiRequest({
    model,
    contents: [
      { 
        role: 'user', 
        parts: [{ 
          text: Prompts.SYNC_EXTRACT_PROMPT(history.slice(-4), detection.instructionSummary, detection.categories) 
        }] 
      } as any
    ],
    usageLabel: 'NeuralSync Extractor',
    onUsage,
    logCallback,
    config: { 
      responseMimeType: "application/json",
      responseSchema: { type: Type.ARRAY, items: Schemas.syncOperationSchema as any },
      thinkingConfig: thinkingBudget ? { thinkingBudget } : undefined
    },
    mapper: (response) => {
      const ops = safeJsonParse<SyncOperation[]>(response.text, Schemas.DEFAULT_RESPONSES.SYNC_OPS, logCallback);
      return ops.map(op => ({
        ...op,
        id: op.id || crypto.randomUUID() // Ensure ID for stable UI state management
      }));
    }
  });
};

export const analyzeBibleIntegrity = async (
  project: StoryProject, 
  onUsage: UsageCallback, 
  logCallback: LogCallback
): Promise<BibleIssue[]> => {
  const { model, thinkingBudget } = resolveModelConfig('SCAN', 'critical');
  const bible = project.bible;
  
  const compactBible = {
    grandArc: bible.grandArc,
    characters: bible.characters.map(c => ({ name: c.name, motivation: c.motivation, status: c.status })),
    laws: bible.laws,
    foreshadowing: bible.foreshadowing
  };

  return runGeminiRequest({
    model,
    contents: [{
      role: 'user',
      parts: [{ text: Prompts.INTEGRITY_SCAN_PROMPT(JSON.stringify(compactBible)) }]
    } as any],
    usageLabel: 'Integrity Scan',
    onUsage,
    logCallback,
    config: {
      responseMimeType: "application/json",
      responseSchema: Schemas.integrityScanSchema,
      thinkingConfig: thinkingBudget ? { thinkingBudget } : undefined
    },
    mapper: (response) => {
      const parsed = safeJsonParse<IntegrityScanResponse>(response.text, Schemas.DEFAULT_RESPONSES.INTEGRITY, logCallback);
      return parsed.issues.map(issue => ({
        ...issue,
        id: issue.id || crypto.randomUUID()
      }));
    }
  });
};

export const maintainSummaryBuffer = async (
  project: StoryProject,
  onUsage: UsageCallback,
  logCallback: LogCallback
): Promise<string> => {
  const { model, thinkingBudget } = resolveModelConfig('CHAT', 'complex');
  return runGeminiRequest({
    model,
    contents: [{
      role: 'user',
      parts: [{ text: Prompts.SUMMARY_BUFFER_PROMPT(JSON.stringify(project.bible)) }]
    } as any],
    usageLabel: 'Summary Maintenance',
    onUsage,
    logCallback,
    config: {
      thinkingConfig: thinkingBudget ? { thinkingBudget } : undefined
    },
    mapper: (response) => response.text || ""
  });
};

export const simulateBranch = async (hyp: string, project: StoryProject, onUsage: UsageCallback, logCallback: LogCallback): Promise<NexusBranch> => {
  const { model, thinkingBudget } = resolveModelConfig('SIM', 'complex');
  const ctx = getCompressedContext(project);

  return runGeminiRequest({
    model,
    contents: [{ role: 'user', parts: [{ text: Prompts.NEXUS_SIM_PROMPT(hyp, ctx) }] } as any],
    usageLabel: 'Nexus',
    onUsage,
    logCallback,
    config: {
      responseMimeType: "application/json",
      responseSchema: Schemas.nexusSchema,
      thinkingConfig: thinkingBudget ? { thinkingBudget } : undefined
    },
    mapper: (response) => {
      const res = safeJsonParse<NexusSimulationResponse>(response.text, Schemas.DEFAULT_RESPONSES.NEXUS, logCallback);
      return { ...res, id: crypto.randomUUID(), timestamp: Date.now() } as NexusBranch;
    }
  });
};

export const suggestNextSentence = async (content: string, project: StoryProject, onUsage: UsageCallback, logCallback: LogCallback): Promise<string[]> => {
  const ctx = getCompressedContext(project);
  const { model } = resolveModelConfig('AUTO_GEN');
  
  return runGeminiRequest({
    model,
    contents: [{ role: 'user', parts: [{ text: Prompts.NEXT_SENTENCE_PROMPT(content, ctx) }] } as any],
    usageLabel: 'Writer Copilot',
    onUsage,
    logCallback,
    config: {
      responseMimeType: "application/json",
      responseSchema: Schemas.suggestionsSchema as any
    },
    mapper: (response) => safeJsonParse<string[]>(response.text, Schemas.DEFAULT_RESPONSES.SUGGESTIONS, logCallback)
  });
};

export const generateFullChapterPackage = async (project: StoryProject, chapter: ChapterLog, onUsage: UsageCallback, logCallback: LogCallback): Promise<ChapterPackageResponse> => {
  const { model, thinkingBudget } = resolveModelConfig('DRAFT', 'critical');
  const ctx = getCompressedContext(project);
  
  return runGeminiRequest({
    model,
    contents: [{ role: 'user', parts: [{ text: Prompts.CHAPTER_PACKAGE_PROMPT(chapter.title, chapter.summary, ctx) }] } as any],
    usageLabel: 'Chapter Architect',
    onUsage,
    logCallback,
    config: {
      responseMimeType: "application/json",
      responseSchema: Schemas.chapterPackageSchema,
      thinkingConfig: thinkingBudget ? { thinkingBudget } : undefined
    },
    mapper: (response) => {
      const pkg = safeJsonParse<ChapterPackageResponse>(response.text, Schemas.DEFAULT_RESPONSES.CHAPTER_PACKAGE, logCallback);
      return {
        ...pkg,
        beats: (pkg.beats || []).map(b => ({ ...b, id: b.id || crypto.randomUUID() }))
      };
    }
  });
};

export const generateRandomProject = async (theme: string, logCallback: LogCallback): Promise<ProjectGenerationResponse> => {
  const { model } = resolveModelConfig('AUTO_GEN');
  return runGeminiRequest({
    model,
    contents: [{ role: 'user', parts: [{ text: Prompts.PROJECT_GEN_PROMPT(theme) }] } as any],
    usageLabel: 'Project Generator',
    onUsage: (u) => {},
    logCallback,
    config: {
      responseMimeType: "application/json",
      responseSchema: Schemas.projectGenSchema
    },
    mapper: (response) => safeJsonParse<ProjectGenerationResponse>(response.text, Schemas.DEFAULT_RESPONSES.PROJECT_GEN, logCallback)
  });
};
