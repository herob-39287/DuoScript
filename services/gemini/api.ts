import { GoogleGenAI, Type, Modality } from "@google/genai";
import { AiModel, StoryProject, ChapterLog, SyncOperation, PlotBeat, BibleIssue, NexusBranch, ChapterStrategy } from "../../types";
import { handleGeminiError, getCompressedContext, trackUsage, safeJsonParse, determineThinkingBudget } from "./utils";
import { syncOperationSchema } from "./schemas";
import * as Prompts from "./prompts";

/**
 * 常に最新のAPIキーを使用してインスタンスを生成します
 */
const getClient = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * 設計士（Architect）との対話。
 */
export const chatWithArchitect = async (
  history: any[], 
  userInput: string, 
  project: StoryProject, 
  useSearch: boolean,
  onUsage: (usage: any) => void,
  logCallback: any
): Promise<{ text: string; sources?: any[] }> => {
  return handleGeminiError(async () => {
    const ai = getClient();
    const ctx = getCompressedContext(project);
    const model = AiModel.REASONING;
    const budget = determineThinkingBudget(model, userInput.length > 200 ? 'high' : 'medium');
    
    const response = await ai.models.generateContent({
      model,
      contents: history,
      config: {
        systemInstruction: Prompts.ARCHITECT_SYSTEM_INSTRUCTION(ctx),
        thinkingConfig: { thinkingBudget: budget },
        tools: useSearch ? [{ googleSearch: {} }] : undefined
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

/**
 * 本文のストリーミング生成。
 */
export const generateDraftStream = async (
  chapter: ChapterLog,
  tone: string,
  useThinking: boolean,
  project: StoryProject,
  logCallback: any
) => {
  const ai = getClient();
  const model = useThinking ? AiModel.REASONING : AiModel.FAST;
  const ctx = getCompressedContext(project);
  const budget = useThinking ? determineThinkingBudget(model, 'high') : undefined;

  return ai.models.generateContentStream({
    model,
    contents: [{ 
      role: 'user', 
      parts: [{ 
        text: `章「${chapter.title}」の執筆を開始してください。

【あらすじ】
${chapter.summary}

【プロットビート】
${chapter.beats.map((b, i) => `${i + 1}. ${b.text}`).join('\n')}

これまでの執筆内容の続き、または最初から書き始めてください。`
      }] 
    }],
    config: {
      systemInstruction: Prompts.WRITER_SYSTEM_INSTRUCTION(ctx, tone),
      thinkingConfig: budget ? { thinkingBudget: budget } : undefined
    },
  });
};

/**
 * キャラクターのポートレート画像を生成します (gemini-2.5-flash-image)
 */
export const generateCharacterPortrait = async (
  characterDescription: string,
  onUsage: any,
  logCallback: any
): Promise<string> => {
  return handleGeminiError(async () => {
    const ai = getClient();
    const model = AiModel.IMAGE;
    
    const response = await ai.models.generateContent({
      model,
      contents: [{
        parts: [{ text: `A cinematic character portrait based on this description: ${characterDescription}. Art style: Semi-realistic, painterly, moody lighting, professional concept art.` }]
      }],
      config: {
        imageConfig: { aspectRatio: "3:4" }
      }
    });

    trackUsage(response, model, 'Portrait Generator', onUsage);
    
    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
    throw new Error("画像データが生成されませんでした。");
  }, 'Portrait Generator', logCallback);
};

/**
 * テキストを音声に変換します (gemini-2.5-flash-preview-tts)
 */
export const generateSpeech = async (
  text: string,
  voiceName: string = 'Zephyr',
  onUsage: any,
  logCallback: any
): Promise<ArrayBuffer> => {
  return handleGeminiError(async () => {
    const ai = getClient();
    const model = AiModel.TTS;

    const response = await ai.models.generateContent({
      model,
      contents: [{ parts: [{ text }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName }
          }
        }
      }
    });

    trackUsage(response, model, 'Speech Generator', onUsage);
    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    
    if (!base64Audio) throw new Error("音声データが生成されませんでした。");

    const binaryString = atob(base64Audio);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  }, 'Speech Generator', logCallback);
};

/**
 * 執筆中の「ささやき」助言。
 */
export const getArchitectWhisper = async (
  lastChunk: string,
  project: StoryProject,
  onUsage: (usage: any) => void,
  logCallback: any
): Promise<{ text: string; type: 'info' | 'alert' } | null> => {
  return handleGeminiError(async () => {
    const ai = getClient();
    const model = AiModel.FAST;
    const ctx = getCompressedContext(project);

    const response = await ai.models.generateContent({
      model,
      contents: [{
        role: 'user',
        parts: [{ text: Prompts.WHISPER_PROMPT(lastChunk, ctx) }]
      }],
      config: {
        systemInstruction: "あなたは厳しいが信頼できる物語の設計士です。整合性への執着を持ってください。"
      }
    });

    trackUsage(response, model, 'Architect Whisper', onUsage);
    const text = response.text?.trim() || "なし";
    if (text === "なし" || text.length < 5) return null;
    return { text, type: text.includes("矛盾") || text.includes("間違い") ? 'alert' : 'info' };
  }, 'Architect Whisper', logCallback);
};

/**
 * NeuralSync Stage 1: 意図検出
 */
export interface DetectionResult {
  hasChangeIntent: boolean;
  categories: string[];
  instructionSummary: string;
}

export const detectSettingChange = async (
  userInput: string,
  onUsage: any,
  logCallback: any
): Promise<DetectionResult> => {
  return handleGeminiError(async () => {
    const ai = getClient();
    const model = AiModel.FAST;
    
    const response = await ai.models.generateContent({
      model,
      contents: [{ 
        role: 'user', 
        parts: [{ 
          text: `以下の発言に、物語の設定（キャラクター、世界観、年表、伏線、プロット等）を変更・追加・削除しようとする意図が含まれているか判定してください。

発言: "${userInput}"

【出力形式】
JSON形式で以下のフィールドを返してください：
- hasChangeIntent (boolean): 意図があるか
- categories (string[]): 該当カテゴリ (characters, world, grandArc, timeline, foreshadowing)
- instructionSummary (string): どのような変更を求めているかの要約` 
        }] 
      }],
      config: { 
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            hasChangeIntent: { type: Type.BOOLEAN },
            categories: { type: Type.ARRAY, items: { type: Type.STRING } },
            instructionSummary: { type: Type.STRING }
          },
          required: ["hasChangeIntent", "categories", "instructionSummary"]
        }
      },
    });

    trackUsage(response, model, 'Intent Detector', onUsage);
    return safeJsonParse<DetectionResult>(response.text, { hasChangeIntent: false, categories: [], instructionSummary: "" }, logCallback);
  }, 'Intent Detector', logCallback);
};

/**
 * NeuralSync Stage 2: 差分抽出
 */
export const extractSettingsFromChat = async (
  history: any[], 
  project: StoryProject,
  detection: DetectionResult,
  onUsage: any,
  logCallback: any
): Promise<SyncOperation[]> => {
  return handleGeminiError(async () => {
    const ai = getClient();
    const model = AiModel.REASONING;
    
    const response = await ai.models.generateContent({
      model,
      contents: [
        { 
          role: 'user', 
          parts: [{ 
            text: `以下の対話から、物語設定の変更内容を抽出し、JSON形式でリスト化してください。

【検出された意図】
要約: ${detection.instructionSummary}
対象カテゴリ: ${detection.categories.join(', ')}

【抽出ルール】
- 'op' は 'add', 'update', 'delete', 'set' のいずれか。
- 'path' は characters, timeline, foreshadowing, entries, setting, tone, laws, grandArc のいずれか。
- ユーザーの意図だけでなく、それに対する「設計士」の補足や修正案も反映させてください。

【対象の対話】
${JSON.stringify(history.slice(-4))}` 
          }] 
        }
      ],
      config: { 
        responseMimeType: "application/json",
        responseSchema: { type: Type.ARRAY, items: syncOperationSchema },
        thinkingConfig: { thinkingBudget: determineThinkingBudget(model, 'medium') }
      },
    });

    trackUsage(response, model, 'NeuralSync Extractor', onUsage);
    return safeJsonParse<SyncOperation[]>(response.text, [], logCallback);
  }, 'NeuralSync Extractor', logCallback);
};

/**
 * 物語の不整合スキャン
 */
export const analyzeBibleIntegrity = async (
  project: StoryProject, 
  onUsage: any, 
  logCallback: any
): Promise<BibleIssue[]> => {
  return handleGeminiError(async () => {
    const ai = getClient();
    const model = AiModel.REASONING;
    const bible = project.bible;
    
    const compactBible = {
      grandArc: bible.grandArc,
      characters: bible.characters.map(c => ({ name: c.name, motivation: c.motivation, status: c.status })),
      laws: bible.laws,
      foreshadowing: bible.foreshadowing
    };

    const response = await ai.models.generateContent({
      model,
      contents: [{
        role: 'user',
        parts: [{ text: Prompts.INTEGRITY_SCAN_PROMPT(JSON.stringify(compactBible)) }]
      }],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            issues: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  type: { type: Type.STRING },
                  targetIds: { type: Type.ARRAY, items: { type: Type.STRING } },
                  description: { type: Type.STRING },
                  suggestion: { type: Type.STRING },
                  severity: { type: Type.STRING }
                },
                required: ["type", "description", "suggestion"]
              }
            }
          },
          required: ["issues"]
        },
        thinkingConfig: { thinkingBudget: determineThinkingBudget(model, 'critical') }
      }
    });

    trackUsage(response, model, 'Integrity Scan', onUsage);
    const parsed = safeJsonParse<{ issues: BibleIssue[] }>(response.text, { issues: [] }, logCallback);
    return parsed.issues;
  }, 'Integrity Scan', logCallback);
};

