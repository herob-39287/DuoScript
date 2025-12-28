import { GoogleGenAI, Type, Modality } from "@google/genai";
import { AiModel, StoryProject, ChapterLog, WorldBible, Character, SyncOperation, WorldEntry, BibleIssue, PlotBeat, TimelineEvent, Foreshadowing, NexusBranch, ChapterStrategy, SystemLog } from "../types";

class DuoScriptError extends Error {
  constructor(message: string, public details?: string, public source?: string) {
    super(message);
    this.name = 'DuoScriptError';
  }
}

function repairTruncatedJson(text: string): string {
  let cleaned = text.trim();
  cleaned = cleaned.replace(/^```json\s*/i, "").replace(/\s*```$/, "");
  if (cleaned.startsWith('[') && !cleaned.endsWith(']')) {
    const lastObjectEnd = cleaned.lastIndexOf('}');
    if (lastObjectEnd !== -1) return cleaned.substring(0, lastObjectEnd + 1) + ']';
    return cleaned + ']';
  }
  if (cleaned.startsWith('{') && !cleaned.endsWith('}')) {
    const lastObjectEnd = cleaned.lastIndexOf('}');
    if (lastObjectEnd !== -1) return cleaned.substring(0, lastObjectEnd + 1) + '}';
    return cleaned + '}';
  }
  return cleaned;
}

function safeJsonParse<T>(text: string | undefined, defaultValue: T, logCallback?: (msg: string, details: string) => void): T {
  if (!text || text === "undefined" || text.trim() === "") return defaultValue;
  try {
    const cleanText = text.replace(/```json\n?|```/g, "").trim();
    return JSON.parse(cleanText) as T;
  } catch (e) {
    try {
      const repaired = repairTruncatedJson(text);
      return JSON.parse(repaired) as T;
    } catch (e2) {
      const errorMsg = `JSONパース失敗: ${e instanceof Error ? e.message : '未知のエラー'}`;
      const details = `解析対象テキスト: ${text.substring(0, 300)}...`;
      if (logCallback) logCallback(errorMsg, details);
      return defaultValue;
    }
  }
}

// 強化されたスキーマ: キャラクター、世界観、年表などの詳細属性を含む
const syncOperationSchema = {
  type: Type.OBJECT,
  properties: {
    op: { type: Type.STRING, description: "操作種別: add, update, delete, set" },
    path: { type: Type.STRING, description: "同期先パス: characters, timeline, foreshadowing, entries, setting, tone, laws, grandArc" },
    targetId: { type: Type.STRING, description: "対象の既存ID（判明している場合のみ）" },
    targetName: { type: Type.STRING, description: "対象の名称（キャラクター名、項目名など）" },
    field: { type: Type.STRING, description: "特定のフィールドを更新する場合のフィールド名 (例: description, health, location)" },
    value: { 
      type: Type.OBJECT, 
      description: "同期するデータ本体。オブジェクト全体または特定のフィールド値を含む。",
      properties: {
        name: { type: Type.STRING },
        description: { type: Type.STRING },
        role: { type: Type.STRING },
        traits: { type: Type.ARRAY, items: { type: Type.STRING } },
        motivation: { type: Type.STRING },
        content: { type: Type.STRING },
        definition: { type: Type.STRING },
        text: { type: Type.STRING },
        location: { type: Type.STRING },
        currentGoal: { type: Type.STRING },
        health: { type: Type.STRING },
        internalState: { type: Type.STRING }
      }
    },
    rationale: { type: Type.STRING, description: "なぜこの変更が必要かという具体的根拠" },
    evidence: { type: Type.STRING, description: "会話の中のどの発言に基づいているか" },
    confidence: { type: Type.NUMBER, description: "信頼度 (0.0 - 1.0)" }
  },
  required: ["op", "path", "targetName", "value", "rationale", "confidence"]
};

