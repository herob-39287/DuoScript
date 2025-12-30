
import { GoogleGenAI, Modality, Type, GenerateContentResponse } from "@google/genai";
import { 
  AiModel, StoryProject, ChapterLog, SyncOperation, NexusBranch,
  DetectionResult, IntegrityScanResponse, NexusSimulationResponse,
  ChapterPackageResponse, ProjectGenerationResponse, Character,
  BibleIssue, GeminiContent, UsageCallback, LogCallback, ExtractionResult, QuarantineItem, WhisperAdvice
} from "../../types";
// Added getFriendlyErrorMessage to imports from utils
import { handleGeminiError, getCompressedContext, trackUsage, safeJsonParse, resolveModelConfig, generateDeterministicSeed, getSafetySettings, DuoScriptError, getFriendlyErrorMessage } from "./utils";
import { findMatchCandidates, validateSyncOperation } from "../bibleManager";
import * as Schemas from "./schemas";
import * as Prompts from "./prompts";

/**
 * 常に最新のAPIキーを使用してクライアントを初期化
 */
const getClient = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * Gemini APIへの標準的なリクエスト処理
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
  const ai = getClient();
  const { model, contents, config, usageLabel, onUsage, logCallback, mapper } = params;

  return await handleGeminiError(async () => {
    const response = await ai.models.generateContent({
      model,
      contents: typeof contents === 'string' ? contents : contents,
      config: {
        ...config,
        safetySettings: getSafetySettings()
      }
    });

    trackUsage(response, model, usageLabel, onUsage);
    
    // 安全フィルターによるブロックのチェック
    if (response.candidates?.[0]?.finishReason === 'SAFETY') {
      const category = response.candidates[0].safetyRatings?.[0]?.category || "HARM_CATEGORY_UNKNOWN";
      throw new DuoScriptError("SAFETY_BLOCK", "Content blocked by safety filters", usageLabel, 403, category);
    }

    return mapper(response);
  }, usageLabel, logCallback);
}

/**
 * 設計士とのチャット対話
 */
export async function chatWithArchitect(
  history: GeminiContent[],
  input: string,
  project: StoryProject,
  allowSearch: boolean = true,
  onUsage: UsageCallback,
  logCallback: LogCallback
) {
  const context = getCompressedContext(project);
  const systemInstruction = Prompts.ARCHITECT_SYSTEM_INSTRUCTION(context);

  return runGeminiRequest({
    model: AiModel.REASONING,
    contents: history,
    config: {
      systemInstruction,
      tools: allowSearch ? [{ googleSearch: {} }] : [],
      thinkingConfig: { thinkingBudget: 4000 }
    },
    usageLabel: 'Architect',
    onUsage,
    logCallback,
    mapper: (res) => ({
      text: res.text || "申し訳ありません、お答えできません。",
      sources: res.candidates?.[0]?.groundingMetadata?.groundingChunks?.map((chunk: any) => ({
        title: chunk.web?.title || "Reference",
        uri: chunk.web?.uri || ""
      })) || []
    })
  });
}

/**
 * 設定変更の意図を検出
 */
export async function detectSettingChange(
  input: string,
  onUsage: UsageCallback,
  logCallback: LogCallback
): Promise<DetectionResult> {
  return runGeminiRequest({
    model: AiModel.FAST,
    contents: Prompts.DETECTION_PROMPT(input),
    config: {
      responseMimeType: "application/json",
      responseSchema: Schemas.detectionSchema
    },
    usageLabel: 'NeuralSync/Detector',
    onUsage,
    logCallback,
    mapper: (res) => safeJsonParse<DetectionResult>(res.text, 'Detector').value || Schemas.DEFAULT_RESPONSES.DETECTION
  });
}

/**
 * チャット履歴から具体的な構造化設定を抽出 (NeuralSync)
 */
