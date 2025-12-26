
import { GoogleGenAI, Type, GenerateContentResponse, Modality } from "@google/genai";
import { AiModel, StoryProject, ChapterLog, WorldBible, Character, SyncOperation, WorldEntry, BibleIssue, PlotBeat, TimelineEvent, Foreshadowing, NexusBranch, ChapterStrategy } from "../types";

// 指数バックオフによるリトライ
async function withRetry<T>(fn: () => Promise<T>, retries = 3, delay = 2000): Promise<T> {
  try {
    return await fn();
  } catch (error: any) {
    if (retries > 0 && (error.message?.includes("429") || error.message?.includes("500"))) {
      await new Promise(resolve => setTimeout(resolve, delay));
      return withRetry(fn, retries - 1, delay * 2);
    }
    throw error;
  }
}

async function handleGeminiError<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await withRetry(fn);
  } catch (error: any) {
    const msg = error.message || "";
    if (msg.includes("SAFETY") || msg.includes("blocked")) {
      throw new Error("POLICY_VIOLATION: 内容が安全基準に触れました。表現を調整してください。");
    }
    throw error;
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
  const chars = project.bible.characters.map(c => `- ${c.name} (${c.role}): ${c.description.slice(0, 80)}`).join('\n');
  const laws = project.bible.laws.slice(0, 400);
  const setting = project.bible.setting.slice(0, 400);
  const arc = project.bible.grandArc.slice(0, 800);
  const tone = project.bible.tone;
  const foreshadowing = project.bible.foreshadowing.map(f => `- ${f.title} (${f.status})`).join('\n');
  const library = project.bible.entries.map(e => `- ${e.title} [${e.aliases.join(',')}]: ${e.content.slice(0, 50)}`).join('\n');
  return { chars, laws, setting, arc, tone, foreshadowing, library };
};

export const chatWithArchitect = async (
  history: any[], 
  userInput: string, 
  project: StoryProject, 
  useSearch: boolean,
  onUsage: (usage: any) => void
): Promise<{ text: string; sources?: any[] }> => {
  return handleGeminiError(async () => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const ctx = getCompressedContext(project);
    
    const model = AiModel.REASONING;
    const config: any = {
      systemInstruction: `あなたは物語の設計士(Architect)です。
【現在の設定状況】
設定: ${ctx.setting}
世界の理: ${ctx.laws}
トーン: ${ctx.tone}
大筋: ${ctx.arc}
主要人物:
${ctx.chars}
現在の伏線:
${ctx.foreshadowing}
用語集（Library）:
${ctx.library}

【ミッション】
作者と対話し、設定の深掘りや矛盾の解消を行ってください。
特に「用語（Entries）」に関しては、以下の区別を厳格に行ってください：
1. Definition（定義）: その言葉の客観的な意味、歴史。
2. Narrative Significance（物語上の意味）: その言葉が物語の中で果たす役割、象徴。
3. Aliases（別名）: 表記揺れ、隠語、略称。

新しい用語が出た際、それが既存用語の別名であれば「addAlias」を提案し、新しい概念であれば「add (entries)」を提案してください。`,
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
  });
};

export const generateFullWorldPackage = async (
  premise: string,
  onUsage: any
): Promise<SyncOperation[]> => {
  return handleGeminiError(async () => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const model = AiModel.REASONING;
    
    const prompt = `あなたは物語の設計士です。以下の物語の核（Premise）に基づき、世界設定、世界の理、物語の大筋、主要キャラクター3名を一括で考案してください。
    
【核となるアイデア】
${premise}

以下の要件を満たすJSONの配列（SyncOperation形式）で出力してください：
- path: 'setting', 'laws', 'grandArc', 'characters' のいずれか。
- op: 'set' (設定・理・大筋の場合) または 'add' (キャラクターの場合)。
- rationale: その設定が必要な理由。
- evidence: アイデアの根拠。
- value: 設定内容。キャラクターの場合は、name, role, description, motivation, flaw, arc を含むオブジェクト。`;

    const response = await ai.models.generateContent({
      model,
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              op: { type: Type.STRING },
              path: { type: Type.STRING },
              value: { type: Type.STRING }, // Characterの場合はJSON文字列またはオブジェクト
              rationale: { type: Type.STRING },
              evidence: { type: Type.STRING }
            }
          }
        }
      }
    });

    trackUsage(response, model, 'World Genesis', onUsage);
    try {
      const ops = JSON.parse(response.text || "[]");
      return ops.map((op: any) => ({
        ...op,
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        status: 'proposal',
        baseVersion: 1
      } as SyncOperation));
    } catch { return []; }
  });
};

