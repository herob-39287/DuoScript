
import { StoryProject, GeminiContent, SyncState, AiPersona, AppLanguage } from "../../types";
import { ChatMessage } from "../../types/sync";
import * as Prompts from "./prompts";
import { PromptTemplate } from "./promptTemplate";

export class PromptBuilder {
  
  static buildCompressedHistory(sync: SyncState, bridgeSize = 4): GeminiContent[] {
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

  /**
   * Tier 1: Index Context (Lightweight)
   */
  static buildIndexData(project: StoryProject): string {
    const { bible } = project;
    const index = {
      _meta: {
        title: project.meta.title,
        version: bible.version,
        note: "TIER 1 INDEX: Contains summaries only. Full details are provided in TIER 3 FOCAL DATA."
      },
      grandArc: bible.grandArc, 
      tone: bible.tone,
      laws: bible.laws.map(l => ({ id: l.id, name: l.name, type: l.type, importance: l.importance, summary: l.shortSummary || l.description.slice(0, 100) })),
      characters: bible.characters.map(c => ({
        id: c.id,
        name: c.profile.name,
        role: c.profile.role,
        summary: c.profile.shortSummary || c.profile.description.slice(0, 60) + "..."
      })),
      locations: bible.locations.map(l => ({ id: l.id, name: l.name, type: l.type })),
      organizations: bible.organizations.map(o => ({ id: o.id, name: o.name })),
      keyItems: bible.keyItems.map(i => ({ id: i.id, name: i.name })),
      races: bible.races.map(r => ({ id: r.id, name: r.name })),
      entries: bible.entries.map(e => ({ id: e.id, title: e.title, category: e.category })),
      timeline: bible.timeline.map(t => ({ id: t.id, time: t.timeLabel, event: t.event })),
      storyStructure: bible.storyStructure,
      volumes: bible.volumes
    };
    return JSON.stringify(index, null, 2);
  }

  /**
   * Tier 3: Focal Context (High Resolution)
   */
  static buildFocalData(project: StoryProject, relevantIds: string[], activeChapterId?: string): string {
    const { bible, chapters } = project;
    const activeChapter = activeChapterId ? chapters.find(c => c.id === activeChapterId) : null;
    
    const focalIds = new Set(relevantIds);
    if (activeChapter) {
        (activeChapter.involvedCharacterIds || []).forEach(id => focalIds.add(id));
        (activeChapter.relevantEntityIds || []).forEach(id => focalIds.add(id));
        (activeChapter.foreshadowingLinks || []).forEach(link => focalIds.add(link.foreshadowingId));
    }

    const focalData: any = {};
    const addIfRelevant = (key: string, list: any[]) => {
        const matches = list.filter(item => focalIds.has(item.id));
        if (matches.length > 0) {
            focalData[key] = matches;
        }
    };

    addIfRelevant('characters', bible.characters);
    addIfRelevant('locations', bible.locations);
    addIfRelevant('organizations', bible.organizations);
    addIfRelevant('keyItems', bible.keyItems);
    addIfRelevant('laws', bible.laws);
    addIfRelevant('entries', bible.entries);
    addIfRelevant('races', bible.races);
    addIfRelevant('bestiary', bible.bestiary);
    addIfRelevant('abilities', bible.abilities);
    addIfRelevant('themes', bible.themes);
    addIfRelevant('storyThreads', bible.storyThreads);
    addIfRelevant('foreshadowing', bible.foreshadowing);

    if (activeChapter) {
        focalData.currentChapter = {
            title: activeChapter.title,
            summary: activeChapter.summary,
            beats: activeChapter.beats,
            strategy: activeChapter.strategy,
            contentSnippet: activeChapter.content?.slice(-3000) || "" 
        };
    }

    if (Object.keys(focalData).length === 0) return "No specific focal entities identified.";
    return JSON.stringify(focalData, null, 2);
  }

  static buildStructuredStoryData(project: StoryProject, activeChapterId?: string, relevantIds: string[] = []): string {
    if (relevantIds.length === 0 && !activeChapterId) {
        return this.buildIndexData(project);
    }
    return this.buildFocalData(project, relevantIds, activeChapterId);
  }

  // --- Context Templates ---

  private static STATIC_CONTEXT_TEMPLATE = `
{{MTP}}

---
### TIER 1: ETERNAL CANON (Index)
This is the immutable index of the world. 
NOTE: This is a summary. Full details for specific items will be provided in TIER 3 (Dynamic Focus) if relevant.
{{INDEX}}
`.trim();

  private static DYNAMIC_CONTEXT_TEMPLATE = `
---
### TIER 2: DECISION LOG
Decisions derived from past discussions.
{{MEMORY}}

---
### TIER 3: DYNAMIC FOCUS (RAG Result)
Detailed data for entities relevant to the current conversation.
{{FOCUS}}

# Guidelines:
1. {{GUIDE1}}
2. {{GUIDE2}}
3. {{GUIDE3}}
`.trim();

  private static REDACTED_CONTEXT_TEMPLATE = `
### TIER 1 & 3: (REDACTED)
{{REDACTED_MSG}}

---
### TIER 2: DECISION LOG
{{MEMORY}}
`.trim();

  private static INSTRUCTION_TEMPLATE = `
{{SYSTEM_INSTRUCTION}}

# Response Rules:
- Communicate in natural {{LANG_NAME}}.
- Stimulate the writer's creativity.
- If the user seems to want to "finalize settings", encourage Neural Sync.
`.trim();

  static buildStaticArchitectContext(project: StoryProject, persona: AiPersona = AiPersona.STANDARD): string {
    const lang = project.meta.language || 'ja';
    return new PromptTemplate(this.STATIC_CONTEXT_TEMPLATE).format({
      MTP: Prompts.ARCHITECT_MTP(lang, persona),
      INDEX: this.buildIndexData(project)
    });
  }

  static buildDynamicArchitectContext(project: StoryProject, memory: string, relevantIds: string[], isContextActive: boolean = true, lang: AppLanguage = 'ja'): string {
    const inst = lang === 'ja' ? {
      redacted: "ユーザーは現在、設定（聖書）の参照を無効化しています。既存の設定に縛られず、自由な発想で提案を行います。",
      guide1: "回答は TIER 1 (Index) と TIER 3 (Focus) の情報に準拠してください。",
      guide2: "議論の着地点は TIER 2 (Memory) を優先し、無用な蒸し返しを避けてください。",
      guide3: "TIER 3 に詳細がある場合、それを正として扱ってください。"
    } : {
      redacted: "The user has currently disabled Bible reference. Please propose freely without being bound by existing settings.",
      guide1: "Adhere to TIER 1 (Index) and TIER 3 (Focus).",
      guide2: "Prioritize TIER 2 (Memory) for conclusions.",
      guide3: "Treat TIER 3 details as the source of truth."
    };

    if (!isContextActive) {
      return new PromptTemplate(this.REDACTED_CONTEXT_TEMPLATE).format({
        REDACTED_MSG: inst.redacted,
        MEMORY: memory || '{"decisions": [], "open_questions": []}'
      });
    }

    return new PromptTemplate(this.DYNAMIC_CONTEXT_TEMPLATE).format({
      MEMORY: memory || '{"decisions": [], "open_questions": []}',
      FOCUS: relevantIds.length > 0 ? this.buildFocalData(project, relevantIds) : "None",
      GUIDE1: inst.guide1,
      GUIDE2: inst.guide2,
      GUIDE3: inst.guide3
    });
  }

  static buildArchitectSystemInstruction(project: StoryProject, memory: string, relevantIds: string[], isContextActive: boolean = true, useCache: boolean = false): string {
    const lang = project.meta.language || 'ja';
    const persona = project.meta.preferences?.aiPersona || AiPersona.STANDARD;
    
    // If cache is active, we only provide dynamic part. If not, full context.
    let systemContent = "";
    if (useCache) {
      systemContent = this.buildDynamicArchitectContext(project, memory, relevantIds, isContextActive, lang);
    } else {
      const staticPart = this.buildStaticArchitectContext(project, persona);
      const dynamicPart = this.buildDynamicArchitectContext(project, memory, relevantIds, isContextActive, lang);
      systemContent = `${staticPart}\n${dynamicPart}`;
    }

    return new PromptTemplate(this.INSTRUCTION_TEMPLATE).format({
      SYSTEM_INSTRUCTION: systemContent,
      LANG_NAME: lang === 'ja' ? 'Japanese' : 'English'
    });
  }

  static buildWriterMTP(project: StoryProject, activeChapterId: string, tone: string, isContextActive: boolean = true): string {
    const lang = project.meta.language || 'ja';
    const persona = project.meta.preferences?.aiPersona || AiPersona.STANDARD;
    
    let contextData = "User has disabled Bible reference.";
    if (isContextActive) {
        const index = this.buildIndexData(project);
        const focal = this.buildFocalData(project, [], activeChapterId);
        contextData = `### TIER 1: WORLD INDEX\n${index}\n### TIER 3: ACTIVE CHAPTER & FOCUS\n${focal}`;
    }

    // Direct injection into Writer prompt resource
    const base = Prompts.WRITER_MTP(lang, persona);
    return `${base.replace('{{TONE}}', tone)}\n【STORY_CONTEXT】\n${contextData}`;
  }
}