async function withRetry<T>(fn: () => Promise<T>, source: string, logCallback?: any, retries = 2, delay = 2000): Promise<T> {
  try {
    return await fn();
  } catch (error: any) {
    const isRetryable = error.message?.includes("429") || error.message?.includes("500") || error.message?.includes("503");
    if (retries > 0 && isRetryable) {
      if (logCallback) logCallback('info', 'System', `${source} 失敗。リプライ中...`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return withRetry(fn, source, logCallback, retries - 1, delay * 2);
    }
    throw error;
  }
}

async function handleGeminiError<T>(fn: () => Promise<T>, source: string, logCallback?: any): Promise<T> {
  try {
    return await withRetry(fn, source, logCallback);
  } catch (error: any) {
    throw new DuoScriptError(error.message || "APIエラー", error.stack, source);
  }
}

const trackUsage = (response: any, model: string, source: string, callback?: (usage: { input: number; output: number; model: string; source: string }) => void) => {
  if (response && response.usageMetadata && callback) {
    callback({
      input: response.usageMetadata.promptTokenCount || 0,
      output: response.usageMetadata.candidatesTokenCount || 0,
      model,
      source
    });
  }
};

const getCompressedContext = (project: StoryProject) => {
  const bible = project.bible;
  const chars = (bible.characters || []).map(c => `- ${c.name} (Role: ${c.role}, Desc: ${(c.description || '').slice(0, 50)}, Goal: ${c.status?.currentGoal || 'なし'})`).join('\n');
  const entries = (bible.entries || []).map(e => `- ${e.title} (${e.category})`).join('\n');
  
  return { 
    chars, 
    entries,
    laws: (bible.laws || '').slice(0, 500), 
    setting: (bible.setting || '').slice(0, 500), 
    arc: (bible.grandArc || '').slice(0, 500),
    tone: bible.tone || 'ニュートラル',
    foreshadowing: (bible.foreshadowing || []).map(f => `- ${f.title} (${f.status})`).join('\n')
  };
};

export const chatWithArchitect = async (
  history: any[], 
  userInput: string, 
  project: StoryProject, 
  useSearch: boolean,
  onUsage: (usage: any) => void,
  logCallback: any
): Promise<{ text: string; sources?: any[] }> => {
  return handleGeminiError(async () => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const ctx = getCompressedContext(project);
    const model = AiModel.REASONING;
    const config: any = {
      systemInstruction: `あなたは物語の「設計士(Architect)」です。作者と対話し、設定の深掘りと整合性維持を担います。
【世界観】: ${ctx.setting}
【理】: ${ctx.laws}
【主要人物】: ${ctx.chars}
【グランドアーク】: ${ctx.arc}

【振る舞い】
- 常に既存の設定との整合性を確認してください。
- 矛盾があれば論理的に指摘し、解消案を提示してください。
- 重要な設定変更や追加が確定した際は「NeuralSyncが反映します」と伝え、具体的な項目を挙げて対話を締めくくってください。`,
      thinkingConfig: { thinkingBudget: 8000 }
    };
    if (useSearch) config.tools = [{ googleSearch: {} }];

    const response = await ai.models.generateContent({
      model,
      contents: history,
      config,
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

export const extractSettingsFromChat = async (
  history: any[], 
  project: StoryProject,
  onUsage: any,
  logCallback: any
): Promise<SyncOperation[]> => {
  return handleGeminiError(async () => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const model = AiModel.REASONING;
    const ctx = getCompressedContext(project);

    const prompt = `直近の対話から、物語設定（World Bible）への具体的な変更を抽出し、JSON配列で出力してください。
【現在のデータ構造のヒント】
- characters: name, description, role, traits, motivation, flaw, status(location, health, currentGoal, internalState)
- entries: title, category, content, definition, narrativeSignificance
- timeline: timeLabel, event, description
- setting/laws/grandArc/tone: 単一の文字列フィールド

対話内容:
${JSON.stringify(history.slice(-8))}`;

    const response = await ai.models.generateContent({
      model,
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: { 
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: syncOperationSchema
        },
        thinkingConfig: { thinkingBudget: 2000 }
      },
    });

    trackUsage(response, model, 'NeuralSync Sync', onUsage);
    const data = safeJsonParse<any[]>(response.text, [], (msg, detail) => logCallback('error', 'NeuralSync', msg, detail));
    
    return data.map((op: any) => ({
      ...op,
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      status: 'proposal',
      baseVersion: project.bible.version
    } as SyncOperation));
  }, 'NeuralSync Sync', logCallback);
};

export const generateFullChapterPackage = async (
  project: StoryProject,
  chapter: ChapterLog,
  onUsage: any,
  logCallback: any
): Promise<{ strategy: ChapterStrategy, beats: PlotBeat[], draft: string }> => {
  return handleGeminiError(async () => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const ctx = getCompressedContext(project);
    const model = AiModel.REASONING;
    const prompt = `章「${chapter.title}」の戦略、詳細なビート、および本文（2000文字程度）を生成してください。
【前提】
あらすじ: ${chapter.summary}
トーン: ${project.bible.tone}
世界観: ${ctx.setting}
理: ${ctx.laws}
人物: ${ctx.chars}

【出力形式】
{
  "strategy": { "milestones": ["点1", "点2"], "forbiddenResolutions": ["避けるべき事"], "characterArcProgress": "変化の度合い", "pacing": "緩急" },
  "beats": [{ "text": "ビート1" }, { "text": "ビート2" }],
  "draft": "物語の本文..."
}`;

    const response = await ai.models.generateContent({
      model,
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: { 
        responseMimeType: "application/json", 
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            strategy: {
              type: Type.OBJECT,
              properties: {
                milestones: { type: Type.ARRAY, items: { type: Type.STRING } },
                forbiddenResolutions: { type: Type.ARRAY, items: { type: Type.STRING } },
                characterArcProgress: { type: Type.STRING },
                pacing: { type: Type.STRING }
              }
            },
            beats: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: { text: { type: Type.STRING } }
              }
            },
            draft: { type: Type.STRING }
          }
        },
        thinkingConfig: { thinkingBudget: 8000 } 
      }
    });
    trackUsage(response, model, 'Chapter Genesis', onUsage);
    const data = safeJsonParse<any>(response.text, {}, (msg, detail) => logCallback('error', 'Writer', msg, detail));
    return {
      strategy: data.strategy || { milestones: [], forbiddenResolutions: [], characterArcProgress: '', pacing: '' },
      beats: (data.beats || []).map((b: any) => ({ id: crypto.randomUUID(), text: b.text })),
      draft: data.draft || ""
    };
  }, 'Chapter Genesis', logCallback);
};

