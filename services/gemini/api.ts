
import { StoryProject, ChapterLog, GeminiContent, UsageCallback, LogCallback, DetectionResult, ExtractionResult, BibleIssue, NexusBranch, WhisperAdvice, SyncOperation } from "../../types";
import { ArchitectAgent } from "./agents/Architect";
import { WriterAgent } from "./agents/Writer";
import { VisualAgent } from "./agents/Visual";
import { AnalysisAgent } from "./agents/Analysis";
import { LibrarianAgent } from "./agents/Librarian";
import { validateSyncOperation, findMatchCandidates } from "../bibleManager";
import { safeJsonParse } from "./utils";

/**
 * DuoScript Gemini Service - Refactored Agent Gateways
 */

const getAgents = (onUsage?: UsageCallback, logCb: LogCallback = () => {}) => ({
  architect: new ArchitectAgent(onUsage, logCb),
  writer: new WriterAgent(onUsage, logCb),
  visual: new VisualAgent(onUsage, logCb),
  analysis: new AnalysisAgent(onUsage, logCb),
  librarian: new LibrarianAgent(onUsage, logCb)
});

// --- Librarian ---
export const identifyRelevantEntities = (text: string, project: StoryProject, onUsage: UsageCallback, logCb: LogCallback) => 
  getAgents(onUsage, logCb).librarian.identifyRelevantEntities(text, project);

// --- Architect ---
export const chatWithArchitect = (history: GeminiContent[], input: string, project: StoryProject, memory: string, allowSearch: boolean, focus: any, onUsage: UsageCallback, logCb: LogCallback) =>
  getAgents(onUsage, logCb).architect.chat(history, input, project, memory, allowSearch);

// Updated chatWithArchitectStream to accept 8 arguments (adding isContextActive)
export const chatWithArchitectStream = (history: GeminiContent[], input: string, project: StoryProject, memory: string, allowSearch: boolean, onUsage: UsageCallback, logCb: LogCallback, isContextActive: boolean = true) =>
  getAgents(onUsage, logCb).architect.chatStream(history, input, project, memory, allowSearch, isContextActive);

export const summarizeConversation = (memory: string, messages: GeminiContent[], onUsage: UsageCallback, logCb: LogCallback) =>
  getAgents(onUsage, logCb).architect.summarize(memory, messages);

export const detectSettingChange = (input: string, onUsage: UsageCallback, logCb: LogCallback) =>
  getAgents(onUsage, logCb).architect.detectIntent(input);

export const extractSettingsFromChat = (history: GeminiContent[], project: StoryProject, memory: string, detection: DetectionResult, onUsage: UsageCallback, logCb: LogCallback) =>
  getAgents(onUsage, logCb).architect.extractSyncOps(history, project, memory, detection, (json) => processSyncOperations(json, 'Extractor', project, detection.isHypothetical));

export const getArchitectWhisper = (chunk: string, project: StoryProject, activeChapterId: string, onUsage: UsageCallback, logCb: LogCallback) =>
  getAgents(onUsage, logCb).architect.whisper(chunk, project, activeChapterId);

export const genesisFill = (project: StoryProject, currentProfile: any, fieldLabel: string, onUsage: UsageCallback, logCb: LogCallback) =>
  getAgents(onUsage, logCb).architect.genesisFill(project, currentProfile, fieldLabel);

// --- Writer ---
export const generateDraftStream = (chapter: ChapterLog, tone: string, usePro: boolean, project: StoryProject, logCb: LogCallback) =>
  getAgents(undefined, logCb).writer.streamDraft(chapter, tone, usePro, project);

export const suggestNextSentence = (content: string, project: StoryProject, activeChapterId: string, onUsage: UsageCallback, logCb: LogCallback) =>
  getAgents(onUsage, logCb).writer.suggest(content, project, activeChapterId);

export const scanDraftAppSettings = (draft: string, project: StoryProject, activeChapterId: string, onUsage: UsageCallback, logCb: LogCallback) =>
  getAgents(onUsage, logCb).writer.scanDraft(draft, project, activeChapterId, (json) => processSyncOperations(json, 'DraftScanner', project, false));