export const generateFullChapterPackage = async (
  project: StoryProject,
  chapter: ChapterLog,
  onUsage: any
): Promise<{ strategy: ChapterStrategy, beats: PlotBeat[], draft: string }> => {
  return handleGeminiError(async () => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const ctx = getCompressedContext(project);
    const model = AiModel.REASONING;

    const prompt = `あなたは物語の設計士兼筆者です。章「${chapter.title}」を完成させるために必要な全ての要素（戦略・ビート・本文）を一括で生成してください。
    
【物語の背景】
大筋: ${ctx.arc}
設定: ${ctx.setting}
現在のトーン: ${ctx.tone}

【章のあらすじ】
${chapter.summary || 'あらすじはまだありません。タイトルから推測してください。'}

以下のJSON形式で出力してください：
{
  "strategy": {
    "milestones": ["この章で達成するべきこと1", "2"...],
    "forbiddenResolutions": ["まだ解決してはいけないこと"],
    "characterArcProgress": "心情の変化",
    "pacing": "テンポ感"
  },
  "beats": [{"text": "展開1"}, {"text": "展開2"}...],
  "draft": "物語の本文（文芸的で情緒豊かな描写）"
}`;

    const response = await ai.models.generateContent({
      model,
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: {
        responseMimeType: "application/json",
        thinkingConfig: { thinkingBudget: 16000 }
      }
    });

    trackUsage(response, model, 'Chapter Genesis', onUsage);
    const data = JSON.parse(response.text || "{}");
    return {
      strategy: data.strategy || { milestones: [], forbiddenResolutions: [], characterArcProgress: '', pacing: '' },
      beats: (data.beats || []).map((b: any) => ({ id: crypto.randomUUID(), text: b.text })),
      draft: data.draft || ""
    };
  });
};

export const decomposeArcIntoStrategy = async (
  project: StoryProject,
  chapter: ChapterLog,
  onUsage: any
): Promise<Partial<ChapterStrategy>> => {
  return handleGeminiError(async () => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const ctx = getCompressedContext(project);
    const prevChapters = project.chapters.slice(0, project.chapters.findIndex(c => c.id === chapter.id)).map(c => c.title).join(', ');

    const model = AiModel.REASONING;
    const prompt = `物語の設計士として、全体の大筋（Grand Arc）に基づき、この特定の章における「戦略的任務」を定義してください。
【大筋】
${ctx.arc}

【既刊の章】
${prevChapters || "なし（これが第1章です）"}

【現在の章】
題名: ${chapter.title}
あらすじ: ${chapter.summary}

以下の項目をJSONで出力してください：
1. milestones: この章で必ず達成・進行させるべき要素（3つ程度）。
2. forbiddenResolutions: この段階で「まだ解決してはいけない」謎や人間関係。
3. characterArcProgress: キャラクターの心情変化の目標。
4. pacing: 章のテンポ（例：静かな導入、緊迫した逃走など）。`;

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
            characterArcProgress: { type: Type.STRING },
            pacing: { type: Type.STRING }
          }
        }
      }
    });

    trackUsage(response, model, 'Decompose Strategy', onUsage);
    return JSON.parse(response.text || "{}");
  });
};

export const generateBeats = async (
  summary: string, 
  project: StoryProject, 
  currentBeats: PlotBeat[], 
  onUsage: any
): Promise<PlotBeat[]> => {
  return handleGeminiError(async () => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const ctx = getCompressedContext(project);
    
    const model = AiModel.REASONING;
    const prompt = `あなたは物語の設計士です。以下のあらすじに基づき、具体的なシーン展開（プロットビート）を5〜10個程度に分解してください。
【あらすじ】
${summary}

【世界設定・トーン】
${ctx.setting}
${ctx.tone}

既存のビートがある場合は、それを踏まえて改善・詳細化してください：
${currentBeats.map((b, i) => `${i+1}. ${b.text}`).join('\n')}

JSON形式で、各ビートの「text」を含むオブジェクトの配列を返してください。`;

    const response = await ai.models.generateContent({
      model,
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              text: { type: Type.STRING }
            },
            required: ["text"]
          }
        }
      }
    });

    trackUsage(response, model, 'Generate Beats', onUsage);
    try {
      const data = JSON.parse(response.text || "[]");
      return data.map((b: any) => ({
        id: crypto.randomUUID(),
        text: b.text
      }));
    } catch { return currentBeats; }
  });
};