export async function extractSettingsFromChat(
  history: GeminiContent[],
  project: StoryProject,
  detection: DetectionResult,
  onUsage: UsageCallback,
  logCallback: LogCallback
): Promise<ExtractionResult> {
  const context = getCompressedContext(project);
  const prompt = Prompts.SYNC_EXTRACT_PROMPT(history, context, detection.categories, detection.isHypothetical);

  return runGeminiRequest({
    model: AiModel.REASONING,
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: Schemas.syncOperationSchema
      }
    },
    usageLabel: 'NeuralSync/Extractor',
    onUsage,
    logCallback,
    mapper: (res) => {
      const parsed = safeJsonParse<SyncOperation[]>(res.text, 'Extractor');
      const ops = parsed.value || [];
      const readyOps: SyncOperation[] = [];
      const quarantineItems: QuarantineItem[] = [];

      ops.forEach(op => {
        const errors = validateSyncOperation(op);
        if (errors.length > 0) {
          quarantineItems.push({
            id: crypto.randomUUID(),
            timestamp: Date.now(),
            rawText: JSON.stringify(op),
            error: `Validation Error: ${errors.join(", ")}`,
            stage: 'SCHEMA',
            partialOp: op
          });
          return;
        }

        // 既存項目へのマッピングを試行
        const list = op.path === 'chapters' ? project.chapters : (project.bible as any)[op.path];
        if (Array.isArray(list)) {
          const candidates = findMatchCandidates(list, op.targetId, op.targetName);
          if (candidates.length > 0) {
            if (candidates[0].confidence >= 0.95) {
              op.targetId = candidates[0].id;
              op.targetName = candidates[0].name;
              op.status = 'proposal';
            } else {
              op.status = 'needs_resolution';
              op.candidates = candidates;
              op.resolutionHint = `複数の候補が見つかりました（最も近いもの: ${candidates[0].name}）`;
            }
          } else if (op.op !== 'add') {
             // addでないのに見つからない場合は新規作成として扱うか、要解決へ
             op.status = 'needs_resolution';
             op.resolutionHint = "対象が見つかりませんでした。新規作成するか指定し直してください。";
          }
        }
        
        op.id = crypto.randomUUID();
        op.timestamp = Date.now();
        op.isHypothetical = detection.isHypothetical;
        readyOps.push(op);
      });

      return { readyOps, quarantineItems };
    }
  });
}

/**
 * 初稿生成 (Streaming)
 */
export async function* generateDraftStream(
  chapter: ChapterLog,
  tone: string,
  usePro: boolean,
  project: StoryProject,
  logCallback: LogCallback
) {
  const ai = getClient();
  const context = getCompressedContext(project, chapter.id);
  const systemInstruction = Prompts.WRITER_SYSTEM_INSTRUCTION(context, tone);
  const prompt = Prompts.DRAFT_PROMPT(chapter.title, chapter.summary, chapter.beats);

  try {
    const result = await ai.models.generateContentStream({
      model: usePro ? AiModel.REASONING : AiModel.FAST,
      contents: prompt,
      config: {
        systemInstruction,
        thinkingConfig: usePro ? { thinkingBudget: 4000 } : undefined
      }
    });

    for await (const chunk of result) {
      if (chunk.candidates?.[0]?.finishReason === 'SAFETY') {
        throw new DuoScriptError("SAFETY_BLOCK", "Safe writing interrupted", "Writer");
      }
      yield chunk;
    }
  } catch (error: any) {
    const friendly = getFriendlyErrorMessage(error);
    logCallback('error', 'Writer', friendly, error.message);
    throw error;
  }
}

/**
 * 続きの文章を提案 (AI Copilot)
 */
export async function suggestNextSentence(
  content: string,
  project: StoryProject,
  activeChapterId: string,
  onUsage: UsageCallback,
  logCallback: LogCallback
): Promise<string[]> {
  const context = getCompressedContext(project, activeChapterId);
  const prompt = Prompts.NEXT_SENTENCE_PROMPT(content, context);

  return runGeminiRequest({
    model: AiModel.FAST,
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: Schemas.suggestionsSchema
    },
    usageLabel: 'Writer/Copilot',
    onUsage,
    logCallback,
    mapper: (res) => safeJsonParse<string[]>(res.text, 'Copilot').value || Schemas.DEFAULT_RESPONSES.SUGGESTIONS
  });
}

