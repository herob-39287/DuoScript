
import { StoryProject, AiModel, UsageCallback, LogCallback, TaskComplexity, ModelRequestConfig, TransmissionScope, SafetyPreset } from "../../types";
import { GenerateContentResponse } from "@google/genai";

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
  if (msg.includes("SAFETY")) return "安全ポリシーにより生成が中断されました。";
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

export function repairTruncatedJson(text: string): { repairedText: string, repairSteps: string[], isModified: boolean } {
  let current = text.trim();
  const steps: string[] = [];
  if (current.startsWith('```')) {
    current = current.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
    steps.push("remove_markdown_blocks");
  }
  const firstBrace = current.indexOf('{');
  const firstBracket = current.indexOf('[');
  const startIdx = (firstBrace !== -1 && firstBracket !== -1) ? Math.min(firstBrace, firstBracket) : Math.max(firstBrace, firstBracket);
  if (startIdx > 0) { current = current.substring(startIdx); steps.push("trim_prefix_junk"); }
  const stack: string[] = [];
  let inString = false;
  let escaped = false;
  let lastValidEnd = -1;
  for (let i = 0; i < current.length; i++) {
    const char = current[i];
    if (escaped) { escaped = false; continue; }
    if (char === '\\') { escaped = true; continue; }
    if (char === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (char === '{') stack.push('}');
    else if (char === '[') stack.push(']');
    else if (char === '}' || char === ']') {
      if (stack.length > 0 && stack[stack.length - 1] === char) {
        stack.pop();
        if (stack.length === 0) lastValidEnd = i;
      }
    }
  }
  if (stack.length === 0 && lastValidEnd !== -1 && lastValidEnd < current.length - 1) {
    current = current.substring(0, lastValidEnd + 1);
    steps.push("trim_suffix_junk");
  }
  current = current.replace(/,\s*([}\]])/g, '$1');
  if (stack.length > 0) {
    current = current.replace(/,\s*$/, "");
    const closing = stack.reverse().join('');
    current += closing;
    steps.push("close_unclosed_structures");
  }
  return { repairedText: current, repairSteps: steps, isModified: steps.length > 0 };
}

export function safeJsonParse<T>(text: string | undefined, source: string, logCallback?: LogCallback): { status: string, value: T | null, rawText: string, error?: string } {
  const rawText = text || "";
  if (!text || text.trim() === "") return { status: 'PARSE_FAILED', value: null, rawText, error: "Empty input" };
  const initialClean = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  try {
    const value = JSON.parse(initialClean) as T;
    return { status: 'PARSE_OK', value, rawText };
  } catch (e) {
    const repair = repairTruncatedJson(text);
    try {
      const repairedValue = JSON.parse(repair.repairedText) as T;
      return { status: 'REPAIRED_OK', value: repairedValue, rawText };
    } catch (err: any) {
      return { status: 'PARSE_FAILED', value: null, rawText, error: err.message };
    }
  }
}

export async function withRetry<T>(fn: () => Promise<T>, source: string, logCallback?: LogCallback, retries = 3): Promise<T> {
  let attempt = 0;
  while (attempt <= retries) {
    try { return await fn(); } catch (error: any) {
      if (attempt < retries && (error.message?.includes("429") || error.message?.includes("500"))) {
        attempt++;
        await new Promise(r => setTimeout(r, 2000 * Math.pow(2, attempt - 1)));
        continue;
      }
      throw error;
    }
  }
  throw new Error("Max retries reached");
}

export async function handleGeminiError<T>(fn: () => Promise<T>, source: string, logCallback?: LogCallback): Promise<T> {
  try { return await withRetry(fn, source, logCallback); } catch (error: any) {
    const friendly = getFriendlyErrorMessage(error);
    if (logCallback) logCallback('error', source as any, friendly, error.message);
    throw new DuoScriptError(friendly, error.message, source);
  }
}

export const trackUsage = (res: GenerateContentResponse, model: string, source: string, callback?: UsageCallback) => {
  if (res?.usageMetadata && callback) {
    callback({ input: res.usageMetadata.promptTokenCount || 0, output: res.usageMetadata.candidatesTokenCount || 0, model, source });
  }
};

