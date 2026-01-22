
import { AiPersona } from "../../../types";

export const PERSONA_INSTRUCTIONS: Record<AiPersona, { ja: string, en: string }> = {
  [AiPersona.STANDARD]: {
    ja: "あなたは知的な伴走者として、作家のアイデアを広げ、設定の整合性を守る存在です。バランスの取れた視点で提案を行います。",
    en: "You are an intelligent companion who expands the writer's ideas and maintains the consistency of the setting. You provide balanced proposals."
  },
  [AiPersona.STRICT]: {
    ja: "あなたは厳格な編集者です。論理的な矛盾や設定の甘さを鋭く指摘し、作品の品質を高めるために妥協しません。",
    en: "You are a strict editor. You sharply point out logical contradictions and weak settings, refusing to compromise to improve the quality of the work."
  },
  [AiPersona.GENTLE]: {
    ja: "あなたは優しく受容的なミューズです。作家のどんな小さなアイデアも肯定し、モチベーションを高めることを最優先します。",
    en: "You are a gentle and receptive muse. You affirm even the smallest ideas of the writer and prioritize boosting motivation."
  },
  [AiPersona.CREATIVE]: {
    ja: "あなたは常識にとらわれないアイデアマンです。整合性よりも「面白さ」や「意外性」を重視し、突飛な展開を積極的に提案します。",
    en: "You are an unconventional idea generator. You prioritize 'fun' and 'surprise' over consistency, actively proposing wild developments."
  }
};

export const COMMON_JSON_RULE = `
# ABSOLUTE COMPLIANCE RULE:
- Your response MUST be valid JSON only.
- PROHIBITED: Conversational text, Markdown wrappers (json), and explanations.
`.trim();

export const STRICT_JSON_ENFORCEMENT = COMMON_JSON_RULE;

export interface PromptResource {
  core: {
    languageConstraint: string;
  };
  architect: {
    mtp: (personaText: string) => string;
    extractor: {
      entities: string;
      foundation: string;
      narrative: string;
      foreshadowing: string;
      sync: string;
    };
    summarization: (currentMemory: string) => string;
    whisperSoul: string;
    whisperPrompt: string;
    genesisFill: (fieldLabel: string, currentProfile: string, worldContext: string) => string;
    autoFill: (itemType: string, itemName: string, fieldLabel: string, currentItemJson: string, worldContext: string) => string;
    brainstorm: (itemType: string, taskDesc: string, currentJson: string, worldContext: string, fieldHints: string) => string;
  };
  writer: {
    mtp: (personaText: string) => string;
    copilotSoul: string;
    draft: (title: string, summary: string, beatsSection: string, prevContent: string, focusMode: boolean) => string;
    nextSentence: (content: string) => string;
    draftScan: (draft: string) => string;
    chapterPackage: (title: string, summary: string) => string;
  };
  analysis: {
    analystSoul: string;
    detectorSoul: string;
    detectorPrompt: (input: string) => string;
    integrityScan: (bibleData: string) => string;
    nexusSim: (hypothesis: string, context: string) => string;
    safetyAlternatives: (input: string) => string;
    muse: {
      bible: (theme: string) => string;
      chapters: (bibleJson: string) => string;
      foreshadowing: (bibleJson: string, chaptersJson: string) => string;
    };
  };
  librarian: {
    soul: string;
  };
  visual: {
    description: (name: string, tone: string) => string;
    portrait: (desc: string) => string;
  };
}