export const generateDraft = async (
  chapter: ChapterLog, 
  tone: string, 
  isHQ: boolean, 
  project: StoryProject, 
  onUsage: any,
  logCallback: any
) => {
  return handleGeminiError(async () => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const model = isHQ ? AiModel.REASONING : AiModel.FAST;
    const ctx = getCompressedContext(project);
    const prompt = `以下のビートに従い、小説を執筆してください。
章題: ${chapter.title}
トーン: ${tone}
あらすじ: ${chapter.summary}
ビート: ${chapter.beats.map(b => b.text).join(' → ')}

【設定遵守】
人物: ${ctx.chars}
理: ${ctx.laws}`;

    const response = await ai.models.generateContent({
      model,
      contents: [{ parts: [{ text: prompt }] }],
      config: isHQ ? { thinkingConfig: { thinkingBudget: 6000 } } : undefined
    });
    trackUsage(response, model, 'Generate Draft', onUsage);
    return response.text || "";
  }, 'Generate Draft', logCallback);
};

export const analyzeBibleIntegrity = async (bible: WorldBible, onUsage: any, logCallback: any): Promise<BibleIssue[]> => {
  return handleGeminiError(async () => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const model = AiModel.REASONING;
    const prompt = `現在の物語設定資料（人物、世界観、理、年表）を分析し、矛盾点や不足点を抽出してください。
設定: ${JSON.stringify(bible)}

【出力形式】
JSON配列。各要素は { "id": "uuid", "type": "Contradiction|Incomplete", "targetIds": ["id1"], "targetType": "Character|Law", "description": "内容", "suggestion": "修正案", "severity": "Low|Medium|High" }`;

    const response = await ai.models.generateContent({
      model,
      contents: [{ parts: [{ text: prompt }] }],
      config: { 
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING },
              type: { type: Type.STRING },
              targetIds: { type: Type.ARRAY, items: { type: Type.STRING } },
              targetType: { type: Type.STRING },
              description: { type: Type.STRING },
              suggestion: { type: Type.STRING },
              severity: { type: Type.STRING }
            },
            required: ["id", "type", "description", "suggestion", "severity"]
          }
        },
        thinkingConfig: { thinkingBudget: 8000 }
      }
    });
    trackUsage(response, model, 'Integrity Scan', onUsage);
    return safeJsonParse<BibleIssue[]>(response.text, [], (msg, detail) => logCallback('error', 'Architect', msg, detail));
  }, 'Integrity Scan', logCallback);
};

