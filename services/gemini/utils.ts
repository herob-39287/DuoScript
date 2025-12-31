
import { StoryProject, AiModel, UsageCallback, LogCallback, TaskComplexity, ModelRequestConfig, TransmissionScope, SafetyPreset, Character, ContextFocus } from "../../types";
import { GenerateContentResponse, HarmCategory, HarmBlockThreshold } from "@google/genai";

export class DuoScriptError extends Error {
  constructor(
    message: string, 
    public details?: string, 
    public source?: string,
    public status?: number,
    public safetyCategory?: string
  ) {
    super(message);
    this.name = 'DuoScriptError';
  }
}

/**
 * 簡易的なトークン数推定 (文字数ベース)
 */
export function estimateTokenCount(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length * 1.1);
}

export function generateDeterministicSeed(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0; 
  }
  return Math.abs(hash);
}

export function getFriendlyErrorMessage(error: any): string {
  const msg = error.message || "";
  const status = error.status || 0;
  if (msg.includes("API key not valid") || status === 401) return "APIキーが無効です。";
  if (msg.includes("429") || msg.includes("Too Many Requests")) return "利用制限に達しました。";
  if (msg.includes("SAFETY") || msg.includes("safety")) return "安全ポリシーにより生成が中断されました。";
  return "AIとの通信中にエラーが発生しました。";
}

export function translateSafetyCategory(category?: string): string {
  if (!category) return "不明な安全ポリシー";
  const map: Record<string, string> = {
    'HARM_CATEGORY_SEXUALLY_EXPLICIT': '性的表現',
    'HARM_CATEGORY_HATE_SPEECH': 'ヘイトスピーチ',
    'HARM_CATEGORY_HARASSMENT': '嫌がらせ',
    'HARM_CATEGORY_DANGEROUS_CONTENT': '危険なコンテンツ',
    'HARM_CATEGORY_CIVIC_INTEGRITY': '公的誠実性'
  };
  return map[category] || category;
}

export function repairTruncatedJson(text: string): { repairedText: string, repairSteps: string[] } {
  let repaired = text.trim();
  const steps: string[] = [];

  if (repaired.startsWith('```json')) {
    repaired = repaired.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    steps.push("Markdown code block removed");
  }

  const openBraces = (repaired.match(/\{/g) || []).length;
  const closeBraces = (repaired.match(/\}/g) || []).length;
  const openBrackets = (repaired.match(/\[/g) || []).length;
  const closeBrackets = (repaired.match(/\]/g) || []).length;

  if (openBrackets > closeBrackets) {
    repaired += ']'.repeat(openBrackets - closeBrackets);
    steps.push("Closed brackets");
  }
  if (openBraces > closeBraces) {
    repaired += '}'.repeat(openBraces - closeBraces);
    steps.push("Closed braces");
  }

  return { repairedText: repaired, repairSteps: steps };
}

export function safeJsonParse<T>(text: string, source: string): { value: T | null; error?: string } {
  try {
    const cleanText = text.replace(/```json\n?|\n?```/g, "").trim();
    return { value: JSON.parse(cleanText) as T };
  } catch (e) {
    try {
      const { repairedText } = repairTruncatedJson(text);
      return { value: JSON.parse(repairedText) as T };
    } catch (e2) {
      console.error(`JSON Parse Error [${source}]:`, text);
      return { value: null, error: "JSON parsing failed" };
    }
  }
}

export async function handleGeminiError<T>(
  operation: () => Promise<T>,
  source: string,
  logCallback?: LogCallback
): Promise<T> {
  try {
    return await operation();
  } catch (error: any) {
    const friendly = getFriendlyErrorMessage(error);
    if (logCallback) {
      logCallback('error', source as any, friendly, error.message);
    }
    throw error;
  }
}

export async function withRetry<T>(
  operation: () => Promise<T>,
  source: string,
  logCallback: LogCallback,
  maxRetries = 3
): Promise<T> {
  let lastError: any;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await operation();
    } catch (error: any) {
      lastError = error;
      if (error.status === 429 || error.message.includes("429")) {
        const delay = Math.pow(2, i) * 1000 + Math.random() * 500;
        await new Promise(resolve => setTimeout(resolve, delay));
        if (i === 1) logCallback('info', source as any, "混雑のためリトライしています...");
        continue;
      }
      throw error; 
    }
  }
  throw lastError;
}

export function trackUsage(
  response: GenerateContentResponse, 
  model: string, 
  source: string, 
  callback?: UsageCallback
) {
  if (!response.usageMetadata || !callback) return;
  callback({
    model,
    source,
    input: response.usageMetadata.promptTokenCount || 0,
    output: response.usageMetadata.candidatesTokenCount || 0
  });
}

export function getSafetySettings() {
  return [
    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
    { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH }
  ];
}

/**
 * 階層化コンテキストの構築
 * 
 * @param project プロジェクトデータ
 * @param activeChapterId (Writer用) 現在の章ID
 * @param extraRelevantIds (Architect用) 会話から抽出された関連ID
 */