export const generateDraft = async (
  chapter: ChapterLog, 
  tone: string, 
  isHQ: boolean, 
  project: StoryProject, 
  onUsage: any
) => {
  return handleGeminiError(async () => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const povChar = project.bible.characters.find(c => c.id === chapter.strategy.povCharacterId);
    const model = isHQ ? AiModel.REASONING : AiModel.FAST;

    const prompt = `あなたはプロの小説家です。
【章の戦略】
章題: ${chapter.title}
POV: ${povChar ? povChar.name : '俯瞰'}
Milestones: ${chapter.strategy.milestones.join(', ')}
Forbidden: ${chapter.strategy.forbiddenResolutions.join(', ')}
Beats: ${chapter.beats.map((b, i) => `${i+1}. ${b.text}`).join('\n')}

【世界の理/トーン】
Tone: ${tone}
Laws: ${project.bible.laws}

要件:
- 指定された「Forbidden」は絶対に解決させない。
- 指定された「Milestones」を確実に消化する。
- 情緒的で、文芸的な描写を心がける。
- POVが設定されている場合、その人物が認知できない情報は書かない。`;

    const response = await ai.models.generateContent({
      model,
      contents: [{ parts: [{ text: prompt }] }],
      config: isHQ ? { thinkingConfig: { thinkingBudget: 8000 } } : undefined
    });
    
    trackUsage(response, model, 'Generate Draft', onUsage);
    return response.text || "";
  });
};

export const extractSettingsFromChat = async (
  history: any[], 
  bible: WorldBible, 
  onUsage: any
): Promise<SyncOperation[]> => {
  return handleGeminiError(async () => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const model = AiModel.REASONING;
    const response = await ai.models.generateContent({
      model,
      contents: [{ role: 'user', parts: [{ text: `以下の会話から物語設定の変更を抽出し、JSONで出力してください。
特にentries（用語集）に関しては、新規追加(add)か既存用語への別名追加(addAlias)かを注意深く判断してください。

会話ログ:
${JSON.stringify(history.slice(-8))}` }] }],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              op: { type: Type.STRING, description: 'add, update, delete, set, merge, addAlias のいずれか' },
              path: { type: Type.STRING },
              targetId: { type: Type.STRING },
              targetName: { type: Type.STRING },
              field: { type: Type.STRING },
              value: { type: Type.STRING },
              rationale: { type: Type.STRING },
              evidence: { type: Type.STRING },
              confidence: { type: Type.NUMBER }
            },
            required: ["op", "path", "value", "rationale", "evidence"]
          }
        }
      },
    });

    trackUsage(response, model, 'Extract Settings (Chat)', onUsage);
    try {
      return JSON.parse(response.text || "[]").map((op: any) => ({
        ...op,
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        status: 'proposal',
        baseVersion: bible.version
      } as SyncOperation));
    } catch { return []; }
  });
};

export const extractSettingsFromText = async (
  textContent: string, 
  bible: WorldBible, 
  chapter: ChapterLog,
  onUsage: any
): Promise<SyncOperation[]> => {
  return handleGeminiError(async () => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const charsContext = bible.characters.map(c => `${c.id}: ${c.name}`).join('\n');
    const beatsContext = chapter.beats.map((b, i) => `${b.id}: Beat ${i+1}. ${b.text}`).join('\n');
    const model = AiModel.REASONING;

    const prompt = `あなたは物語の監査官です。以下の小説本文から、キャラクターの状態に関する「具体的な変化（Delta）」のみを抽出してください。
【解析対象の本文】
${textContent.slice(-3000)}

必ずJSON形式のリストで出力してください。`;

    const response = await ai.models.generateContent({
      model,
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              op: { type: Type.STRING, description: 'set (変更), add (配列への追加), remove (配列からの削除)' },
              path: { type: Type.STRING, description: 'characters' },
              targetId: { type: Type.STRING, description: '対象キャラのID' },
              targetName: { type: Type.STRING, description: '対象キャラの名前' },
              field: { type: Type.STRING, description: 'location, health, inventory, knowledge, currentGoal, internalState のいずれか' },
              value: { type: Type.STRING, description: '変更後の具体的な値' },
              beatId: { type: Type.STRING, description: '該当するビートID' },
              rationale: { type: Type.STRING, description: 'なぜそう判断したか' },
              evidence: { type: Type.STRING, description: '根拠となる本文の一節' },
              confidence: { type: Type.NUMBER }
            },
            required: ["op", "path", "targetId", "field", "value", "rationale", "evidence"]
          }
        }
      },
    });

    trackUsage(response, model, 'Extract Settings (Text)', onUsage);
    try {
      const data = JSON.parse(response.text || "[]");
      return data.map((op: any) => ({
        ...op,
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        status: 'proposal',
        baseVersion: bible.version
      } as SyncOperation));
    } catch { return []; }
  });
};

