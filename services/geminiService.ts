
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

const syncOperationSchema = {
  type: Type.OBJECT,
  properties: {
    op: { type: Type.STRING, description: "操作種別: add, update, delete, set" },
    path: { type: Type.STRING, description: "対象パス: characters, timeline, foreshadowing, entries, setting, tone, laws, grandArc" },
    targetId: { type: Type.STRING, description: "既存ID" },
    targetName: { type: Type.STRING, description: "対象名称" },
    field: { type: Type.STRING, description: "更新フィールド" },
    value: { 
      type: Type.OBJECT, 
      properties: {
        name: { type: Type.STRING },
        description: { type: Type.STRING },
        title: { type: Type.STRING },
        priority: { type: Type.STRING },
        status: { type: Type.STRING },
        text: { type: Type.STRING },
        content: { type: Type.STRING }
      }
    },
    rationale: { type: Type.STRING },
    evidence: { type: Type.STRING },
    confidence: { type: Type.NUMBER }
  },
  required: ["op", "path", "targetName", "value", "rationale", "confidence"]
};

async function withRetry<T>(fn: () => Promise<T>, source: string, logCallback?: any, retries = 2, delay = 2000): Promise<T> {
  try {
    return await fn();
  } catch (error: any) {
    const isRetryable = error.message?.includes("429") || error.message?.includes("500") || error.message?.includes("503");
    if (retries > 0 && isRetryable) {
      if (logCallback) logCallback('info', 'System', `${source} 失敗。リトライ中...`);
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
  return { 
    chars: (bible.characters || []).map(c => `- ${c.name} (ID: ${c.id})`).join('\n'), 
    entries: (bible.entries || []).map(e => `- ${e.title} (ID: ${e.id})`).join('\n'),
    timelines: (bible.timeline || []).map(t => `- ${t.timeLabel}: ${t.event}`).join('\n'),
    setting: (bible.setting || '').slice(0, 300), 
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
      systemInstruction: `あなたは物語の「設計士」です。
【世界観】: ${ctx.setting}
【主要人物】: ${ctx.chars}
【伏線】: ${ctx.foreshadowing}
対話後、設定更新の提案をNeuralSyncで行います。`,
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

export const identifyChangedCategories = async (
  history: any[],
  onUsage: any,
  logCallback: any
): Promise<string[]> => {
  return handleGeminiError(async () => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const model = AiModel.FAST;
    const prompt = `直近の対話を見て、どの設定カテゴリ（characters, entries, timeline, foreshadowing）に具体的な更新が含まれているか判定してください。配列形式で返してください。`;

    const response = await ai.models.generateContent({
      model,
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: { responseMimeType: "application/json" }
    });
    trackUsage(response, model, 'Change Analysis', onUsage);
    return safeJsonParse<string[]>(response.text, [], (msg, detail) => logCallback('error', 'NeuralSync', msg, detail));
  }, 'Change Analysis', logCallback);
};

export const extractSettingsFromChat = async (
  history: any[], 
  project: StoryProject,
  path: 'characters' | 'entries' | 'timeline' | 'foreshadowing' | 'all',
  onUsage: any,
  logCallback: any
): Promise<SyncOperation[]> => {
  return handleGeminiError(async () => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const model = AiModel.REASONING;
    const ctx = getCompressedContext(project);

    let extractionFocus = "";
    if (path === 'characters') extractionFocus = "登場人物のプロフィールや状態変化。";
    else if (path === 'entries') extractionFocus = "世界設定、用語、地理、歴史。";
    else if (path === 'timeline') extractionFocus = "出来事の発生、年表の順序。";
    else if (path === 'foreshadowing') extractionFocus = "「将来への含み」「伏線の設置」「既存の伏線の回収（Resolved化）」に集中してください。";
    else extractionFocus = "物語設定全般。";

    const prompt = `直近の対話から物語設定への変更を抽出し、JSON配列で出力してください。
【抽出の焦点】: ${extractionFocus}
【既存人物】: ${ctx.chars}
【既存伏線】: ${ctx.foreshadowing}

対話内容:
${JSON.stringify(history.slice(-10))}`;

    const response = await ai.models.generateContent({
      model,
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: { 
        responseMimeType: "application/json",
        responseSchema: { type: Type.ARRAY, items: syncOperationSchema },
        thinkingConfig: { thinkingBudget: 3000 }
      },
    });

    trackUsage(response, model, `Sync [${path}]`, onUsage);
    const data = safeJsonParse<any[]>(response.text, [], (msg, detail) => logCallback('error', 'NeuralSync', msg, detail));
    
    return data.map((op: any) => ({
      ...op,
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      status: 'proposal',
      baseVersion: project.bible.version
    } as SyncOperation));
  }, `NeuralSync Sync [${path}]`, logCallback);
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
    const prompt = `章「${chapter.title}」の戦略、詳細なビート、本文を生成してください。
【伏線】: ${ctx.foreshadowing}
【形式】: { "strategy": {...}, "beats": [...], "draft": "..." }`;

    const response = await ai.models.generateContent({
      model,
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: { 
        responseMimeType: "application/json", 
        thinkingConfig: { thinkingBudget: 8000 } 
      }
    });
    trackUsage(response, model, 'Chapter Genesis', onUsage);
    const data = safeJsonParse<any>(response.text, {}, (msg, detail) => logCallback('error', 'Writer', msg, detail));
    return {
      strategy: data.strategy || { milestones: [], forbiddenResolutions: [], characterArcProgress: '', pacing: '' },
      beats: (data.beats || []).map((b: any) => ({ id: crypto.randomUUID(), text: b.text || b })),
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
    const prompt = `章「${chapter.title}」を執筆。
【伏線状況】: ${ctx.foreshadowing}
【トーン】: ${tone}
【ビート】: ${chapter.beats.map(b => b.text).join(' → ')}`;

    const response = await ai.models.generateContent({
      model,
      contents: [{ parts: [{ text: prompt }] }],
      config: isHQ ? { thinkingBudget: 6000 } : undefined
    });
    trackUsage(response, model, 'Generate Draft', onUsage);
    return response.text || "";
  }, 'Generate Draft', logCallback);
};

export const analyzeBibleIntegrity = async (bible: WorldBible, onUsage: any, logCallback: any): Promise<BibleIssue[]> => {
  return handleGeminiError(async () => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const model = AiModel.REASONING;
    const prompt = `物語設定を分析し矛盾点を抽出してください。伏線の未回収や不自然な展開も含めてください。`;

    const response = await ai.models.generateContent({
      model,
      contents: [{ parts: [{ text: JSON.stringify(bible) }] }],
      config: { 
        responseMimeType: "application/json",
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
    const response = await ai.models.generateContent({
      model,
      contents: { parts: [{ text: `Portrait of ${char.name}. ${char.description}.` }] },
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
      contents: [{ parts: [{ text }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: char.voiceId || 'Puck' } } },
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
    const response = await ai.models.generateContent({
      model,
      contents: [{ parts: [{ text: `仮説: ${hypothesis}` }] }],
      config: { responseMimeType: "application/json", thinkingConfig: { thinkingBudget: 4000 } }
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
    const response = await ai.models.generateContent({
      model,
      contents: [{ parts: [{ text: `続きの候補をJSON配列で。直前: ${content.slice(-800)}` }] }],
      config: { responseMimeType: "application/json" }
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
    const model = AiModel.REASONING;
    const response = await ai.models.generateContent({
      model,
      contents: [{ parts: [{ text: `あらすじ: ${chapter.summary}` }] }],
      config: { responseMimeType: "application/json" }
    });
    trackUsage(response, model, 'Decompose Strategy', onUsage);
    return safeJsonParse<Partial<ChapterStrategy>>(response.text, {}, (msg, detail) => logCallback('error', 'Architect', msg, detail));
  }, 'Decompose Strategy', logCallback);
};

export const generateRandomProject = async (theme: string, logCallback: any): Promise<Partial<StoryProject>> => {
  return handleGeminiError(async () => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const model = AiModel.REASONING;
    const response = await ai.models.generateContent({
      model,
      contents: [{ parts: [{ text: `テーマ: ${theme}` }] }],
      config: { responseMimeType: "application/json", thinkingConfig: { thinkingBudget: 8000 } }
    });
    return safeJsonParse<Partial<StoryProject>>(response.text, {}, (msg, detail) => logCallback('error', 'System', msg, detail));
  }, 'Project Genesis', logCallback);
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
    const response = await ai.models.generateContent({
      model,
      contents: [{ parts: [{ text: summary }] }],
      config: { responseMimeType: "application/json" }
    });
    trackUsage(response, model, 'Generate Beats', onUsage);
    const data = safeJsonParse<any[]>(response.text, [], (msg, detail) => logCallback('error', 'Writer', msg, detail));
    return data.map((b: any) => ({ id: crypto.randomUUID(), text: b.text || b }));
  }, 'Generate Beats', logCallback);
};