/**
 * コンテキストの要約
 */
export const maintainSummaryBuffer = async (
  project: StoryProject,
  onUsage: any,
  logCallback: any
): Promise<string> => {
  return handleGeminiError(async () => {
    const ai = getClient();
    const model = AiModel.REASONING;
    
    const response = await ai.models.generateContent({
      model,
      contents: [{
        role: 'user',
        parts: [{ text: `以下の全設定を統合し、長編執筆のプロンプトとして最適な「高密度要約（2000文字程度）」を作成してください。
現在の設定: ${JSON.stringify(project.bible)}` }]
      }],
      config: {
        thinkingConfig: { thinkingBudget: 8000 }
      }
    });

    trackUsage(response, model, 'Summary Maintenance', onUsage);
    return response.text || "";
  }, 'Summary Maintenance', logCallback);
};

export const simulateBranch = async (hyp: string, project: StoryProject, onUsage: any, logCallback: any): Promise<NexusBranch> => {
  return handleGeminiError(async () => {
    const ai = getClient();
    const model = AiModel.REASONING;
    const ctx = getCompressedContext(project);

    const response = await ai.models.generateContent({
      model,
      contents: [{ role: 'user', parts: [{ text: `仮説: 「${hyp}」が起きた場合の世界線の分岐をシミュレートせよ。コンテキスト: ${ctx}` }] }],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            hypothesis: { type: Type.STRING },
            impactOnCanon: { type: Type.STRING },
            impactOnState: { type: Type.STRING },
            alternateTimeline: { type: Type.ARRAY, items: { type: Type.STRING } }
          },
          required: ["hypothesis", "impactOnCanon", "impactOnState"]
        },
        thinkingConfig: { thinkingBudget: determineThinkingBudget(model, 'high') }
      }
    });

    trackUsage(response, model, 'Nexus', onUsage);
    const res = safeJsonParse<any>(response.text, {}, logCallback);
    return { ...res, id: crypto.randomUUID(), timestamp: Date.now() };
  }, 'Nexus', logCallback);
};

