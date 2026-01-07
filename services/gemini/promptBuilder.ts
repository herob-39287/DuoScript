
import { StoryProject, Character, GeminiContent, SyncState } from "../../types";
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

  /**
   * 物語の構造化データを生成する。
   * relevantIds が指定されていない場合は、フィルタリングなしの「完全なBible」を返す。
   */
  static buildStructuredStoryData(project: StoryProject, activeChapterId?: string, relevantIds: string[] = []): string {
    const { bible, chapters } = project;
    const activeChapter = activeChapterId ? chapters.find(c => c.id === activeChapterId) : null;
    
    // relevantIdsが空配列でない場合はフィルタリングを行うが、
    // キャッシング用途(空配列)の場合は全データを含める。
    const isFullExport = relevantIds.length === 0 && !activeChapterId;

    const core = {
      title: project.meta.title,
      grandArc: bible.grandArc,
      laws: bible.laws.filter(l => l.importance === 'Absolute'),
      tone: bible.tone
    };

    let focalEntities;

    if (isFullExport) {
      // キャッシュ用：全データ出力
      focalEntities = {
        characters: bible.characters.map(c => ({ id: c.id, profile: c.profile, state: c.state })),
        locations: bible.locations,
        organizations: bible.organizations,
        keyItems: bible.keyItems,
        timeline: bible.timeline,
        activeForeshadowings: bible.foreshadowing
      };
    } else {
      // 執筆/個別参照用：関連データのみ抽出
      const focalIds = Array.from(new Set([...(activeChapter?.relevantEntityIds || []), ...(activeChapter?.involvedCharacterIds || []), ...relevantIds]));
      focalEntities = {
        characters: bible.characters.filter(c => focalIds.includes(c.id) || c.profile.role === 'Protagonist').map(c => ({ id: c.id, profile: c.profile, state: c.state })),
        locations: bible.locations.filter(l => focalIds.includes(l.id)),
        activeForeshadowings: bible.foreshadowing.filter(f => focalIds.includes(f.id) || activeChapter?.foreshadowingLinks?.some(l => l.foreshadowingId === f.id)),
        currentChapterSummary: activeChapter?.summary || "なし"
      };
    }

    return JSON.stringify({ core, focalEntities }, null, 2);
  }

  /**
   * [Cache Target] 静的なコンテキスト（人格 + 完全な世界設定）を生成する。
   */
  static buildStaticArchitectContext(project: StoryProject): string {
    const fullStoryData = this.buildStructuredStoryData(project);
    
    return `
${Prompts.ARCHITECT_MTP}

---
### TIER 1: ETERNAL CANON (物語の正史・聖書)
これは絶対不変の設定です。あなたの推論の「唯一の根底」としてください。
${fullStoryData}
`.trim();
  }

  /**
   * [Request Target] 動的な指示（メモリ + フォーカス指示 + ルール）を生成する。
   */
  static buildDynamicArchitectContext(memory: string, relevantIds: string[], isContextActive: boolean = true): string {
    const focusNote = relevantIds.length > 0 
      ? `\n[Attention] 現在の文脈では、以下のIDを持つ項目に特に注目してください: ${relevantIds.join(", ")}`
      : "";

    if (!isContextActive) {
      return `
### TIER 1: (REDACTED / 封印中)
ユーザーは現在、設定（聖書）の参照を無効化しています。
あなたは既存の設定に縛られず、自由な発想で提案を行ってください。
もし設定を参照しなければ回答が困難な場合は、ユーザーに「設定の参照」を提案してください。

---
### TIER 2: DECISION LOG
${memory || '{"decisions": [], "open_questions": []}'}
`.trim();
    }

    return `
---
### TIER 2: DECISION LOG (対話メモリ)
過去の議論から導き出された決定事項と、未解決の課題です。
${memory || '{"decisions": [], "open_questions": []}'}

---
### DYNAMIC INSTRUCTION
${focusNote}

# 行動指針:
1. 回答は常に Tier 1 の正史（Cached Context）に準拠してください。
2. 議論の着地点は Tier 2 のメモリを優先し、無用な蒸し返しを避けてください。
3. 未解決の課題（Open Questions）がある場合、それらを解消する方向で作家をサポートしてください。
`.trim();
  }

  // Legacy support for non-cached calls (or fallback)
  static buildArchitectMTP(project: StoryProject, memory: string, relevantIds: string[] = [], isContextActive: boolean = true): string {
    if (isContextActive) {
        return this.buildStaticArchitectContext(project) + "\n" + this.buildDynamicArchitectContext(memory, relevantIds, true);
    }
    return Prompts.ARCHITECT_MTP + "\n" + this.buildDynamicArchitectContext(memory, relevantIds, false);
  }

  static buildWriterMTP(project: StoryProject, activeChapterId: string, tone: string, isContextActive: boolean = true): string {
    const storyData = isContextActive ? this.buildStructuredStoryData(project, activeChapterId) : "ユーザーが設定参照を無効化しています。";
    return `
${this.inject(Prompts.WRITER_MTP, { TONE: tone })}
【STRUCTURED_CONTEXT】
${storyData}
`.trim();
  }
}
