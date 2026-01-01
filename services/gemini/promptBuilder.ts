
import { StoryProject, Character, GeminiContent } from "../../types";
import * as Prompts from "./prompts";

/**
 * PromptBuilder: 
 * 長編執筆における「情報の希釈化」と「トークン爆発」を防ぐための階層化プロンプト生成。
 */
export class PromptBuilder {
  
  private static inject(template: string, replacements: Record<string, string>): string {
    let result = template;
    for (const [key, value] of Object.entries(replacements)) {
      result = result.replace(new RegExp(`{{${key}}}`, 'g'), value);
    }
    return result;
  }

  /**
   * 階層化された物語データの構築
   * 1. Foundation (Core): 絶対不変の設定
   * 2. Active (Focal): 現在の執筆・対話に直結する詳細データ
   * 3. Index (Reference): 名称のみの索引（Librarian用）
   */
  static buildStructuredStoryData(project: StoryProject, activeChapterId?: string, relevantIds: string[] = []): string {
    const { bible, chapters } = project;
    const activeChapter = activeChapterId ? chapters.find(c => c.id === activeChapterId) : null;
    
    // 優先的に詳細を含めるべきエンティティID
    const focalIds = Array.from(new Set([
      ...(activeChapter?.relevantEntityIds || []),
      ...(activeChapter?.involvedCharacterIds || []),
      ...relevantIds
    ]));

    // --- TIER 1: ETERNAL CANON (核心) ---
    // ここは絶対に要約せず、物語の背骨として維持する
    const core = {
      title: project.meta.title,
      grandArc: bible.grandArc, // 全量を維持
      absoluteLaws: bible.laws.filter(l => l.importance === 'Absolute'),
      tone: bible.tone
    };

    // --- TIER 2: ACTIVE CONTEXT (焦点) ---
    // Librarianが選択した、または現在執筆中の章に関わる詳細データ
    const focalEntities = {
      characters: bible.characters
        .filter(c => focalIds.includes(c.id) || c.profile.role === 'Protagonist')
        .map(c => ({
          id: c.id,
          profile: c.profile,
          state: c.state,
          relationships: c.relationships.map(r => ({
            target: bible.characters.find(tc => tc.id === r.targetId)?.profile.name || "Unknown",
            type: r.type,
            desc: r.description
          }))
        })),
      locations: bible.locations.filter(l => focalIds.includes(l.id)),
      currentChapterSummary: activeChapter?.summary || "なし",
      recentBeats: activeChapter?.beats || []
    };

    // --- TIER 3: REFERENCE INDEX (索引) ---
    // 存在のみを知らせる。詳細が必要ならLibrarianがActiveに昇格させる。
    // トークン爆発を防ぐため、100件以上の場合は省略する。
    const index = {
      otherCharacters: bible.characters.filter(c => !focalIds.includes(c.id) && c.profile.role !== 'Protagonist').map(c => c.profile.name),
      otherWorldEntries: bible.entries.filter(e => !focalIds.includes(e.id)).slice(0, 50).map(e => e.title),
      pastChapters: chapters.filter(c => c.id !== activeChapterId).slice(-5).map(c => ({ title: c.title, summary: c.summary.slice(0, 50) + "..." }))
    };

    return JSON.stringify({ core, focalEntities, index }, null, 2);
  }

  static buildArchitectMTP(project: StoryProject, memory: string, relevantIds: string[] = []): string {
    const storyData = this.buildStructuredStoryData(project, undefined, relevantIds);
    return `
${Prompts.ARCHITECT_MTP}

【STORY_ARCHITECTURE_TIERED】
${storyData}

【EPHEMERAL_CONVERSATION_MEMORY】
${memory || "なし"}

# 指針:
1. 核心(Core)の設定に反する提案は絶対に避けなさい。
2. 索引(Index)にある項目について作家が触れた場合、その詳細が必要であると司書(Librarian)に促しなさい。
`.trim();
  }

  static buildWriterMTP(project: StoryProject, activeChapterId: string, tone: string): string {
    const storyData = this.buildStructuredStoryData(project, activeChapterId);
    return `
${this.inject(Prompts.WRITER_MTP, { TONE: tone })}

【STRUCTURED_CONTEXT】
${storyData}

# 執筆上の注意:
- 核心(Core)のテーマを常に根底に流しなさい。
- 焦点(Focal)にいるキャラクターの感情変化を詳細に描写しなさい。
`.trim();
  }
}