export const suggestNextSentence = async (content: string, project: StoryProject, onUsage: any, logCallback: any) => {
  return handleGeminiError(async () => {
    const ai = getClient();
    const model = AiModel.FAST;
    const ctx = getCompressedContext(project);
    
    const response = await ai.models.generateContent({
      model,
      contents: [{ role: 'user', parts: [{ text: `物語の続きとして、文脈の異なる3つのパターンを提案してください。\n本文末尾: ${content.slice(-500)}\n\nコンテキスト: ${ctx}` }] }],
      config: {
        responseMimeType: "application/json",
        responseSchema: { type: Type.ARRAY, items: { type: Type.STRING } }
      }
    });
    
    trackUsage(response, model, 'Writer Copilot', onUsage);
    return safeJsonParse<string[]>(response.text, ["...", "...", "..."], logCallback);
  }, 'Writer Copilot', logCallback);
};

export const generateFullChapterPackage = async (project: StoryProject, chapter: ChapterLog, onUsage: any, logCallback: any) => {
   return handleGeminiError(async () => {
    const ai = getClient();
    const model = AiModel.REASONING;
    const ctx = getCompressedContext(project);
    
    const response = await ai.models.generateContent({
      model,
      contents: [{ role: 'user', parts: [{ text: `章「${chapter.title}」の戦略、ビート、初稿を生成。あらすじ: ${chapter.summary}\nコンテキスト: ${ctx}` }] }],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            strategy: { type: Type.OBJECT, properties: { pacing: { type: Type.STRING }, characterArcProgress: { type: Type.STRING } } },
            beats: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { id: { type: Type.STRING }, text: { type: Type.STRING } } } },
            draft: { type: Type.STRING }
          },
          required: ["strategy", "beats", "draft"]
        },
        thinkingConfig: { thinkingBudget: determineThinkingBudget(model, 'critical') }
      }
    });
    
    trackUsage(response, model, 'Chapter Architect', onUsage);
    return safeJsonParse<any>(response.text, {}, logCallback);
  }, 'Chapter Architect', logCallback);
};