export const generateCharacterPortrait = async (char: Character, project: StoryProject, logCallback: any): Promise<string> => {
  return handleGeminiError(async () => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const model = AiModel.IMAGE;
    const prompt = `Detailed anime-style portrait of a character named ${char.name}.
Description: ${char.description}.
Traits: ${char.traits.join(', ')}.
Tone of the story: ${project.bible.tone}.
High quality, masterpiece, character sheet focus.`;

    const response = await ai.models.generateContent({
      model,
      contents: { parts: [{ text: prompt }] },
      config: { imageConfig: { aspectRatio: "1:1" } }
    });

    let b64 = "";
    if (response.candidates?.[0]?.content?.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) b64 = `data:image/png;base64,${part.inlineData.data}`;
      }
    }
    return b64;
  }, 'Portrait Generation', logCallback);
};

export const playCharacterVoice = async (char: Character, text: string, logCallback: any): Promise<void> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const model = AiModel.TTS;
    const response = await ai.models.generateContent({
      model,
      contents: [{ parts: [{ text: `感情を込めて: ${text}` }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: { 
          voiceConfig: { 
            prebuiltVoiceConfig: { voiceName: char.voiceId || 'Puck' } 
          } 
        },
      },
    });
    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (base64Audio) {
      const ctx = new AudioContext({ sampleRate: 24000 });
      const binary = atob(base64Audio);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const dataInt16 = new Int16Array(bytes.buffer);
      const buffer = ctx.createBuffer(1, dataInt16.length, 24000);
      const channelData = buffer.getChannelData(0);
      for (let i = 0; i < dataInt16.length; i++) channelData[i] = dataInt16[i] / 32768.0;
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      source.start();
    }
  } catch (e: any) {
    if (logCallback) logCallback('error', 'Voice', '失敗', e.message);
  }
};

export const simulateBranch = async (hypothesis: string, project: StoryProject, onUsage: any, logCallback: any): Promise<NexusBranch> => {
  return handleGeminiError(async () => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const model = AiModel.REASONING;
    const prompt = `「もしも～（If-then）」の仮説に基づき、物語の因果律の分岐をシミュレートしてください。
仮説: ${hypothesis}
物語の現状: ${JSON.stringify(getCompressedContext(project))}

【出力形式】
JSON: { "impactOnCanon": "世界への影響", "impactOnState": "キャラクターへの影響", "alternateTimeline": ["出来事1", "出来事2"] }`;

    const response = await ai.models.generateContent({
      model,
      contents: [{ parts: [{ text: prompt }] }],
      config: { 
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            impactOnCanon: { type: Type.STRING },
            impactOnState: { type: Type.STRING },
            alternateTimeline: { type: Type.ARRAY, items: { type: Type.STRING } }
          },
          required: ["impactOnCanon", "impactOnState", "alternateTimeline"]
        },
        thinkingConfig: { thinkingBudget: 4000 }
      }
    });
    trackUsage(response, model, 'Nexus Simulation', onUsage);
    const data = safeJsonParse<any>(response.text, {}, (msg, detail) => logCallback('error', 'Architect', msg, detail));
    return { id: crypto.randomUUID(), hypothesis, ...data, timestamp: Date.now() };
  }, 'Nexus Simulation', logCallback);
};

export const suggestNextSentence = async (content: string, project: StoryProject, onUsage: any, logCallback: any): Promise<string[]> => {
  return handleGeminiError(async () => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const model = AiModel.FAST;
    const safeContent = content || "";
    const prompt = `小説の続きとして魅力的な3つの候補を提案してください。
【直前の本文】
${safeContent.slice(-800)}

【出力形式】
JSON配列。["候補1", "候補2", "候補3"]`;

    const response = await ai.models.generateContent({
      model,
      contents: [{ parts: [{ text: prompt }] }],
      config: { 
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: { type: Type.STRING }
        }
      }
    });
    trackUsage(response, model, 'Next Suggestion', onUsage);
    return safeJsonParse<string[]>(response.text, [], (msg, detail) => logCallback('error', 'Writer', msg, detail));
  }, 'Next Suggestion', logCallback);
};

export const decomposeArcIntoStrategy = async (
  project: StoryProject,
  chapter: ChapterLog,
  onUsage: any,
  logCallback: any
): Promise<Partial<ChapterStrategy>> => {
  return handleGeminiError(async () => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const ctx = getCompressedContext(project);
    const model = AiModel.REASONING;
    const prompt = `グランドアークと前後の展開を考慮し、章「${chapter.title}」の執筆戦略を策定してください。
あらすじ: ${chapter.summary}
アーク: ${ctx.arc}

【出力形式】
JSON: { "milestones": ["到達点1", ...], "forbiddenResolutions": ["避けるべき描写"], "pacing": "説明", "characterArcProgress": "説明" }`;

    const response = await ai.models.generateContent({
      model,
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: { 
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            milestones: { type: Type.ARRAY, items: { type: Type.STRING } },
            forbiddenResolutions: { type: Type.ARRAY, items: { type: Type.STRING } },
            pacing: { type: Type.STRING },
            characterArcProgress: { type: Type.STRING }
          }
        }
      }
    });
    trackUsage(response, model, 'Decompose Strategy', onUsage);
    return safeJsonParse<Partial<ChapterStrategy>>(response.text, {}, (msg, detail) => logCallback('error', 'Architect', msg, detail));
  }, 'Decompose Strategy', logCallback);
};