export function getCompressedContext(
  project: StoryProject, 
  activeChapterId?: string, 
  extraRelevantIds: string[] = [],
  focus: ContextFocus = 'AUTO'
): string {
  const { bible, chapters } = project;
  const activeChapter = activeChapterId ? chapters.find(c => c.id === activeChapterId) : null;
  
  // マージされた関連IDリスト (章のキャッシュ + 動的抽出分)
  const combinedRelevantIds = Array.from(new Set([
    ...(activeChapter?.relevantEntityIds || []),
    ...extraRelevantIds
  ]));

  // Tier 0: Anchor (20%) - 常にフルデータ
  const anchor = `
=== [Tier 0] CORE FOUNDATION ===
Title: ${project.meta.title}
Genre: ${project.meta.genre}
World Setting: ${bible.setting.slice(0, 800)}...
Laws: ${bible.laws.map(l => l.name + ": " + (l.shortSummary || l.description.slice(0, 150))).join("\n - ")}
Grand Arc: ${bible.grandArc.slice(0, 800)}...
Tone: ${bible.tone}
`.trim();

  // Tier 1: Explicitly Active (40%) - 章に関与している人物
  let tier1 = "=== [Tier 1] ACTIVE ENTITIES (In-Focus) ===\n";
  if (activeChapter) {
    const activeChars = bible.characters.filter(c => activeChapter.involvedCharacterIds.includes(c.id));
    activeChars.forEach(c => {
      tier1 += formatEntityDetailed(c, bible);
    });
  } else if (focus !== 'AUTO') {
     // 設計パートでフォーカスが指定されている場合
     if (focus === 'CHARACTERS') {
       bible.characters.slice(0, 5).forEach(c => tier1 += formatEntityDetailed(c, bible));
     }
  }

  // Tier 2: Semantically Relevant (30%) - 司書が選んだ関連項目
  let tier2 = "=== [Tier 2] RELEVANT CONTEXT (Semantic Recall) ===\n";
  combinedRelevantIds.forEach(id => {
    // すでにTier1で出ている場合はスキップ
    if (activeChapter?.involvedCharacterIds.includes(id)) return;

    const char = bible.characters.find(c => c.id === id);
    const entry = bible.entries.find(e => e.id === id);
    const item = bible.keyItems.find(k => k.id === id);
    const loc = bible.locations.find(l => l.id === id);
    
    if (char) tier2 += formatEntitySummary(char);
    else if (entry) tier2 += `- [Term] ${entry.title}: ${entry.definition.slice(0, 300)}\n`;
    else if (item) tier2 += `- [Item] ${item.name}: ${item.description.slice(0, 300)}\n`;
    else if (loc) tier2 += `- [Loc] ${loc.name}: ${loc.description.slice(0, 300)}\n`;
  });

  // Tier 3: All Others (10%) - スナップショット(1行)
  let tier3 = "=== [Tier 3] WORLD SNAPSHOTS (Background Memory) ===\n";
  
  // 未出現の用語をスナップショット化
  bible.entries.forEach(e => {
    if (!combinedRelevantIds.includes(e.id)) {
      tier3 += `[Term: ${e.title}: ${e.shortSummary || e.definition.slice(0, 60)}...] `;
    }
  });

  // 未出現の他キャラクター
  bible.characters.forEach(c => {
    if (!combinedRelevantIds.includes(c.id) && !activeChapter?.involvedCharacterIds.includes(c.id)) {
      tier3 += `[Char: ${c.profile.name}: ${c.profile.shortSummary || c.profile.role}] `;
    }
  });

  return `${anchor}\n\n${tier1}\n\n${tier2}\n\n${tier3}`;
}

function formatEntityDetailed(c: Character, bible: any): string {
  const p = c.profile;
  const s = c.state;
  return `### Character: ${p.name} [${p.role}]
- Profile: ${p.description}
- Personality: ${p.personality}
- Motivation: ${p.motivation}
- Traits: ${p.traits.join(", ")}
- Voice Style: ${p.voice.speechStyle} (1st: ${p.voice.firstPerson}, 2nd: ${p.voice.secondPerson})
- Current State: ${s.internalState} at ${s.location} (Goal: ${s.currentGoal})
- Relationships: ${c.relationships.map(r => {
    const target = bible.characters.find((tc:any) => tc.id === r.targetId);
    return (target?.profile.name || "Unknown") + " (" + r.type + ": " + r.description + ")";
  }).join(", ")}
\n`;
}

function formatEntitySummary(entity: any): string {
  if (entity.profile) {
    return `- [Char] ${entity.profile.name} (${entity.profile.role}): ${entity.profile.shortSummary || entity.profile.description.slice(0, 150)}\n`;
  }
  return `- ${entity.title || entity.name}: ${entity.shortSummary || entity.definition?.slice(0, 150) || entity.description?.slice(0, 150)}\n`;
}