/**
 * キャラクターの肖像画を生成
 */
export async function generateCharacterPortrait(
  character: Character,
  project: StoryProject,
  onUsage: UsageCallback,
  logCallback: LogCallback
): Promise<string> {
  const ai = getClient();
  
  // 1. 視覚的描写の生成
  const visualDesc = await runGeminiRequest({
    model: AiModel.FAST,
    contents: Prompts.VISUAL_DESCRIPTION_PROMPT(character, project.bible.tone),
    usageLabel: 'Artist/Describer',
    onUsage,
    logCallback,
    mapper: (res) => res.text || `${character.name}, portrait.`
  });

  // 2. 画像生成
  return await handleGeminiError(async () => {
    const res = await ai.models.generateContent({
      model: AiModel.IMAGE,
      contents: Prompts.PORTRAIT_PROMPT(visualDesc),
      config: {
        imageConfig: { aspectRatio: "3:4" }
      }
    });

    trackUsage(res, AiModel.IMAGE, 'Artist/Painter', onUsage);

    const part = res.candidates?.[0]?.content?.parts.find(p => p.inlineData);
    if (!part?.inlineData) throw new Error("画像が生成されませんでした。");

    return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
  }, 'Artist/Painter', logCallback);
}

/**
 * キャラクターボイスの生成
 */
export async function generateSpeech(
  text: string,
  voiceName: string = 'Zephyr',
  onUsage: UsageCallback,
  logCallback: LogCallback
): Promise<ArrayBuffer> {
  const ai = getClient();
  
  return await handleGeminiError(async () => {
    const response = await ai.models.generateContent({
      model: AiModel.TTS,
      contents: [{ parts: [{ text: `Say with emotion: ${text}` }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName }
          }
        }
      }
    });

    trackUsage(response, AiModel.TTS, 'Voice', onUsage);

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) throw new Error("音声が生成されませんでした。");

    // Base64デコード
    const binaryString = atob(base64Audio);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  }, 'Voice', logCallback);
}

/**
 * 整合性スキャン
 */
export async function analyzeBibleIntegrity(
  project: StoryProject,
  onUsage: UsageCallback,
  logCallback: LogCallback
): Promise<BibleIssue[]> {
  const compactBible = JSON.stringify({
    bible: project.bible,
    chapters: project.chapters.map(c => ({ id: c.id, title: c.title, summary: c.summary }))
  });

  return runGeminiRequest({
    model: AiModel.REASONING,
    contents: Prompts.INTEGRITY_SCAN_PROMPT(compactBible),
    config: {
      responseMimeType: "application/json",
      responseSchema: Schemas.integrityScanSchema,
      thinkingConfig: { thinkingBudget: 12000 }
    },
    usageLabel: 'Linter',
    onUsage,
    logCallback,
    mapper: (res) => {
      const parsed = safeJsonParse<IntegrityScanResponse>(res.text, 'Linter');
      return (parsed.value?.issues || []).map(issue => ({
        ...issue,
        id: crypto.randomUUID()
      }));
    }
  });
}

/**
 * 設計士のささやき（リアルタイム分析）
 */
export async function getArchitectWhisper(
  chunk: string,
  project: StoryProject,
  activeChapterId: string,
  onUsage: UsageCallback,
  logCallback: LogCallback
): Promise<WhisperAdvice | null> {
  const context = getCompressedContext(project, activeChapterId);
  const prompt = Prompts.WHISPER_PROMPT(chunk, context);

  return runGeminiRequest({
    model: AiModel.FAST,
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: Schemas.whisperSchema
    },
    usageLabel: 'Architect/Whisper',
    onUsage,
    logCallback,
    mapper: (res) => {
      if (res.text?.includes("なし")) return null;
      return safeJsonParse<WhisperAdvice>(res.text, 'Whisper').value;
    }
  });
}

