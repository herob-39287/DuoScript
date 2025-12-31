

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

  // 簡易的な閉じ括弧補完
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
      // 修復を試みる
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
        // Exponential backoff
        const delay = Math.pow(2, i) * 1000 + Math.random() * 500;
        await new Promise(resolve => setTimeout(resolve, delay));
        if (i === 1) logCallback('info', source as any, "混雑のためリトライしています...");
        continue;
      }
      throw error; // 他のエラーは即座にスロー
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

export function resolveModelConfig(
  baseModel: string, 
  complexity: TaskComplexity, 
  userParams?: ModelRequestConfig
) {
  return {
    model: baseModel,
    ...userParams
  };
}

/**
 * フォーマットヘルパー: キャラクター情報を詳細レベルに応じて整形
 */
function formatCharacter(c: Character, bible: any, level: 'DETAILED' | 'SUMMARY'): string {
  const p = c.profile;
  const s = c.state;
  
  const base = `### ${p.name} [${p.role}]`;

  if (level === 'DETAILED') {
    const voice = `Voice: {1st:"${p.voice.firstPerson}", 2nd:"${p.voice.secondPerson}", Tone:"${p.voice.speechStyle}"}`;
    const locationName = bible.locations.find((l:any) => l.id === s.location)?.name || s.location;
    
    // Inventory
    const inventory = bible.keyItems
        .filter((i:any) => i.currentOwnerId === c.id)
        .map((i:any) => i.name);
    const invStr = inventory.length > 0 ? `Inventory: [${inventory.join(', ')}]` : "Inventory: (None)";

    // Relationships
    const rels = c.relationships.map(r => {
        const targetName = bible.characters.find((tc:any) => tc.id === r.targetId)?.profile.name || "Unknown";
        return `${targetName}(${r.type}, ${r.strength > 0 ? '+' : ''}${r.strength})`;
    }).join(', ');

    return `${base}
- [STATIC] Profile: ${p.description}
  Appearance: ${p.appearance}
  Personality: ${p.personality}
  Traits: ${p.traits.join(', ')} | Motivation: ${p.motivation} | Flaw: ${p.flaw}
  ${voice}
- [DYNAMIC] State:
  Current Location: ${locationName}
  Internal State: ${s.internalState}
  Current Goal: ${s.currentGoal}
  Health: ${s.health}
  ${invStr}
  Relationships: {${rels}}`;
  } else {
    return `* ${p.name} [${p.role}]: ${p.description.slice(0, 100)}... (At: ${s.location}, Mood: ${s.internalState})`;
  }
}

/**
 * テキスト内に対象のキーワードが含まれているか判定
 */
function isMentioned(text: string, keywords: string[]): boolean {
  if (!text) return false;
  const normalizedText = text.toLowerCase();
  return keywords.some(k => k && normalizedText.includes(k.toLowerCase()));
}

/**
 * Tier 1: Global Context (Always included)
 */
function getGlobalContext(project: StoryProject): string {
  const { bible } = project;
  const laws = bible.laws.map(l => `- [LAW: ${l.name}] (${l.type}/${l.importance}): ${l.description}`).join('\n');
  const tone = bible.tone ? `Tone: ${bible.tone}` : "";
  
  return [
    `Title: ${project.meta.title}`,
    `Genre: ${project.meta.genre}`,
    tone,
    `Setting: ${bible.setting}`,
    `Grand Arc: ${bible.grandArc}`,
    `=== CANON LAWS (ABSOLUTE PHYSICS/RULES) ===\n${laws}`
  ].filter(Boolean).join('\n');
}

/**
 * Tier 2: Task-Specific Context Builders
 */
function getCharactersContext(project: StoryProject, activeChapterId?: string, revealSecrets: boolean = false): string {
  const { bible, chapters } = project;
  const activeChapter = activeChapterId ? chapters.find(c => c.id === activeChapterId) : null;
  const chapterTextContext = activeChapter ? (activeChapter.title + " " + activeChapter.summary) : "";

  // 全キャラクターを詳細モードで出力
  const chars = bible.characters
    .filter(c => revealSecrets || !c.isPrivate || (activeChapter?.involvedCharacterIds?.includes(c.id) || false))
    .map(c => formatCharacter(c, bible, 'DETAILED'))
    .join('\n\n');

  return `=== ENTITIES: FULL CHARACTER PROFILES ===\n${chars}`;
}

function getWorldContext(project: StoryProject, revealSecrets: boolean = false): string {
  const { bible } = project;
  
  const entries = bible.entries
    .filter(e => revealSecrets || !e.isSecret)
    .map(e => `- ${e.isSecret ? '[SECRET] ' : ''}${e.title} (${e.category}): ${e.definition}`)
    .join('\n');

  const locations = bible.locations.map(l => {
     const conns = (l.connections || []).map(c => {
       const tName = bible.locations.find(tl => tl.id === c.targetLocationId)?.name || 'Unknown';
       return `${tName}(${c.method}, ${c.travelTime})`;
     }).join(', ');
     return `- [Location] ${l.name}: ${l.description} [Connects: ${conns}]`;
  }).join('\n');

  const orgs = bible.organizations.map(o => `- [Org] ${o.name} (${o.type}): ${o.description}`).join('\n');
  
  const items = bible.keyItems.map(i => {
    const owner = bible.characters.find(c => c.id === i.currentOwnerId)?.profile.name || "None";
    return `- [Artifact] ${i.name}: ${i.description} (Owner: ${owner})`;
  }).join('\n');

  return [
    "=== WORLD ENTITIES: LORE & GEOGRAPHY ===",
    locations,
    orgs,
    items,
    "=== ENCYCLOPEDIA ===",
    entries
  ].join('\n\n');
}

