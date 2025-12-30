
import { GoogleGenAI, Modality, Type, GenerateContentResponse } from "@google/genai";
import { 
  AiModel, StoryProject, ChapterLog, SyncOperation, NexusBranch,
  DetectionResult, IntegrityScanResponse, NexusSimulationResponse,
  ChapterPackageResponse, ProjectGenerationResponse, Character,
  BibleIssue, GeminiContent, UsageCallback, LogCallback, ExtractionResult, QuarantineItem, WhisperAdvice
} from "../../types";
import { handleGeminiError, getCompressedContext, trackUsage, safeJsonParse, resolveModelConfig, generateDeterministicSeed, getSafetySettings, DuoScriptError } from "./utils";
import { findMatchCandidates, validateSyncOperation } from "../bibleManager";
import * as Schemas from "./schemas";
import * as Prompts from "./prompts";

const getClient = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

async function runGeminiRequest<T>(params: {
  model: string;
  contents: string | GeminiContent[];
  config?: any;
  usageLabel: string;
  onUsage?: UsageCallback;
  logCallback: LogCallback;
  mapper: (response: GenerateContentResponse) => T;
  safetyPreset?: any;
}): Promise<T> {
  return handleGeminiError(async () => {
    const ai = getClient();
    const inputForSeed = Array.isArray(params.contents) ? JSON.stringify(params.contents) : String(params.contents);
    const safetySettings = getSafetySettings(params.safetyPreset);
    
    const response = await ai.models.generateContent({
      model: params.model,
      contents: (Array.isArray(params.contents) ? { parts: (params.contents[0] as any).parts } : params.contents) as any, 
      config: {
        ...params.config,
        safetySettings,
        seed: params.config?.seed || generateDeterministicSeed(inputForSeed)
      },
    });

    const candidate = response.candidates?.[0];
    if (candidate?.finishReason === 'SAFETY') {
      const blockedCategory = candidate.safetyRatings?.find(r => r.blocked)?.category;
      throw new DuoScriptError("SAFETY_BLOCK", "安全フィルターにより生成がブロックされました。", "Gemini", 403, blockedCategory);
    }

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
  const activeChapterId = project.chapters[project.chapters.length - 1]?.id;
  const ctx = getCompressedContext(project, activeChapterId);

  return handleGeminiError(async () => {
    const ai = getClient();
    const safetySettings = getSafetySettings(project.meta.preferences.safetyPreset);
    
    const response = await ai.models.generateContent({
      model,
      contents: history as any,
      config: {
        systemInstruction: Prompts.ARCHITECT_SYSTEM_INSTRUCTION(ctx),
        thinkingConfig: thinkingBudget ? { thinkingBudget } : undefined,
        tools: useSearch ? [{ googleSearch: {} }] : undefined,
        safetySettings,
        seed: generateDeterministicSeed(userInput + ctx)
      },
    });

    trackUsage(response, model, 'Architect Chat', onUsage);
    
    let sources: any[] = [];
    if (response.candidates?.[0]?.groundingMetadata?.groundingChunks) {
      sources = response.candidates[0].groundingMetadata.groundingChunks
        .filter((c: any) => c.web)
        .map((c: any) => ({ title: c.web.title, uri: c.web.uri }));
    }
    return { text: response.text || "", sources };
  }, 'Architect Chat', logCallback);
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
  const ctx = getCompressedContext(project, chapter.id);
  const promptText = Prompts.DRAFT_PROMPT(chapter.title, chapter.summary, chapter.beats);
  const safetySettings = getSafetySettings(project.meta.preferences.safetyPreset);

  return ai.models.generateContentStream({
    model,
    contents: [{ role: 'user', parts: [{ text: promptText }] }],
    config: {
      systemInstruction: Prompts.WRITER_SYSTEM_INSTRUCTION(ctx, tone),
      thinkingConfig: thinkingBudget ? { thinkingBudget } : undefined,
      safetySettings,
      seed: generateDeterministicSeed(promptText + ctx)
    },
  });
};

export const getSafetyAlternatives = async (
  blockedPrompt: string,
  category: string,
  logCallback: LogCallback
): Promise<string[]> => {
  const { model } = resolveModelConfig('AUTO_GEN');
  const prompt = Prompts.SAFETY_ALTERNATIVES_PROMPT(blockedPrompt, category);
  
  return runGeminiRequest({
    model,
    contents: [{ role: 'user', parts: [{ text: prompt }] } as any],
    usageLabel: 'Safety Consultant',
    logCallback,
    config: { responseMimeType: "application/json", responseSchema: { type: Type.ARRAY, items: { type: Type.STRING } } },
    mapper: (response) => {
      const res = safeJsonParse<string[]>(response.text, 'Safety Consultant', logCallback);
      return (res.status === 'PARSE_FAILED' || !res.value) ? [] : res.value;
    }
  });
};

export const generateCharacterPortrait = async (
  character: Character,
  project: StoryProject,
  onUsage: UsageCallback,
  logCallback: LogCallback
): Promise<string> => {
  logCallback('info', 'Artist' as any, `${character.name} の外見を詳細に設計中...`);
  const { model: textModel } = resolveModelConfig('CHAT', 'basic');
  const visualPrompt = await runGeminiRequest({
    model: textModel,
    contents: [{ parts: [{ text: Prompts.VISUAL_DESCRIPTION_PROMPT(character, project.bible.tone) }] } as any],
    usageLabel: 'Visual Designer',
    onUsage,
    logCallback,
    mapper: (res) => res.text || ""
  });

  logCallback('info', 'Artist' as any, `設計に基づき肖像画をキャンバスに描いています...`);
  const { model: imageModel } = resolveModelConfig('IMAGE');
  return runGeminiRequest({
    model: imageModel,
    contents: [{ parts: [{ text: Prompts.PORTRAIT_PROMPT(visualPrompt) }] } as any],
    usageLabel: 'Portrait Generator',
    onUsage,
    logCallback,
    config: { imageConfig: { aspectRatio: "3:4" } },
    mapper: (response) => {
      for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) return `data:image/png;base64,${part.inlineData.data}`;
      }
      throw new Error("画像生成失敗");
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
  const ai = getClient();
  const response = await ai.models.generateContent({
    model,
    contents: [{ parts: [{ text }] }],
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName } } },
    },
  });

  trackUsage(response, model, 'Speech Generator', onUsage);
  const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  if (!base64Audio) throw new Error("音声生成失敗");
  const binary = atob(base64Audio);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
};

