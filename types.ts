
export * from './types/project';
export * from './types/bible';
export * from './types/sync';
export * from './types/ui';

export enum AiModel {
  REASONING = 'gemini-3-pro-preview',
  FAST = 'gemini-3-flash-preview',
  IMAGE = 'gemini-2.5-flash-image',
  TTS = 'gemini-2.5-flash-preview-tts',
}