/**
 * 分岐シミュレーション (Nexus)
 */
export async function simulateBranch(
  hypothesis: string,
  project: StoryProject,
  onUsage: UsageCallback,
  logCallback: LogCallback
): Promise<NexusBranch> {
  const context = getCompressedContext(project);
  const prompt = Prompts.NEXUS_SIM_PROMPT(hypothesis, context);

  return runGeminiRequest({
    model: AiModel.REASONING,
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: Schemas.nexusSchema,
      thinkingConfig: { thinkingBudget: 8000 }
    },
    usageLabel: 'Nexus/Simulator',
    onUsage,
    logCallback,
    mapper: (res) => {
      const sim = safeJsonParse<NexusSimulationResponse>(res.text, 'Nexus').value || Schemas.DEFAULT_RESPONSES.NEXUS;
      return {
        id: crypto.randomUUID(),
        hypothesis: sim.hypothesis || hypothesis,
        impactOnCanon: sim.impactOnCanon,
        impactOnState: sim.impactOnState,
        alternateTimeline: sim.alternateTimeline || [],
        timestamp: Date.now()
      };
    }
  });
}

/**
 * コンテキストバッファの要約
 */
export async function maintainSummaryBuffer(
  project: { bible: any },
  onUsage: UsageCallback,
  logCallback: LogCallback
): Promise<string> {
  const bibleJson = JSON.stringify(project.bible);
  const prompt = Prompts.SUMMARY_BUFFER_PROMPT(bibleJson);

  return runGeminiRequest({
    model: AiModel.REASONING,
    contents: prompt,
    usageLabel: 'Architect/Summarizer',
    onUsage,
    logCallback,
    mapper: (res) => res.text || ""
  });
}

/**
 * 新規プロジェクト案の自動生成
 */
export async function generateRandomProject(
  theme: string,
  logCallback: LogCallback
): Promise<any> {
  const ai = getClient();
  const prompt = Prompts.PROJECT_GEN_PROMPT(theme);

  return await handleGeminiError(async () => {
    const response = await ai.models.generateContent({
      model: AiModel.FAST,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: Schemas.projectGenSchema
      }
    });

    return safeJsonParse<ProjectGenerationResponse>(response.text, 'Muses').value || Schemas.DEFAULT_RESPONSES.PROJECT_GEN;
  }, 'Muses', logCallback);
}

/**
 * 章の全パッケージ生成（構成案 + ビート + ドラフト）
 */
export async function generateFullChapterPackage(
  project: StoryProject,
  chapter: ChapterLog,
  onUsage: UsageCallback,
  logCallback: LogCallback
): Promise<ChapterPackageResponse> {
  const context = getCompressedContext(project, chapter.id);
  const prompt = Prompts.CHAPTER_PACKAGE_PROMPT(chapter.title, chapter.summary, context);

  return runGeminiRequest({
    model: AiModel.REASONING,
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: Schemas.chapterPackageSchema,
      thinkingConfig: { thinkingBudget: 12000 }
    },
    usageLabel: 'Writer/FullPackage',
    onUsage,
    logCallback,
    mapper: (res) => safeJsonParse<ChapterPackageResponse>(res.text, 'Writer').value || Schemas.DEFAULT_RESPONSES.CHAPTER_PACKAGE
  });
}

/**
 * 安全ポリシー抵触時の代替案を提案
 */
export async function getSafetyAlternatives(
  blockedInput: string,
  category: string,
  logCallback: LogCallback
): Promise<string[]> {
  const ai = getClient();
  const prompt = Prompts.SAFETY_ALTERNATIVES_PROMPT(blockedInput, category);

  try {
    const res = await ai.models.generateContent({
      model: AiModel.FAST,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: { type: Type.STRING }
        }
      }
    });
    return safeJsonParse<string[]>(res.text, 'Safety').value || [];
  } catch (e) {
    return [];
  }
}
