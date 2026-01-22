
import { StoryProject, ChapterLog, GeminiContent, UsageCallback, LogCallback, DetectionResult, ExtractionResult, BibleIssue, NexusBranch, WhisperAdvice, SyncOperation } from "../../types";
import { ArchitectAgent } from "./agents/Architect";
import { DetectorAgent } from "./agents/Detector";
import { ExtractorAgent } from "./agents/Extractor";
import { MemoryAgent } from "./agents/Memory";
import { CreatorAgent } from "./agents/Creator";
import { AdvisorAgent } from "./agents/Advisor";
import { WriterAgent } from "./agents/Writer";
import { VisualAgent } from "./agents/Visual";
import { AnalysisAgent } from "./agents/Analysis";
import { LibrarianAgent } from "./agents/Librarian";
import { processSyncOperations } from "./responseProcessor";
import { GeminiClient } from "./core";

/**
 * DuoScript Gemini Service - Dependency Composition Root
 */

// Initialize the client. In a real DI container, this would be provided via Context.
// For now, we use the environment variable as per spec.
const client = new GeminiClient(process.env.API_KEY || "");

// Instantiate Agents with injected client
const architectAgent = new ArchitectAgent(client);
const detectorAgent = new DetectorAgent(client);
const extractorAgent = new ExtractorAgent(client);
const memoryAgent = new MemoryAgent(client);
const creatorAgent = new CreatorAgent(client);
const advisorAgent = new AdvisorAgent(client);
const writerAgent = new WriterAgent(client);
const visualAgent = new VisualAgent(client);
const analysisAgent = new AnalysisAgent(client);
const librarianAgent = new LibrarianAgent(client);

// --- Librarian ---
export const identifyRelevantEntities = (text: string, project: StoryProject, onUsage: UsageCallback, logCb: LogCallback) => 
  librarianAgent.identifyRelevantEntities(text, project, onUsage, logCb);

// --- Architect (Chat) ---
export const chatWithArchitect = (
  history: GeminiContent[], 
  input: string, 
  project: StoryProject, 
  memory: string, 
  allowSearch: boolean, 
  focus: any, 
  onUsage: UsageCallback, 
  logCb: LogCallback,
  isContextActive: boolean = true,
  relevantIds?: string[]
) =>
  architectAgent.chat(history, input, project, memory, allowSearch, onUsage, logCb, isContextActive, relevantIds);

export const chatWithArchitectStream = (
  history: GeminiContent[], 
  input: string, 
  project: StoryProject, 
  memory: string, 
  allowSearch: boolean, 
  onUsage: UsageCallback, 
  logCb: LogCallback, 
  isContextActive: boolean = true,
  relevantIds?: string[]
) =>
  architectAgent.chatStream(history, input, project, memory, allowSearch, onUsage, logCb, isContextActive, relevantIds);

// --- Architect (Memory & Detection & Extraction) ---
export const summarizeConversation = (memory: string, messages: GeminiContent[], onUsage: UsageCallback, logCb: LogCallback) =>
  memoryAgent.summarize(memory, messages, onUsage, logCb);

export const detectSettingChange = (input: string, onUsage: UsageCallback, logCb: LogCallback) =>
  detectorAgent.detectIntent(input, onUsage, logCb);

export const extractSettingsFromChat = (history: GeminiContent[], project: StoryProject, memory: string, detection: DetectionResult, onUsage: UsageCallback, logCb: LogCallback) =>
  extractorAgent.extractSyncOps(history, project, memory, detection, (json) => processSyncOperations(json, 'Extractor', project, detection.isHypothetical), onUsage, logCb);

// --- Architect (Advisor & Creator) ---
export const getArchitectWhisper = (chunk: string, project: StoryProject, activeChapterId: string, onUsage: UsageCallback, logCb: LogCallback) =>
  advisorAgent.whisper(chunk, project, activeChapterId, onUsage, logCb);

export const genesisFill = (project: StoryProject, currentProfile: any, fieldLabel: string, onUsage: UsageCallback, logCb: LogCallback) =>
  creatorAgent.genesisFill(project, currentProfile, fieldLabel, onUsage, logCb);

export const autoFillItem = (project: StoryProject, itemType: string, itemName: string, fieldLabel: string, currentItem: any, onUsage: UsageCallback, logCb: LogCallback) =>
  creatorAgent.autoFillItem(project, itemType, itemName, fieldLabel, currentItem, onUsage, logCb);

export const brainstormItem = (project: StoryProject, itemType: string, itemName: string | undefined, currentItem: any, fieldHints: string, onUsage: UsageCallback, logCb: LogCallback) =>
  creatorAgent.brainstorm(project, itemType, itemName, currentItem, fieldHints, onUsage, logCb);

// --- Writer ---
export const generateDraftStream = (
  chapter: ChapterLog, 
  tone: string, 
  usePro: boolean, 
  project: StoryProject, 
  previousContent: string,
  targetBeats: string[] | undefined,
  logCb: LogCallback,
  isContextActive: boolean = true,
  onUsage?: UsageCallback
) =>
  writerAgent.streamDraft(chapter, tone, usePro, project, previousContent, targetBeats, logCb, isContextActive, onUsage);

export const suggestNextSentence = (content: string, project: StoryProject, activeChapterId: string, onUsage: UsageCallback, logCb: LogCallback, isContextActive: boolean = true) =>
  writerAgent.suggest(content, project, activeChapterId, isContextActive, onUsage, logCb);

export const scanDraftAppSettings = (draft: string, project: StoryProject, activeChapterId: string, onUsage: UsageCallback, logCb: LogCallback) =>
  writerAgent.scanDraft(draft, project, activeChapterId, (json) => processSyncOperations(json, 'DraftScanner', project, false), onUsage, logCb);

export const generateFullChapterPackage = (project: StoryProject, chapter: ChapterLog, onUsage: UsageCallback, logCb: LogCallback) =>
  writerAgent.generatePackage(project, chapter, onUsage, logCb);

// --- Visual & Analysis ---
export const generateCharacterPortrait = (character: any, project: StoryProject, onUsage: UsageCallback, logCb: LogCallback) =>
  visualAgent.generatePortrait(character, project, onUsage, logCb);

export const generateSpeech = (text: string, voiceName: string, onUsage: UsageCallback, logCb: LogCallback) =>
  visualAgent.synthesizeSpeech(text, voiceName, onUsage, logCb);

export const analyzeBibleIntegrity = (project: StoryProject, onUsage: UsageCallback, logCb: LogCallback) =>
  analysisAgent.scanIntegrity(project, onUsage, logCb);

export const simulateBranch = (hyp: string, project: StoryProject, onUsage: UsageCallback, logCb: LogCallback) =>
  analysisAgent.simulateNexus(hyp, project, onUsage, logCb);

export const generateRandomProject = (theme: string, onUsage: UsageCallback, logCb: LogCallback) =>
  analysisAgent.generateProject(theme, onUsage, logCb);

export const getSafetyAlternatives = (input: string, category: string, logCb: LogCallback) =>
  analysisAgent.getSafetyAlternatives(input, category, logCb);

export const maintainSummaryBuffer = (project: { bible: any }, onUsage: UsageCallback, logCb: LogCallback) =>
  analysisAgent.simulateNexus("要約バッファを維持せよ", project as any, onUsage, logCb).then(res => res.impactOnCanon);
