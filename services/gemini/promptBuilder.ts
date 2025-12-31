
import { StoryProject, Character, GeminiContent } from "../../types";

/**
 * PromptBuilder: 階層化コンテキストの構築とプロンプトテンプレートの管理
 */
export class PromptBuilder {
  /**
   * 多層コンテキスト (Tiered Context) の生成
   */
  static buildTieredContext(project: StoryProject, activeChapterId?: string, relevantIds: string[] = [], focus: string = 'AUTO'): string {
    const { bible, chapters } = project;
    const activeChapter = activeChapterId ? chapters.find(c => c.id === activeChapterId) : null;
    const combinedRelevantIds = Array.from(new Set([...(activeChapter?.relevantEntityIds || []), ...relevantIds]));

    const tier0 = `
=== [Tier 0] CORE FOUNDATION ===
Title: ${project.meta.title}
Genre: ${project.meta.genre}
World Setting: ${bible.setting.slice(0, 800)}...
Laws: ${bible.laws.map(l => l.name + ": " + (l.shortSummary || l.description.slice(0, 150))).join("\n - ")}
Grand Arc: ${bible.grandArc.slice(0, 800)}...
Tone: ${bible.tone}
`.trim();

    let tier1 = "=== [Tier 1] ACTIVE ENTITIES (In-Focus) ===\n";
    if (activeChapter) {
      bible.characters.filter(c => activeChapter.involvedCharacterIds.includes(c.id)).forEach(c => tier1 += this.formatCharacterDetailed(c, bible));
    } else if (focus === 'CHARACTERS') {
      bible.characters.slice(0, 5).forEach(c => tier1 += this.formatCharacterDetailed(c, bible));
    }

    let tier2 = "=== [Tier 2] RELEVANT CONTEXT (Semantic Recall) ===\n";
    combinedRelevantIds.forEach(id => {
      if (activeChapter?.involvedCharacterIds.includes(id)) return;
      const entity = bible.characters.find(c => c.id === id) || bible.entries.find(e => e.id === id) || bible.keyItems.find(k => k.id === id) || bible.locations.find(l => l.id === id);
      if (entity) tier2 += this.formatEntitySummary(entity);
    });

    let tier3 = "=== [Tier 3] WORLD SNAPSHOTS (Background Memory) ===\n";
    bible.entries.filter(e => !combinedRelevantIds.includes(e.id)).forEach(e => tier3 += `[Term: ${e.title}: ${e.shortSummary || e.definition.slice(0, 60)}...] `);
    bible.characters.filter(c => !combinedRelevantIds.includes(c.id) && !activeChapter?.involvedCharacterIds.includes(c.id)).forEach(c => tier3 += `[Char: ${c.profile.name}: ${c.profile.shortSummary || c.profile.role}] `);

    return `${tier0}\n\n${tier1}\n\n${tier2}\n\n${tier3}`;
  }

  private static formatCharacterDetailed(c: Character, bible: any): string {
    const p = c.profile; const s = c.state;
    return `### Character: ${p.name} [${p.role}]
- Profile: ${p.description}
- Personality: ${p.personality}
- Motivation: ${p.motivation}
- Voice: ${p.voice.speechStyle} (1st: ${p.voice.firstPerson})
- Current: ${s.internalState} at ${s.location}
\n`;
  }

  private static formatEntitySummary(entity: any): string {
    const name = entity.profile?.name || entity.title || entity.name;
    const type = entity.profile ? 'Char' : (entity.definition ? 'Term' : 'Item');
    const summary = entity.shortSummary || entity.profile?.shortSummary || (entity.definition || entity.description || "").slice(0, 150);
    return `- [${type}] ${name}: ${summary}\n`;
  }

  // --- Prompts ---
  static architectSystem(ctx: string, memory: string) {
    return `あなたは物語の「設計士(Architect)」です。\n【コンテキスト】\n${ctx}\n【長期記憶】\n${memory || "なし"}\n\n論理的整合性を最優先し、NeuralSyncを通じて設定変更を提案してください。正史(Canon)と仮説(Nexus)を厳密に区別すること。`;
  }

  static writerSystem(ctx: string, tone: string) {
    return `あなたは「小説家(Writer)」です。トーン「${tone}」を維持し、視点人物の五感を重視した描写を行ってください。\n【コンテキスト】\n${ctx}`;
  }

  static whisperPrompt(chunk: string, ctx: string) {
    return `執筆中の文章を分析し、整合性や伏線の助言をJSONで返してください。助言不要なら「なし」と。文脈:\n${ctx}\n直近:\n${chunk}`;
  }
}
