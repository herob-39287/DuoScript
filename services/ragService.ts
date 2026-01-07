
import { StoryProject, VectorEntry } from "../types";
import { saveVectors, getProjectVectors, deleteVectors } from "./storageService";
import { embedText } from "./gemini/core";
import { normalizeJapanese, calculateSimilarity } from "../utils/stringUtils";

export interface SearchResult {
  id: string;
  name: string;
  type: string;
  score: number;
  reason: 'Exact' | 'Fuzzy' | 'Semantic';
}

/**
 * コサイン類似度の計算
 */
function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (vecA.length !== vecB.length) return 0;
  let dotProduct = 0;
  let magnitudeA = 0;
  let magnitudeB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    magnitudeA += vecA[i] * vecA[i];
    magnitudeB += vecB[i] * vecB[i];
  }
  magnitudeA = Math.sqrt(magnitudeA);
  magnitudeB = Math.sqrt(magnitudeB);
  if (magnitudeA === 0 || magnitudeB === 0) return 0;
  return dotProduct / (magnitudeA * magnitudeB);
}

/**
 * エンティティのテキスト表現を生成（Embedding用）
 */
function generateEntityText(item: any, type: string): string {
  let text = `[${type}] ${item.name || item.title || "NoName"}\n`;
  if (item.profile?.description) text += item.profile.description;
  else if (item.description) text += item.description;
  else if (item.content) text += item.content;
  else if (item.definition) text += item.definition;
  
  if (item.profile?.role) text += `\nRole: ${item.profile.role}`;
  if (item.profile?.personality) text += `\nPersonality: ${item.profile.personality}`;
  
  return text.slice(0, 1000); // Truncate to reasonable length
}

/**
 * Hybrid Librarian Logic
 */
export const ragService = {
  /**
   * インデックスの整合性を維持する（変更があったものだけ再計算）
   */
  async maintainIndex(project: StoryProject, logCallback?: (msg: string) => void): Promise<void> {
    const projectId = project.meta.id;
    const existingVectors = await getProjectVectors(projectId);
    const vectorMap = new Map(existingVectors.map(v => [v.id, v]));
    
    const updates: VectorEntry[] = [];
    const currentIds = new Set<string>();

    const checkAndQueue = async (item: any, type: string, updatedAt: number) => {
      currentIds.add(item.id);
      const existing = vectorMap.get(item.id);
      
      // 更新条件: 存在しない OR タイムスタンプが古い
      if (!existing || existing.updatedAt < updatedAt) {
        const textChunk = generateEntityText(item, type);
        try {
          // 既存とテキストが完全に同じならEmbedding再計算をスキップ（コスト節約）
          if (existing && existing.textChunk === textChunk) {
            // タイムスタンプだけ更新して保存
            updates.push({ ...existing, updatedAt });
            return;
          }

          if (logCallback) logCallback(`Indexing ${type}: ${item.name || item.title}`);
          const embedding = await embedText(textChunk);
          updates.push({
            id: item.id,
            projectId,
            type: type as any,
            name: item.name || item.title || "NoName",
            textChunk,
            embedding,
            updatedAt
          });
          // APIレート制限回避のための微小待機
          await new Promise(r => setTimeout(r, 200));
        } catch (e) {
          console.error(`Failed to embed ${item.id}`, e);
        }
      }
    };

    // 各コレクションを走査
    for (const c of project.bible.characters) await checkAndQueue(c, 'character', project.meta.updatedAt); // Using project update time simpler for now, ideally item-level
    for (const l of project.bible.locations) await checkAndQueue(l, 'location', project.meta.updatedAt);
    for (const o of project.bible.organizations) await checkAndQueue(o, 'organization', project.meta.updatedAt);
    for (const e of project.bible.entries) await checkAndQueue(e, 'entry', project.meta.updatedAt);
    for (const k of project.bible.keyItems) await checkAndQueue(k, 'item', project.meta.updatedAt);
    for (const l of project.bible.laws) await checkAndQueue(l, 'law', project.meta.updatedAt);

    // 削除されたアイテムのクリーンアップ
    const idsToDelete = existingVectors.filter(v => !currentIds.has(v.id)).map(v => v.id);
    
    if (idsToDelete.length > 0) await deleteVectors(idsToDelete);
    if (updates.length > 0) await saveVectors(updates);
    
    if (logCallback && (idsToDelete.length > 0 || updates.length > 0)) {
      logCallback(`RAG Index updated: ${updates.length} updated, ${idsToDelete.length} deleted.`);
    }
  },

  /**
   * ハイブリッド検索 (Lexical + Vector)
   */
  async hybridSearch(query: string, project: StoryProject, limit: number = 20): Promise<SearchResult[]> {
    const candidates = new Map<string, SearchResult>();
    const normQuery = normalizeJapanese(query);

    // 1. Lexical Search (Client-side, fast)
    // Bibleデータを走査
    const scanList = [
      ...project.bible.characters.map(c => ({ id: c.id, name: c.profile.name, type: 'character' })),
      ...project.bible.entries.map(e => ({ id: e.id, name: e.title, type: 'entry' })),
      ...project.bible.locations.map(l => ({ id: l.id, name: l.name, type: 'location' })),
      ...project.bible.organizations.map(o => ({ id: o.id, name: o.name, type: 'organization' })),
      ...project.bible.keyItems.map(k => ({ id: k.id, name: k.name, type: 'item' })),
      ...project.bible.laws.map(l => ({ id: l.id, name: l.name, type: 'law' })),
    ];

    scanList.forEach(item => {
      const normName = normalizeJapanese(item.name);
      if (normQuery.includes(normName)) {
        candidates.set(item.id, { ...item, score: 1.0, reason: 'Exact' });
      } else if (calculateSimilarity(normName, normQuery) > 0.8) {
        candidates.set(item.id, { ...item, score: 0.8, reason: 'Fuzzy' });
      }
    });

    // 2. Vector Search (Semantic)
    try {
      const queryEmbedding = await embedText(query);
      const vectors = await getProjectVectors(project.meta.id);
      
      vectors.forEach(vec => {
        const score = cosineSimilarity(queryEmbedding, vec.embedding);
        if (score > 0.65) { // Threshold
          // 既存スコアより高ければ上書き、または未登録なら追加
          if (!candidates.has(vec.id) || candidates.get(vec.id)!.score < score) {
            candidates.set(vec.id, {
              id: vec.id,
              name: vec.name,
              type: vec.type,
              score,
              reason: 'Semantic'
            });
          }
        }
      });
    } catch (e) {
      console.error("Vector search failed", e);
      // Fallback to only lexical
    }

    // Sort and slice
    return Array.from(candidates.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }
};
