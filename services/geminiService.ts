
/**
 * DuoScript Gemini Service
 * 
 * This module acts as an aggregator for the split Gemini service components.
 */

export * from './gemini/api';
export * from './gemini/utils';
export * from './gemini/schemas';

// 追加のラップ関数（APIコンポーネントで定義されているが、Writer系のストリームをここで微調整する場合）
import { WriterAgent } from './gemini/agents/Writer';
import { StoryProject, ChapterLog, LogCallback } from '../types';

export const generateDraftStream = (chapter: ChapterLog, tone: string, usePro: boolean, project: StoryProject, logCb: LogCallback, isContextActive: boolean = true) =>
  new WriterAgent(undefined, logCb).streamDraft(chapter, tone, usePro, project, isContextActive);

export const suggestNextSentence = (content: string, project: StoryProject, activeChapterId: string, onUsage: any, logCb: LogCallback, isContextActive: boolean = true) =>
  new WriterAgent(onUsage, logCb).suggest(content, project, activeChapterId, isContextActive);