export const getArchitectWhisper = async (
  lastChunk: string,
  project: StoryProject,
  activeChapterId: string,
  onUsage: UsageCallback,
  logCallback: LogCallback
): Promise<WhisperAdvice | null> => {
  const ctx = getCompressedContext(project, activeChapterId);
  const { model } = resolveModelConfig('AUTO_GEN');
  
  const disabledRules = project.meta.preferences.disabledLinterRules || [];
  const systemInstruction = Prompts.WHISPER_PROMPT(lastChunk, ctx) + 
    (disabledRules.length > 0 ? `\n以下のルールIDに関する指摘は無効化されているため、行わないでください: ${disabledRules.join(', ')}` : "");

  return runGeminiRequest({
    model,
    contents: [{ role: 'user', parts: [{ text: systemInstruction }] } as any],
    usageLabel: 'Architect Whisper',
    onUsage,
    logCallback,
    config: { responseMimeType: "application/json", responseSchema: Schemas.whisperSchema },
    mapper: (response) => {
      const res = safeJsonParse<WhisperAdvice>(response.text, 'Architect Whisper', logCallback);
      if (res.status === 'PARSE_FAILED' || !res.value) return null;
      if (res.value.text === "なし") return null;
      return { ...res.value, id: res.value.id || crypto.randomUUID() };
    }
  });
};

export const detectSettingChange = async (userInput: string, onUsage: UsageCallback, logCallback: LogCallback): Promise<DetectionResult> => {
  const { model } = resolveModelConfig('AUTO_GEN');
  return runGeminiRequest({
    model,
    contents: [{ role: 'user', parts: [{ text: Prompts.DETECTION_PROMPT(userInput) }] } as any],
    usageLabel: 'Intent Detector',
    onUsage,
    logCallback,
    config: { responseMimeType: "application/json", responseSchema: Schemas.detectionSchema },
    mapper: (response) => {
      const res = safeJsonParse<DetectionResult>(response.text, 'Intent Detector', logCallback);
      return (res.status === 'PARSE_FAILED' || !res.value) ? Schemas.DEFAULT_RESPONSES.DETECTION : res.value;
    }
  });
};