export const generateRandomProject = async (theme: string, logCallback: any) => {
  return handleGeminiError(async () => {
    const ai = getClient();
    const model = AiModel.FAST;
    
    const response = await ai.models.generateContent({
      model,
      contents: [{ role: 'user', parts: [{ text: `テーマ「${theme}」に基づき、新しい小説の初期設定を生成してください。` }] }],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            genre: { type: Type.STRING },
            bible: { type: Type.OBJECT, properties: { setting: { type: Type.STRING }, grandArc: { type: Type.STRING } } }
          },
          required: ["title", "genre", "bible"]
        }
      }
    });
    
    return safeJsonParse<any>(response.text, { title: theme }, logCallback);
  }, 'Project Generator', logCallback);
};

/**
 * 従来の非ストリーミング執筆メソッド（後方互換用）
 */
export const generateDraft = async (
  chapter: ChapterLog,
  tone: string,
  useThinking: boolean,
  project: StoryProject,
  onUsage: any,
  logCallback: any
): Promise<string> => {
  return handleGeminiError(async () => {
    const ai = getClient();
    const model = useThinking ? AiModel.REASONING : AiModel.FAST;
    const ctx = getCompressedContext(project);
    
    const response = await ai.models.generateContent({
      model,
      contents: [{ 
        role: 'user', 
        parts: [{ 
          text: `卓越した小説家として、執筆を開始してください。
トーン: ${tone}

【コンテキスト】
${ctx}

【この章のあらすじ】
${chapter.summary}

【プロットビート】
${chapter.beats.map((b, i) => `${i + 1}. ${b.text}`).join('\n')}` 
        }] 
      }],
      config: {
        thinkingConfig: useThinking ? { thinkingBudget: determineThinkingBudget(model, 'high') } : undefined
      },
    });

    trackUsage(response, model, 'Writer', onUsage);
    return response.text || "";
  }, 'Writer', logCallback);
};
