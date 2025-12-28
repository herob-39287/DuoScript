
import { GoogleGenAI, Type } from "@google/genai";
import { AiModel, StoryProject, ChapterLog, SyncOperation, PlotBeat, BibleIssue, NexusBranch, ChapterStrategy } from "../../types";
import { handleGeminiError, getCompressedContext, trackUsage, safeJsonParse, determineThinkingBudget } from "./utils";
import { syncOperationSchema } from "./schemas";

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
        systemInstruction: `あなたは物語の「設計士(Architect)」です。物語の論理的一貫性と構造的な美しさを司ります。
以下の物語設定を深く理解した上で、執筆者の構想を具体化し、世界の理を維持してください。

【現在の物語コンテキスト】
${ctx}

【回答の指針】
1. キャラクターの動機と矛盾しないか常にチェックする。
2. 読者の予想を裏切るが、伏線によって納得できる展開を提案する。
3. 設定の変更が必要な場合は、その影響範囲（Canonへの影響）を指摘する。`,
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
        parts: [{ text: `以下の物語設定の中に、矛盾、未回収の伏線、または物語の理に反する箇所がないか徹底的に分析してください。\n\n${JSON.stringify(compactBible)}` }]
      }],
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
              description: { type: Type.STRING },
              suggestion: { type: Type.STRING },
              severity: { type: Type.STRING }
            },
            required: ["type", "description", "suggestion"]
          }
        },
        thinkingConfig: { thinkingBudget: determineThinkingBudget(model, 'critical') }
      }
    });

    trackUsage(response, model, 'Integrity Scan', onUsage);
    return safeJsonParse<BibleIssue[]>(response.text, [], logCallback);
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
