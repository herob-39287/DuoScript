import {
  StoryProject,
  ChapterLog,
  GeminiContent,
  UsageCallback,
  LogCallback,
  DetectionResult,
  ExtractionResult,
  BibleIssue,
  NexusBranch,
  WhisperAdvice,
  SyncOperation,
  ScenePackage,
  CreatorContext,
  VisualContext,
} from '../../types';
import { ArchitectAgent } from './agents/Architect';
import { DetectorAgent } from './agents/Detector';
import { ExtractorAgent } from './agents/Extractor';
import { MemoryAgent } from './agents/Memory';
import { CreatorAgent } from './agents/Creator';
import { AdvisorAgent } from './agents/Advisor';
import { WriterAgent } from './agents/Writer';
import { VisualAgent } from './agents/Visual';
import { AnalysisAgent } from './agents/Analysis';
import { LibrarianAgent } from './agents/Librarian';
import { processSyncOperations } from './responseProcessor';
import { GeminiClient } from './core';
import { CacheManager } from './cacheManager';

/**
 * Gemini Service Container
 * Manages dependency injection for all agents.
 */
export class GeminiService {
  public architectAgent: ArchitectAgent;
  public detectorAgent: DetectorAgent;
  public extractorAgent: ExtractorAgent;
  public memoryAgent: MemoryAgent;
  public creatorAgent: CreatorAgent;
  public advisorAgent: AdvisorAgent;
  public writerAgent: WriterAgent;
  public visualAgent: VisualAgent;
  public analysisAgent: AnalysisAgent;
  public librarianAgent: LibrarianAgent;
  public cacheManager: CacheManager;

  constructor(apiKey: string) {
    const client = new GeminiClient(apiKey);

    // Initialize dependencies
    this.cacheManager = new CacheManager(client);

    // Initialize agents with injections
    this.architectAgent = new ArchitectAgent(client, this.cacheManager);
    this.detectorAgent = new DetectorAgent(client);
    this.extractorAgent = new ExtractorAgent(client);
    this.memoryAgent = new MemoryAgent(client);
    this.creatorAgent = new CreatorAgent(client);
    this.advisorAgent = new AdvisorAgent(client);
    this.writerAgent = new WriterAgent(client);
    this.visualAgent = new VisualAgent(client);
    this.analysisAgent = new AnalysisAgent(client);
    this.librarianAgent = new LibrarianAgent(client);
  }
}

// Default Service Instance (using Env Key)
// Ideally this should be provided via React Context, but for backward compatibility with hooks/utils:
const defaultService = new GeminiService(process.env.API_KEY || '');

// --- Facade Functions (Proxy to Default Service) ---

// --- Librarian ---
export const identifyRelevantEntities = (
  text: string,
  project: StoryProject,
  onUsage: UsageCallback,
  logCb: LogCallback,
) => defaultService.librarianAgent.identifyRelevantEntities(text, project, onUsage, logCb);

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
  relevantIds?: string[],
) =>
  defaultService.architectAgent.chat(
    history,
    input,
    project,
    memory,
    allowSearch,
    onUsage,
    logCb,
    isContextActive,
    relevantIds,
  );

export const chatWithArchitectStream = (
  history: GeminiContent[],
  input: string,
  project: StoryProject,
  memory: string,
  allowSearch: boolean,
  onUsage: UsageCallback,
  logCb: LogCallback,
  isContextActive: boolean = true,
  relevantIds?: string[],
) =>
  defaultService.architectAgent.chatStream(
    history,
    input,
    project,
    memory,
    allowSearch,
    onUsage,
    logCb,
    isContextActive,
    relevantIds,
  );

// --- Architect (Memory & Detection & Extraction) ---
export const summarizeConversation = (
  memory: string,
  messages: GeminiContent[],
  onUsage: UsageCallback,
  logCb: LogCallback,
) => defaultService.memoryAgent.summarize(memory, messages, onUsage, logCb);

export const detectSettingChange = (input: string, onUsage: UsageCallback, logCb: LogCallback) =>
  defaultService.detectorAgent.detectIntent(input, onUsage, logCb);

export const extractSettingsFromChat = (
  history: GeminiContent[],
  project: StoryProject,
  memory: string,
  detection: DetectionResult,
  onUsage: UsageCallback,
  logCb: LogCallback,
) =>
  defaultService.extractorAgent.extractSyncOps(
    history,
    project,
    memory,
    detection,
    (json) => processSyncOperations(json, 'Extractor', project, detection.isHypothetical),
    onUsage,
    logCb,
  );

// --- Architect (Advisor & Creator) ---
export const getArchitectWhisper = (
  chunk: string,
  project: StoryProject,
  activeChapterId: string,
  onUsage: UsageCallback,
  logCb: LogCallback,
) => defaultService.advisorAgent.whisper(chunk, project, activeChapterId, onUsage, logCb);

