
import { StoryProject, Character, GeminiContent, SyncState, AiPersona } from "../../types";
import { ChatMessage } from "../../types/sync";
import * as Prompts from "./prompts";

export class PromptBuilder {
  
  private static inject(template: string, replacements: Record<string, string>): string {
    let result = template;
    for (const [key, value] of Object.entries(replacements)) {
      result = result.replace(new RegExp(`{{${key}}}`, 'g'), value);
    }
    return result;
  }

  static buildCompressedHistory(sync: SyncState, bridgeSize = 10): GeminiContent[] {
    const archived = sync.archivedChat || [];
    const active = sync.chatHistory || [];
    const bridge = archived.slice(-bridgeSize);
    const combinedHistory = [...bridge, ...active];
    
    return combinedHistory.map(msg => {
      let text = msg.content;
      if (msg.kind === 'artifact_ref' && msg.collapsedContent) {
        text = JSON.stringify({
          TYPE: "ARTIFACT_REFERENCE",
          ID: msg.collapsedContent.docId,
          TITLE: msg.collapsedContent.title,
          DECISIONS: msg.collapsedContent.decisions_made,
          ENTITIES: msg.collapsedContent.entities_used
        });
      }
      return { role: msg.role, parts: [{ text }] };
    });
  }

  static buildStructuredStoryData(project: StoryProject, activeChapterId?: string, relevantIds: string[] = []): string {
    const { bible, chapters } = project;
    const activeChapter = activeChapterId ? chapters.find(c => c.id === activeChapterId) : null;
    
    const isFullExport = relevantIds.length === 0 && !activeChapterId;

    const core = {
      title: project.meta.title,
      grandArc: bible.grandArc,
      laws: bible.laws.filter(l => l.importance === 'Absolute'),
      tone: bible.tone
    };

    let focalEntities;

    if (isFullExport) {
      focalEntities = {
        characters: bible.characters.map(c => ({ id: c.id, profile: c.profile, state: c.state })),
        locations: bible.locations,
        organizations: bible.organizations,
        keyItems: bible.keyItems,
        timeline: bible.timeline,
        activeForeshadowings: bible.foreshadowing
      };
    } else {
      const focalIds = Array.from(new Set([...(activeChapter?.relevantEntityIds || []), ...(activeChapter?.involvedCharacterIds || []), ...relevantIds]));
      focalEntities = {
        characters: bible.characters.filter(c => focalIds.includes(c.id) || c.profile.role === 'Protagonist').map(c => ({ id: c.id, profile: c.profile, state: c.state })),
        locations: bible.locations.filter(l => focalIds.includes(l.id)),
        activeForeshadowings: bible.foreshadowing.filter(f => focalIds.includes(f.id) || activeChapter?.foreshadowingLinks?.some(l => l.foreshadowingId === f.id)),
        currentChapterSummary: activeChapter?.summary || "None"
      };
    }

    return JSON.stringify({ core, focalEntities }, null, 2);
  }

  static buildStaticArchitectContext(project: StoryProject, persona: AiPersona = AiPersona.STANDARD): string {
    const fullStoryData = this.buildStructuredStoryData(project);
    const lang = project.meta.language || 'ja';
    
    return `
${Prompts.ARCHITECT_MTP(lang, persona)}

---
### TIER 1: ETERNAL CANON (Story Bible)
This is the absolute immutable setting. Use it as the "sole basis" of your reasoning.
${fullStoryData}
`.trim();
  }

  static buildDynamicArchitectContext(memory: string, relevantIds: string[], isContextActive: boolean = true, lang: 'ja' | 'en' = 'ja'): string {
    const focusNote = relevantIds.length > 0 
      ? `\n[Attention] In the current context, pay special attention to items with these IDs: ${relevantIds.join(", ")}`
      : "";

    const inst = lang === 'ja' ? {
      redacted: "ユーザーは現在、設定（聖書）の参照を無効化しています。あなたは既存の設定に縛られず、自由な発想で提案を行ってください。",
      guide1: "回答は常に Tier 1 の正史（Cached Context）に準拠してください。",
      guide2: "議論の着地点は Tier 2 のメモリを優先し、無用な蒸し返しを避けてください。",
      guide3: "未解決の課題（Open Questions）がある場合、それらを解消する方向で作家をサポートしてください。"
    } : {
      redacted: "The user has currently disabled Bible reference. Please propose freely without being bound by existing settings.",
      guide1: "Always adhere to Tier 1 Eternal Canon (Cached Context).",
      guide2: "Prioritize Tier 2 Memory for conclusions and avoid unnecessary rehashing.",
      guide3: "If there are Open Questions, support the writer in resolving them."
    };

    if (!isContextActive) {
      return `
### TIER 1: (REDACTED)
${inst.redacted}

---
### TIER 2: DECISION LOG
${memory || '{"decisions": [], "open_questions": []}'}
`.trim();
    }

    return `
---
### TIER 2: DECISION LOG
Decisions derived from past discussions and open questions.
${memory || '{"decisions": [], "open_questions": []}'}

---
### DYNAMIC INSTRUCTION
${focusNote}

# Guidelines:
1. ${inst.guide1}
2. ${inst.guide2}
3. ${inst.guide3}
`.trim();
  }

  static buildArchitectMTP(project: StoryProject, memory: string, relevantIds: string[] = [], isContextActive: boolean = true): string {
    const lang = project.meta.language || 'ja';
    const persona = project.meta.preferences?.aiPersona || AiPersona.STANDARD;
    
    if (isContextActive) {
        return this.buildStaticArchitectContext(project, persona) + "\n" + this.buildDynamicArchitectContext(memory, relevantIds, true, lang);
    }
    return Prompts.ARCHITECT_MTP(lang, persona) + "\n" + this.buildDynamicArchitectContext(memory, relevantIds, false, lang);
  }

  static buildWriterMTP(project: StoryProject, activeChapterId: string, tone: string, isContextActive: boolean = true): string {
    const lang = project.meta.language || 'ja';
    const persona = project.meta.preferences?.aiPersona || AiPersona.STANDARD;
    const storyData = isContextActive ? this.buildStructuredStoryData(project, activeChapterId) : "User has disabled Bible reference.";
    return `
${this.inject(Prompts.WRITER_MTP(lang, persona), { TONE: tone })}
【STRUCTURED_CONTEXT】
${storyData}
`.trim();
  }
}
