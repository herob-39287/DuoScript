/**
 * DuoScript Application Constants
 */

// Gemini Model Definitions
export const AI_MODELS = {
  // Complex Text Tasks (e.g., advanced reasoning, coding, math, and STEM)
  REASONING: 'gemini-3-pro-preview',
  // Basic Text Tasks (e.g., summarization, proofreading, and simple Q&A)
  FAST: 'gemini-3-flash-preview',
  // General Image Generation and Editing Tasks
  IMAGE: 'gemini-2.5-flash-image',
  // Text-to-speech tasks
  TTS: 'gemini-2.5-flash-preview-tts',
  // Embedding
  EMBEDDING: 'text-embedding-004',
} as const;

// AiModel Type compatible with legacy code
export const AiModel = {
  REASONING: AI_MODELS.REASONING,
  FAST: AI_MODELS.FAST,
  IMAGE: AI_MODELS.IMAGE,
  TTS: AI_MODELS.TTS,
} as const;

export type AiModel = (typeof AiModel)[keyof typeof AiModel];

// Token Limits & Budgets
export const TOKEN_LIMITS = {
  // Output token limits
  GENESIS_BIBLE: 65536,
  CHAPTER_DRAFT: 32768,
  DEFAULT_OUTPUT: 32768,
  SMALL_OUTPUT: 2048,

  // Thinking budgets (Only for Gemini 3 / 2.5 series)
  THINKING_HEAVY: 8192, // For complex generation (Muse Bible)
  THINKING_MEDIUM: 4096, // For detailed plotting/reasoning (Architect Chat, Muse Chapters)
  THINKING_LIGHT: 2048, // For brainstorming/extraction
  THINKING_MINIMAL: 1024, // Minimal overhead
  THINKING_FLASH_LIMIT: 16000, // Flash model thinking budget limit (Note: Flash support for thinking varies)
} as const;

// Path Constants for Neural Sync
export const SYNC_PATHS = {
  CHARACTERS: 'characters',
  LAWS: 'laws',
  LOCATIONS: 'locations',
  ORGANIZATIONS: 'organizations',
  ITEMS: 'keyItems',
  ENTRIES: 'entries',
  TIMELINE: 'timeline',
  FORESHADOWING: 'foreshadowing',
  THREADS: 'storyThreads',
  STRUCTURE: 'storyStructure',
  CHAPTERS: 'chapters',
  GRAND_ARC: 'grandArc',
  SETTING: 'setting',
  TONE: 'tone',
} as const;

// UI Constants
export const UI_CONSTANTS = {
  SCROLL_THRESHOLD: 100,
  MOBILE_BREAKPOINT: 768,
  DRAWER_WIDTH: 320,
} as const;