export const generateFullChapterPackage = (project: StoryProject, chapter: ChapterLog, onUsage: UsageCallback, logCb: LogCallback) =>
  getAgents(onUsage, logCb).writer.generatePackage(project, chapter);

// --- Visual & Analysis ---
export const generateCharacterPortrait = (character: any, project: StoryProject, onUsage: UsageCallback, logCb: LogCallback) =>
  getAgents(onUsage, logCb).visual.generatePortrait(character, project);

export const generateSpeech = (text: string, voiceName: string, onUsage: UsageCallback, logCb: LogCallback) =>
  getAgents(onUsage, logCb).visual.synthesizeSpeech(text, voiceName);

export const analyzeBibleIntegrity = (project: StoryProject, onUsage: UsageCallback, logCb: LogCallback) =>
  getAgents(onUsage, logCb).analysis.scanIntegrity(project);

export const simulateBranch = (hyp: string, project: StoryProject, onUsage: UsageCallback, logCb: LogCallback) =>
  getAgents(onUsage, logCb).analysis.simulateNexus(hyp, project);

export const generateRandomProject = (theme: string, logCb: LogCallback) =>
  getAgents(undefined, logCb).analysis.generateProject(theme);

/**
 * FIXED: Passed logCb as the required third argument to getSafetyAlternatives
 */
export const getSafetyAlternatives = (input: string, category: string, logCb: LogCallback) =>
  getAgents(undefined, logCb).analysis.getSafetyAlternatives(input, category, logCb);

export const maintainSummaryBuffer = (project: { bible: any }, onUsage: UsageCallback, logCb: LogCallback) =>
  getAgents(onUsage, logCb).analysis.simulateNexus("要約バッファを維持せよ", project as any).then(res => res.impactOnCanon);

// --- Shared Internal Process ---
function processSyncOperations(jsonText: string | undefined, source: string, project: StoryProject, isHypothetical: boolean): ExtractionResult {
  const rawOps = safeJsonParse<any[]>(jsonText || "[]", source).value || [];
  const readyOps: SyncOperation[] = []; 
  const quarantineItems: any[] = [];
  
  const requestId = crypto.randomUUID();

  rawOps.forEach(raw => {
    const op: SyncOperation = {
      id: crypto.randomUUID(),
      requestId: requestId,
      op: raw.op || 'update',
      path: raw.path,
      targetId: raw.targetId,
      targetName: raw.targetName,
      field: raw.field,
      value: raw.value,
      rationale: raw.rationale || "対話に基づく自動更新",
      evidence: raw.evidence || source,
      confidence: typeof raw.confidence === 'number' ? raw.confidence : 0.9,
      status: 'proposal',
      baseVersion: project.bible.version,
      timestamp: Date.now(),
      isHypothetical: isHypothetical
    } as any;

    const errors = validateSyncOperation(op);
    if (errors.length > 0 || !op.path) {
      quarantineItems.push({ 
        id: crypto.randomUUID(), 
        timestamp: Date.now(), 
        rawText: JSON.stringify(raw), 
        error: errors.join(", ") || "無効なパス", 
        stage: 'SCHEMA', 
        partialOp: raw 
      });
      return;
    }

    // マッチングロジック
    const list = op.path === 'chapters' ? project.chapters : (project.bible as any)[op.path];
    if (Array.isArray(list)) {
      if (op.op === 'add') {
        // 新規追加(add)の場合は、既存項目への自動紐付けを避ける。
        // 同じ名前のものがある可能性を提示するため候補(candidates)のみ取得する。
        const cands = findMatchCandidates(list, op.targetId, op.targetName);
        if (cands.length > 0 && cands[0].confidence >= 0.98) {
          // 意図的な重複の可能性もあるため、ここでは targetId はセットせず status も proposal のままにする
        }
      } else {
        const cands = findMatchCandidates(list, op.targetId, op.targetName);
        if (cands.length > 0 && cands[0].confidence >= 0.95) {
          op.targetId = cands[0].id;
          op.targetName = cands[0].name;
        } else {
          op.status = 'needs_resolution';
          op.candidates = cands;
        }
      }
    }
    
    readyOps.push(op);
  });
  
  return { readyOps, quarantineItems };
}