export const generateRandomProject = async (theme: string, logCallback: any): Promise<Partial<StoryProject>> => {
  return handleGeminiError(async () => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const model = AiModel.REASONING;
    const prompt = `テーマ「${theme}」に基づき、重厚な物語の初期設定資料一式を生成してください。
【項目】
- タイトル、ジャンル
- 設定（世界観、歴史）
- 理（物理法則、禁忌）
- グランドアーク（全三幕構成）
- 魅力的な主要人物（3名程度、名前・詳細・動機）

【出力形式】
JSON形式で、StoryProjectの型に準拠してください。`;

    const response = await ai.models.generateContent({
      model,
      contents: [{ parts: [{ text: prompt }] }],
      config: { 
        responseMimeType: "application/json",
        thinkingConfig: { thinkingBudget: 8000 }
      }
    });
    return safeJsonParse<Partial<StoryProject>>(response.text, {}, (msg, detail) => logCallback('error', 'System', msg, detail));
  }, 'Project Genesis', logCallback);
};

export const extractSettingsFromText = async (
  textContent: string, 
  bible: WorldBible, 
  chapter: ChapterLog,
  onUsage: any,
  logCallback: any
): Promise<SyncOperation[]> => {
  return handleGeminiError(async () => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const model = AiModel.REASONING;
    const safeText = textContent || "";
    const prompt = `執筆された本文を分析し、キャラクターの「状態の変化（負傷、感情、所持品、現在地）」を抽出してSyncOperation(JSON配列)で出力してください。
本文: ${safeText.slice(-3000)}`;

    const response = await ai.models.generateContent({
      model,
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: { 
        responseMimeType: "application/json",
        responseSchema: {
            type: Type.ARRAY,
            items: syncOperationSchema
        }
      },
    });
    trackUsage(response, model, 'Extract Settings (Text)', onUsage);
    const data = safeJsonParse<any[]>(response.text, [], (msg, detail) => logCallback('error', 'NeuralSync', msg, detail));
    return data.map((op: any) => ({ ...op, id: crypto.randomUUID(), timestamp: Date.now(), status: 'proposal', baseVersion: bible.version } as SyncOperation));
  }, 'Extract Settings (Text)', logCallback);
};

export const generateBeats = async (
  summary: string, 
  project: StoryProject, 
  onUsage: any,
  logCallback: any
): Promise<PlotBeat[]> => {
  return handleGeminiError(async () => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const model = AiModel.REASONING;
    const prompt = `この章のあらすじを、具体的でドラマチックな8～12個の「プロット・ビート」に分解してください。
あらすじ: ${summary}`;

    const response = await ai.models.generateContent({
      model,
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: { 
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: { text: { type: Type.STRING } },
            required: ["text"]
          }
        }
      }
    });
    trackUsage(response, model, 'Generate Beats', onUsage);
    const data = safeJsonParse<any[]>(response.text, [], (msg, detail) => logCallback('error', 'Writer', msg, detail));
    return data.map((b: any) => ({ id: crypto.randomUUID(), text: b.text }));
  }, 'Generate Beats', logCallback);
};

export const generateChapterSummary = async (
  project: StoryProject, 
  activeChapter: ChapterLog, 
  prevChapter: ChapterLog | null, 
  onUsage: any,
  logCallback: any
): Promise<string> => {
  return handleGeminiError(async () => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const model = AiModel.REASONING;
    const prompt = `前章のあらすじと物語全体の構成を考慮し、この新章「${activeChapter.title}」のあらすじ（シーンの導入と山場）を提案してください。
前章: ${prevChapter?.summary || 'なし'}
グランドアーク: ${project.bible.grandArc}`;

    const response = await ai.models.generateContent({
      model,
      contents: [{ parts: [{ text: prompt }] }],
    });
    trackUsage(response, model, 'Chapter Summary', onUsage);
    return response.text || "";
  }, 'Chapter Summary', logCallback);
};