export const genesisFill = (
  context: CreatorContext,
  currentProfile: any,
  fieldLabel: string,
  onUsage: UsageCallback,
  logCb: LogCallback,
) => defaultService.creatorAgent.genesisFill(context, currentProfile, fieldLabel, onUsage, logCb);

export const autoFillItem = (
  context: CreatorContext,
  itemType: string,
  itemName: string,
  fieldLabel: string,
  currentItem: any,
  onUsage: UsageCallback,
  logCb: LogCallback,
) =>
  defaultService.creatorAgent.autoFillItem(
    context,
    itemType,
    itemName,
    fieldLabel,
    currentItem,
    onUsage,
    logCb,
  );

export const brainstormItem = (
  context: CreatorContext,
  itemType: string,
  itemName: string | undefined,
  currentItem: any,
  fieldHints: string,
  onUsage: UsageCallback,
  logCb: LogCallback,
) =>
  defaultService.creatorAgent.brainstorm(
    context,
    itemType,
    itemName,
    currentItem,
    fieldHints,
    onUsage,
    logCb,
  );

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
  onUsage?: UsageCallback,
) =>
  defaultService.writerAgent.streamDraft(
    chapter,
    tone,
    usePro,
    project,
    previousContent,
    targetBeats,
    logCb,
    isContextActive,
    onUsage,
  );

export const suggestNextSentence = (
  content: string,
  project: StoryProject,
  activeChapterId: string,
  onUsage: UsageCallback,
  logCb: LogCallback,
  isContextActive: boolean = true,
) =>
  defaultService.writerAgent.suggest(
    content,
    project,
    activeChapterId,
    isContextActive,
    onUsage,
    logCb,
  );

export const scanDraftAppSettings = (
  draft: string,
  project: StoryProject,
  activeChapterId: string,
  onUsage: UsageCallback,
  logCb: LogCallback,
) =>
  defaultService.writerAgent.scanDraft(
    draft,
    project,
    activeChapterId,
    (json) => processSyncOperations(json, 'DraftScanner', project, false),
    onUsage,
    logCb,
  );

export const generateFullChapterPackage = (
  project: StoryProject,
  chapter: ChapterLog,
  onUsage: UsageCallback,
  logCb: LogCallback,
) => defaultService.writerAgent.generatePackage(project, chapter, onUsage, logCb);

export const generateSharedSpineStage = (
  project: StoryProject,
  chapter: ChapterLog,
  onUsage: UsageCallback,
  logCb: LogCallback,
) => defaultService.writerAgent.generateSharedSpineStage(project, chapter, onUsage, logCb);

export const generateVariantStage = (
  project: StoryProject,
  chapter: ChapterLog,
  scenePackages: ScenePackage[],
  onUsage: UsageCallback,
  logCb: LogCallback,
) => defaultService.writerAgent.generateVariantStage(project, chapter, scenePackages as any, onUsage, logCb);

export const generateConvergenceStage = (
  project: StoryProject,
  chapter: ChapterLog,
  scenePackages: ScenePackage[],
  onUsage: UsageCallback,
  logCb: LogCallback,
) =>
  defaultService.writerAgent.generateConvergenceStage(
    project,
    chapter,
    scenePackages as any,
    onUsage,
    logCb,
  );

// --- Visual & Analysis ---
export const generateCharacterPortrait = (
  character: any,
  context: VisualContext,
  onUsage: UsageCallback,
  logCb: LogCallback,
) => defaultService.visualAgent.generatePortrait(character, context, onUsage, logCb);

export const generateSpeech = (
  text: string,
  voiceName: string,
  onUsage: UsageCallback,
  logCb: LogCallback,
) => defaultService.visualAgent.synthesizeSpeech(text, voiceName, onUsage, logCb);

export const analyzeBibleIntegrity = (
  project: StoryProject,
  onUsage: UsageCallback,
  logCb: LogCallback,
) => defaultService.analysisAgent.scanIntegrity(project, onUsage, logCb);

export const simulateBranch = (
  hyp: string,
  project: StoryProject,
  onUsage: UsageCallback,
  logCb: LogCallback,
) => defaultService.analysisAgent.simulateNexus(hyp, project, onUsage, logCb);

export const generateRandomProject = (theme: string, onUsage: UsageCallback, logCb: LogCallback) =>
  defaultService.analysisAgent.generateProject(theme, onUsage, logCb);

export const getSafetyAlternatives = (input: string, category: string, logCb: LogCallback) =>
  defaultService.analysisAgent.getSafetyAlternatives(input, category, logCb);

export const maintainSummaryBuffer = (
  project: { bible: any },
  onUsage: UsageCallback,
  logCb: LogCallback,
) =>
  defaultService.analysisAgent
    .simulateNexus('要約バッファを維持せよ', project as any, onUsage, logCb)
    .then((res) => res.impactOnCanon);