export const extractSettingsFromChat = async (
  history: GeminiContent[], 
  project: StoryProject,
  detection: DetectionResult,
  onUsage: UsageCallback,
  logCallback: LogCallback
): Promise<ExtractionResult> => {
  const { model, thinkingBudget } = resolveModelConfig('CHAT', 'complex');
  const extractionPrompt = Prompts.SYNC_EXTRACT_PROMPT(history.slice(-4), detection.instructionSummary, detection.categories, detection.isHypothetical);
  const requestId = crypto.randomUUID(); 

  const ai = getClient();
  const response = await ai.models.generateContent({
    model,
    contents: [{ role: 'user', parts: [{ text: extractionPrompt }] }],
    config: { 
      responseMimeType: "application/json",
      responseSchema: { type: Type.ARRAY, items: Schemas.syncOperationSchema as any },
      thinkingConfig: thinkingBudget ? { thinkingBudget } : undefined,
      seed: generateDeterministicSeed(extractionPrompt)
    },
  });

  trackUsage(response, model, 'NeuralSync Extractor', onUsage);
  
  const result: ExtractionResult = { readyOps: [], quarantineItems: [] };
  const res = safeJsonParse<any[]>(response.text, 'NeuralSync Extractor', logCallback);
  if (res.status === 'PARSE_FAILED' || !res.value) {
    result.quarantineItems.push({ id: crypto.randomUUID(), timestamp: Date.now(), rawText: response.text || "", error: "解析不能なレスポンス", stage: 'PARSE' });
    return result;
  }
  res.value.forEach((op, idx) => {
    const validationErrors = validateSyncOperation(op);
    if (validationErrors.length > 0) {
      result.quarantineItems.push({ id: crypto.randomUUID(), timestamp: Date.now(), rawText: JSON.stringify(op), error: validationErrors.join(", "), stage: 'SCHEMA', partialOp: op });
      return;
    }

    const opIsHypothetical = op.isHypothetical !== undefined ? op.isHypothetical : detection.isHypothetical;
    const collection = op.path === 'chapters' ? project.chapters : (project.bible as any)[op.path];
    let candidates: any[] = [];
    let status: any = 'proposal';
    
    if (Array.isArray(collection)) {
      candidates = findMatchCandidates(collection, op.targetId, op.targetName);
      if (candidates.length === 0 && op.op !== 'add') {
         status = 'needs_resolution';
      } else if (candidates.length > 0 && candidates[0].confidence >= 0.98) {
        op.targetId = candidates[0].id;
        op.targetName = candidates[0].name;
      } else if (candidates.length > 0) {
         status = 'needs_resolution';
      }
    }
    
    result.readyOps.push({ ...op, id: crypto.randomUUID(), requestId, timestamp: Date.now() + idx, status, candidates, isHypothetical: opIsHypothetical });
  });
  return result;
};

export const analyzeBibleIntegrity = async (project: StoryProject, onUsage: UsageCallback, logCallback: LogCallback): Promise<BibleIssue[]> => {
  const { model, thinkingBudget } = resolveModelConfig('SCAN', 'critical');
  const chapterContext = project.chapters.map(c => `Chapter ${c.title}: ${c.summary}`).join('\n');
  const bibleData = JSON.stringify({ grandArc: project.bible.grandArc, characters: project.bible.characters.map(c => ({ id: c.id, name: c.name, status: c.status })), laws: project.bible.laws });
  const prompt = Prompts.INTEGRITY_SCAN_PROMPT(`Bible Data:\n${bibleData}\n\nManuscript Summaries:\n${chapterContext}`);
  
  return runGeminiRequest({
    model,
    contents: [{ role: 'user', parts: [{ text: prompt }] } as any],
    usageLabel: 'Integrity Scan',
    onUsage,
    logCallback,
    config: { responseMimeType: "application/json", responseSchema: Schemas.integrityScanSchema, thinkingConfig: thinkingBudget ? { thinkingBudget } : undefined },
    mapper: (response) => {
      const res = safeJsonParse<IntegrityScanResponse>(response.text, 'Integrity Scan', logCallback);
      if (res.status === 'PARSE_FAILED' || !res.value) return [];
      const disabledRules = project.meta.preferences.disabledLinterRules || [];
      return res.value.issues
        .filter(i => !disabledRules.includes(i.ruleId))
        .map(i => ({ ...i, id: crypto.randomUUID() }));
    }
  });
};

export const maintainSummaryBuffer = async (project: StoryProject, onUsage: UsageCallback, logCallback: LogCallback): Promise<string> => {
  const { model, thinkingBudget } = resolveModelConfig('CHAT', 'complex');
  const prompt = Prompts.SUMMARY_BUFFER_PROMPT(JSON.stringify(project.bible));
  return runGeminiRequest({
    model,
    contents: [{ role: 'user', parts: [{ text: prompt }] } as any],
    usageLabel: 'Summary Maintenance',
    onUsage,
    logCallback,
    config: { thinkingConfig: thinkingBudget ? { thinkingBudget } : undefined },
    mapper: (response) => response.text || ""
  });
};