export const getSafetySettings = (preset: SafetyPreset = SafetyPreset.MATURE) => {
  const thresholdMap: Record<SafetyPreset, string> = {
    [SafetyPreset.STRICT]: 'BLOCK_LOW_AND_ABOVE',
    [SafetyPreset.MATURE]: 'BLOCK_MEDIUM_AND_ABOVE',
    [SafetyPreset.CREATIVE]: 'BLOCK_ONLY_HIGH'
  };
  const threshold = thresholdMap[preset];
  return [
    { category: 'HARM_CATEGORY_HARASSMENT', threshold },
    { category: 'HARM_CATEGORY_HATE_SPEECH', threshold },
    { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold },
    { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold }
  ];
};

export const getCompressedContext = (project: StoryProject, activeChapterId?: string) => {
  const bible = project.bible;
  const prefs = project.meta.preferences;
  const scope = prefs?.transmissionScope || TransmissionScope.FULL;
  const activeChapter = activeChapterId ? project.chapters.find(c => c.id === activeChapterId) : project.chapters[project.chapters.length - 1];
  
  if (scope === TransmissionScope.MINIMAL) {
    return "[Transmission Scope: Minimal] context omitted.";
  }

  // 1. 世界の根源的真理（Laws）
  const laws = (scope === TransmissionScope.FULL || scope === TransmissionScope.SUMMARY) && bible.laws 
    ? `[Canon Laws]\n${bible.laws.slice(0, 500)}` : "";

  // 2. 進行中の主要スレッド（伏線）
  const openForeshadowing = (scope === TransmissionScope.FULL || scope === TransmissionScope.SUMMARY)
    ? bible.foreshadowing
      .filter(f => f.status === 'Open')
      .slice(0, 5)
      .map(f => `- ${f.title}: ${f.description.slice(0, 60)}`)
      .join('\n')
    : "";

  // 3. 視点・主要キャスト
  const involvedCharIds = new Set(activeChapter?.involvedCharacterIds || []);
  const povId = activeChapter?.strategy?.povCharacterId;
  
  const characters = (scope !== TransmissionScope.CHAPTER) 
    ? bible.characters
      .filter(c => !c.isPrivate) // 秘匿設定を尊重
      .map(c => {
        const isPov = c.id === povId || c.name === povId;
        const isInvolved = involvedCharIds.has(c.id);
        
        if (isPov) {
          return `[POV] ${c.name}: ${c.description} (動機: ${c.motivation}, 葛藤: ${c.status.internalState})`;
        } else if (isInvolved || scope === TransmissionScope.FULL) {
          return `${c.name}: ${c.description.slice(0, scope === TransmissionScope.FULL ? 300 : 100)}`;
        }
        return null;
      }).filter(Boolean).join('\n')
    : "";

  // 4. ストーリーの軌道
  const trajectory = (scope === TransmissionScope.FULL || scope === TransmissionScope.SUMMARY)
    ? (bible.summaryBuffer ? `[Summary Buffer]\n${bible.summaryBuffer}` : `[Grand Arc]\n${bible.grandArc.slice(0, 500)}`)
    : "";

  // 5. ローカル・マイルストーン
  const currentChapterContext = activeChapter ? `
[Current Scene: ${activeChapter.title}]
Synopsis: ${activeChapter.summary}
Milestones: ${activeChapter.strategy?.milestones?.join(', ') || 'None'}
`.trim() : "";

  return `
--- Foundation ---
Title: ${project.meta.title} (${project.meta.genre})
Tone: ${bible.tone}
${laws}

--- Trajectory & Threads ---
${trajectory}
${openForeshadowing ? `Open Threads:\n${openForeshadowing}` : ""}

--- Active Entities ---
${characters}

--- Local Context ---
${currentChapterContext}
`.trim();
};

export const resolveModelConfig = (task: string, complexity: TaskComplexity = 'basic'): ModelRequestConfig => {
  switch (task) {
    case 'CHAT': return { model: AiModel.REASONING, thinkingBudget: complexity === 'complex' ? 12000 : 4000 };
    case 'DRAFT': return { model: complexity === 'creative' ? AiModel.REASONING : AiModel.FAST, thinkingBudget: complexity === 'creative' ? 24000 : 0 };
    case 'SIM': return { model: AiModel.REASONING, thinkingBudget: 20000 };
    case 'SCAN': return { model: AiModel.REASONING, thinkingBudget: 32768 };
    case 'IMAGE': return { model: AiModel.IMAGE };
    case 'TTS': return { model: AiModel.TTS };
    default: return { model: AiModel.FAST };
  }
};