function getPlotContext(project: StoryProject): string {
  const { bible } = project;
  
  const structure = bible.storyStructure.map(s => `[${s.name}: ${s.summary}]`).join(' -> ');
  const threads = bible.storyThreads.map(t => `- Thread[${t.title}] (${t.status})`).join('\n');
  
  const timeline = bible.timeline.map(t => {
     return `[${t.timeLabel}] ${t.event} (${t.status})`;
  }).join('\n');

  const foreshadowing = bible.foreshadowing.map(f => {
     return `- [Foreshadowing] ${f.title} (${f.status}): ${f.description}`;
  }).join('\n');

  return [
    "=== NARRATIVE STRUCTURE ===",
    structure,
    threads,
    "=== TIMELINE & FORESHADOWING ===",
    timeline,
    foreshadowing
  ].join('\n\n');
}

/**
 * AUTO Mode (Heuristic Selection) - Existing Logic Optimized
 */
function getAutoContext(project: StoryProject, activeChapterId?: string, revealSecrets: boolean = false): string {
  const { bible, chapters } = project;
  const activeChapter = activeChapterId ? chapters.find(c => c.id === activeChapterId) : null;
  const chapterTextContext = activeChapter 
    ? (activeChapter.title + " " + activeChapter.summary + " " + activeChapter.beats.map(b => b.text).join(" ")) 
    : "";

  // Trajectory
  const structure = bible.storyStructure.map(s => `[${s.name}]`).join(' -> ');
  const threads = bible.storyThreads
    .filter(t => t.status !== 'Resolved' || isMentioned(chapterTextContext, [t.title]))
    .slice(0, 5)
    .map(t => `- Thread[${t.title}] (${t.status})`)
    .join('\n');

  // Entities Scoring
  const getEntityScore = (id: string, names: string[], role: string = '', isExplicitlyInvolved: boolean = false) => {
    let score = 0;
    if (isExplicitlyInvolved) score += 100;
    if (isMentioned(chapterTextContext, names)) score += 50;
    if (role === 'Protagonist') score += 30;
    if (role === 'Antagonist') score += 20;
    if (role === 'Supporting') score += 10;
    return score;
  };

  const scoredChars = bible.characters
    .filter(c => revealSecrets || !c.isPrivate || (activeChapter?.involvedCharacterIds?.includes(c.id) || false))
    .map(c => ({
      char: c,
      score: getEntityScore(c.id, [c.profile.name, ...(c.profile.aliases || [])], c.profile.role, activeChapter?.involvedCharacterIds?.includes(c.id) || false)
    }))
    .sort((a, b) => b.score - a.score);

  const detailedChars = scoredChars.filter(i => i.score >= 30).slice(0, 6);
  const summaryChars = scoredChars.filter(i => i.score < 30 && i.score >= 10).slice(0, 10);

  const activeCharsText = detailedChars.map(i => formatCharacter(i.char, bible, 'DETAILED')).join('\n\n');
  const backgroundCharsText = summaryChars.map(i => formatCharacter(i.char, bible, 'SUMMARY')).join('\n');

  const scoredEntries = bible.entries
    .filter(e => revealSecrets || !e.isSecret)
    .map(e => ({
      entry: e,
      score: getEntityScore(e.id, [e.title, ...(e.aliases || [])])
    }))
    .filter(i => i.score > 0 || revealSecrets)
    .sort((a, b) => b.score - a.score)
    .slice(0, revealSecrets ? 20 : 8);

  const entriesText = scoredEntries.map(i => `- ${i.entry.isSecret ? '[SECRET] ' : ''}${i.entry.title} (${i.entry.category}): ${i.entry.definition}`).join('\n');

  return [
    `=== TRAJECTORY ===\nStructure: ${structure}\nActive Threads:\n${threads}`,
    "=== ACTIVE CAST (Detailed) ===",
    activeCharsText,
    "=== SUPPORTING CAST (Summary) ===",
    backgroundCharsText,
    "=== RELEVANT CONTEXT ===",
    entriesText
  ].join('\n\n');
}

/**
 * 2.5: コンテキスト圧縮・最適化ロジック (Refined with Tiering)
 * 
 * Tier 1: Global Context (Always)
 * Tier 2: Task-Specific Context (Based on focus)
 * Tier 3: Local Context (Active Chapter)
 */
export function getCompressedContext(
  project: StoryProject, 
  activeChapterId?: string, 
  revealSecrets: boolean = false, 
  focus: ContextFocus = 'AUTO'
): string {
  // Tier 1
  const global = getGlobalContext(project);

  // Tier 2
  let tier2 = "";
  switch (focus) {
    case 'CHARACTERS':
      tier2 = getCharactersContext(project, activeChapterId, revealSecrets);
      break;
    case 'WORLD':
      tier2 = getWorldContext(project, revealSecrets);
      break;
    case 'PLOT':
      tier2 = getPlotContext(project);
      break;
    case 'AUTO':
    default:
      tier2 = getAutoContext(project, activeChapterId, revealSecrets);
      break;
  }

  // Tier 3
  let local = "";
  const activeChapter = activeChapterId ? project.chapters.find(c => c.id === activeChapterId) : null;
  if (activeChapter) {
    const beats = activeChapter.beats.map((b, i) => `${i+1}. ${b.text}`).join('\n');
    local = `
=== CURRENT CHAPTER FOCUS ===
Title: ${activeChapter.title}
Summary: ${activeChapter.summary}
Plot Beats:
${beats}
Strategy: Pacing=${activeChapter.strategy.pacing}, Arc=${activeChapter.strategy.characterArcProgress}
`.trim();
  }

  return `
${global}

${tier2}

${local}
`.trim();
}