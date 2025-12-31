import { StoryProject, ChapterLog, GeminiContent, UsageCallback, LogCallback, DetectionResult, ExtractionResult, BibleIssue, NexusBranch, WhisperAdvice, SyncOperation } from "../../types";
import { ArchitectAgent } from "./agents/Architect";
import { WriterAgent } from "./agents/Writer";
import { VisualAgent } from "./agents/Visual";
import { AnalysisAgent } from "./agents/Analysis";
import { LibrarianAgent } from "./agents/Librarian";
import { validateSyncOperation, findMatchCandidates } from "../bibleManager";

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

export const summarizeConversation = (memory: string, messages: GeminiContent[], onUsage: UsageCallback, logCb: LogCallback) =>
  getAgents(onUsage, logCb).architect.summarize(memory, messages);

export const detectSettingChange = (input: string, onUsage: UsageCallback, logCb: LogCallback) =>
  getAgents(onUsage, logCb).architect.detectIntent(input);

export const extractSettingsFromChat = (history: GeminiContent[], project: StoryProject, memory: string, detection: DetectionResult, onUsage: UsageCallback, logCb: LogCallback) =>
  getAgents(onUsage, logCb).architect.extractSyncOps(history, project, memory, detection, (json) => processSyncOperations(json, 'Extractor', project, detection.isHypothetical));

export const getArchitectWhisper = (chunk: string, project: StoryProject, activeChapterId: string, onUsage: UsageCallback, logCb: LogCallback) =>
  getAgents(onUsage, logCb).architect.whisper(chunk, project, activeChapterId);

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

export const getSafetyAlternatives = (input: string, category: string, logCb: LogCallback) =>
  getAgents(undefined, logCb).analysis.getSafetyAlternatives(input, category);

export const maintainSummaryBuffer = (project: { bible: any }, onUsage: UsageCallback, logCb: LogCallback) =>
  getAgents(onUsage, logCb).analysis.simulateNexus("要約バッファを維持せよ", project as any).then(res => res.impactOnCanon);

// --- Shared Internal Process ---
import { safeJsonParse } from "./utils";
function processSyncOperations(jsonText: string | undefined, source: string, project: StoryProject, isHypothetical: boolean): ExtractionResult {
  const ops = safeJsonParse<SyncOperation[]>(jsonText || "[]", source).value || [];
  const readyOps: any[] = []; const quarantineItems: any[] = [];
  ops.forEach(op => {
    const errors = validateSyncOperation(op);
    if (errors.length > 0) { quarantineItems.push({ id: crypto.randomUUID(), timestamp: Date.now(), rawText: JSON.stringify(op), error: errors.join(", "), stage: 'SCHEMA', partialOp: op }); return; }
    const list = op.path === 'chapters' ? project.chapters : (project.bible as any)[op.path];
    if (Array.isArray(list)) {
      const cands = findMatchCandidates(list, op.targetId, op.targetName);
      if (cands.length > 0 && cands[0].confidence >= 0.95) { op.targetId = cands[0].id; op.targetName = cands[0].name; op.status = 'proposal'; }
      else if (op.op !== 'add') { op.status = 'needs_resolution'; op.candidates = cands; }
    }
    op.id = crypto.randomUUID(); op.timestamp = Date.now(); op.isHypothetical = isHypothetical;
    readyOps.push(op);
  });
  return { readyOps, quarantineItems };
}