export const simulateBranch = async (hyp: string, project: StoryProject, onUsage: UsageCallback, logCallback: LogCallback): Promise<NexusBranch> => {
  const { model, thinkingBudget } = resolveModelConfig('SIM', 'complex');
  const ctx = getCompressedContext(project);
  const prompt = Prompts.NEXUS_SIM_PROMPT(hyp, ctx);
  return runGeminiRequest({
    model,
    contents: [{ role: 'user', parts: [{ text: prompt }] } as any],
    usageLabel: 'Nexus',
    onUsage,
    logCallback,
    config: { responseMimeType: "application/json", responseSchema: Schemas.nexusSchema, thinkingConfig: thinkingBudget ? { thinkingBudget } : undefined },
    mapper: (response) => {
      const res = safeJsonParse<NexusSimulationResponse>(response.text, 'Nexus Sim', logCallback);
      const val = (res.status === 'PARSE_FAILED' || !res.value) ? Schemas.DEFAULT_RESPONSES.NEXUS : res.value;
      return { ...val, id: crypto.randomUUID(), timestamp: Date.now() } as NexusBranch;
    }
  });
};

export const suggestNextSentence = async (content: string, project: StoryProject, activeChapterId: string, onUsage: UsageCallback, logCallback: LogCallback): Promise<string[]> => {
  const ctx = getCompressedContext(project, activeChapterId);
  const { model } = resolveModelConfig('AUTO_GEN');
  const prompt = Prompts.NEXT_SENTENCE_PROMPT(content, ctx);
  return runGeminiRequest({
    model,
    contents: [{ role: 'user', parts: [{ text: prompt }] } as any],
    usageLabel: 'Writer Copilot',
    onUsage,
    logCallback,
    config: { responseMimeType: "application/json", responseSchema: Schemas.suggestionsSchema as any },
    mapper: (response) => {
      const res = safeJsonParse<string[]>(response.text, 'Writer Copilot', logCallback);
      return (res.status === 'PARSE_FAILED' || !res.value) ? Schemas.DEFAULT_RESPONSES.SUGGESTIONS : res.value;
    }
  });
};

export const generateFullChapterPackage = async (project: StoryProject, chapter: ChapterLog, onUsage: UsageCallback, logCallback: LogCallback): Promise<ChapterPackageResponse> => {
  const { model, thinkingBudget } = resolveModelConfig('DRAFT', 'critical');
  const ctx = getCompressedContext(project, chapter.id);
  const prompt = Prompts.CHAPTER_PACKAGE_PROMPT(chapter.title, chapter.summary, ctx);
  return runGeminiRequest({
    model,
    contents: [{ role: 'user', parts: [{ text: prompt }] } as any],
    usageLabel: 'Chapter Architect',
    onUsage,
    logCallback,
    config: { responseMimeType: "application/json", responseSchema: Schemas.chapterPackageSchema, thinkingConfig: thinkingBudget ? { thinkingBudget } : undefined },
    mapper: (response) => {
      const res = safeJsonParse<ChapterPackageResponse>(response.text, 'Chapter Architect', logCallback);
      const pkg = (res.status === 'PARSE_FAILED' || !res.value) ? Schemas.DEFAULT_RESPONSES.CHAPTER_PACKAGE : res.value;
      return { ...pkg, beats: (pkg.beats || []).map(b => ({ ...b, id: b.id || crypto.randomUUID() })) };
    }
  });
};

export const generateRandomProject = async (
  theme: string,
  logCallback: LogCallback
): Promise<ProjectGenerationResponse> => {
  const { model } = resolveModelConfig('AUTO_GEN');
  const ai = getClient();
  const prompt = Prompts.PROJECT_GEN_PROMPT(theme);
  const response = await ai.models.generateContent({
    model,
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    config: { 
      responseMimeType: "application/json", 
      responseSchema: Schemas.projectGenSchema 
    },
  });

  const res = safeJsonParse<ProjectGenerationResponse>(response.text, 'Project Generator', logCallback);
  return (res.status === 'PARSE_FAILED' || !res.value) ? Schemas.DEFAULT_RESPONSES.PROJECT_GEN : res.value;
};