export const analyzeBibleIntegrity = async (bible: WorldBible, onUsage: any): Promise<BibleIssue[]> => {
  return handleGeminiError(async () => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const model = AiModel.REASONING;
    const response = await ai.models.generateContent({
      model,
      contents: [{ parts: [{ text: `設定資料を横断分析し、矛盾(Contradiction)や設定漏れ(Incomplete)をJSONで指摘してください。\n${JSON.stringify(bible)}` }] }],
      config: { 
        responseMimeType: "application/json", 
        responseSchema: { 
          type: Type.ARRAY, 
          items: { 
            type: Type.OBJECT, 
            properties: {
              id: { type: Type.STRING },
              type: { type: Type.STRING },
              targetType: { type: Type.STRING },
              targetIds: { type: Type.ARRAY, items: { type: Type.STRING } },
              description: { type: Type.STRING },
              suggestion: { type: Type.STRING },
              severity: { type: Type.STRING }
            },
            required: ["id", "type", "description", "suggestion", "severity", "targetType", "targetIds"]
          }
        }
      }
    });
    trackUsage(response, model, 'Integrity Scan', onUsage);
    return JSON.parse(response.text || "[]");
  });
};

export const simulateBranch = async (hypothesis: string, project: StoryProject, onUsage: any): Promise<NexusBranch> => {
  return handleGeminiError(async () => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const ctx = getCompressedContext(project);
    const model = AiModel.REASONING;
    const response = await ai.models.generateContent({
      model,
      contents: [{ parts: [{ text: `現在の設定:\n${JSON.stringify(ctx)}\n\n仮説：「もしも：${hypothesis}」が起きた場合の影響をシミュレートしてください。` }] }],
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
        }
      }
    });
    trackUsage(response, model, 'Nexus Simulation', onUsage);
    const data = JSON.parse(response.text || "{}");
    return { id: crypto.randomUUID(), hypothesis, ...data, timestamp: Date.now() };
  });
};

export const generateCharacterPortrait = async (char: Character, project: StoryProject): Promise<string> => {
  return handleGeminiError(async () => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const model = AiModel.IMAGE;
    const response = await ai.models.generateContent({
      model,
      contents: { parts: [{ text: `Cinematic literary portrait of ${char.name}. ${char.description}. Style: Detailed, atmospheric, story-driven.` }] },
    });
    let b64 = "";
    if (response.candidates?.[0]?.content?.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) b64 = `data:image/png;base64,${part.inlineData.data}`;
      }
    }
    return b64;
  });
};

export const playCharacterVoice = async (char: Character, text: string): Promise<void> => {
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
};

export const generateCharacterIdea = async (project: StoryProject, onUsage: any): Promise<any> => {
  return handleGeminiError(async () => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const model = AiModel.REASONING;
    const response = await ai.models.generateContent({ 
      model, 
      contents: [{ parts: [{ text: `新キャラクター案をJSONで。` }] }],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING },
            role: { type: Type.STRING },
            description: { type: Type.STRING },
            motivation: { type: Type.STRING },
            flaw: { type: Type.STRING },
            arc: { type: Type.STRING }
          }
        }
      }
    });
    trackUsage(response, model, 'Character Idea', onUsage);
    return JSON.parse(response.text || "{}");
  });
};

export const suggestNextSentence = async (content: string, project: StoryProject, onUsage: any): Promise<string[]> => {
  return handleGeminiError(async () => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const model = AiModel.FAST;
    const response = await ai.models.generateContent({
      model,
      contents: [{ parts: [{ text: `続きの3案をJSONで。本文：\n${content.slice(-600)}` }] }],
      config: { 
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: { type: Type.STRING }
        }
      }
    });
    trackUsage(response, model, 'Next Sentence Suggestion', onUsage);
    return JSON.parse(response.text || "[]");
  });
};

export const generateChapterSummary = async (
  project: StoryProject, 
  activeChapter: ChapterLog, 
  prevChapter: ChapterLog | null, 
  onUsage: any
): Promise<string> => {
  return handleGeminiError(async () => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const ctx = getCompressedContext(project);
    const model = AiModel.REASONING;
    const prompt = `新章「${activeChapter.title}」の具体的なあらすじ案を作成してください。\n前章：${prevChapter?.title || 'なし'}\n全体の大筋：${ctx.arc}`;
    const response = await ai.models.generateContent({
      model,
      contents: [{ parts: [{ text: prompt }] }],
    });
    trackUsage(response, model, 'Chapter Summary', onUsage);
    return response.text || "";
  });
};

export const generateRandomProject = async (theme: string): Promise<Partial<StoryProject>> => {
  return handleGeminiError(async () => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const model = AiModel.REASONING;
    const response = await ai.models.generateContent({
      model,
      contents: [{ parts: [{ text: `テーマ: "${theme}" の初期設定案をJSONで。` }] }],
      config: { 
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            bible: {
              type: Type.OBJECT,
              properties: {
                setting: { type: Type.STRING },
                laws: { type: Type.STRING },
                grandArc: { type: Type.STRING },
                tone: { type: Type.STRING }
              }
            }
          }
        }
      }
    });
    return JSON.parse(response.text || "{}");
  });
};
