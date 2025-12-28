
import { StoryProject, SyncOperation, HistoryEntry } from '../types';

/**
 * 外部データ（localStorageやJSON）をStoryProject型に正規化し、
 * アプリケーション内で安全に使用できる構造を保証します。
 */
export const normalizeProject = (data: any): StoryProject => {
  const now = Date.now();
  const project: StoryProject = {
    id: data?.id || crypto.randomUUID(),
    title: data?.title || '無題の物語',
    author: data?.author || '不明な著者',
    genre: data?.genre || '一般',
    createdAt: data?.createdAt || now,
    updatedAt: data?.updatedAt || now,
    language: data?.language || 'ja',
    bible: {
      version: data?.bible?.version || 1,
      setting: data?.bible?.setting || data?.setting || '',
      laws: data?.bible?.laws || data?.laws || '',
      grandArc: data?.bible?.grandArc || data?.grandArc || '',
      themes: Array.isArray(data?.bible?.themes) ? data.bible.themes : [],
      tone: data?.bible?.tone || 'ニュートラル',
      characters: Array.isArray(data?.bible?.characters) ? data.bible.characters : [],
      timeline: Array.isArray(data?.bible?.timeline) ? data.bible.timeline : [],
      foreshadowing: Array.isArray(data?.bible?.foreshadowing) ? data.bible.foreshadowing : [],
      entries: Array.isArray(data?.bible?.entries) ? data.bible.entries : [],
      nexusBranches: Array.isArray(data?.bible?.nexusBranches) ? data.bible.nexusBranches : [],
      integrityIssues: Array.isArray(data?.bible?.integrityIssues) ? data.bible.integrityIssues : []
    },
    chapters: Array.isArray(data?.chapters) && data.chapters.length > 0 
      ? data.chapters 
      : [{ 
          id: crypto.randomUUID(), 
          title: '序章', 
          summary: '', 
          content: '', 
          strategy: { milestones: [], forbiddenResolutions: [], characterArcProgress: '', pacing: '' }, 
          beats: [], 
          status: 'Idea', 
          wordCount: 0, 
          stateDeltas: [] 
        }],
    tokenUsage: Array.isArray(data?.tokenUsage) ? data.tokenUsage : [],
    chatHistory: Array.isArray(data?.chatHistory) ? data.chatHistory : [],
    pendingChanges: Array.isArray(data?.pendingChanges) ? data.pendingChanges : [],
    history: Array.isArray(data?.history) ? data.history : []
  };

  // 登場人物データの完全性を保証
  project.bible.characters = project.bible.characters.map((c: any) => ({
    ...c,
    status: c.status || { 
      location: '不明', 
      health: '良好', 
      inventory: [], 
      knowledge: [], 
      currentGoal: '', 
      socialStanding: '', 
      internalState: '平常' 
    },
    relationships: c.relationships || []
  }));

  return project;
};

/**
 * AIからの提案（SyncOperation）を現在の物語設定（StoryProject）に適用し、
 * 新しいプロジェクトのインスタンスを返します。
 */
export const applySyncOperation = (project: StoryProject, op: SyncOperation): StoryProject => {
  const nextBible = { ...project.bible, version: project.bible.version + 1 };
  const rawValue = op.value;
  let targetName = op.targetName || "不明";
  let oldVal: any = null;
  let newVal: any = null;

  const isStringField = ['setting', 'tone', 'laws', 'grandArc'].includes(op.path);

  if (isStringField) {
    oldVal = (nextBible as any)[op.path];
    newVal = (typeof rawValue === 'object' && rawValue !== null) 
      ? (rawValue.content || rawValue.text || rawValue.value || JSON.stringify(rawValue)) 
      : rawValue;
    (nextBible as any)[op.path] = newVal;
  } else {
    const collection = [...((nextBible as any)[op.path] || [])];
    
    let idx = op.targetId ? collection.findIndex((i: any) => i.id === op.targetId) : -1;
    if (idx === -1 && op.targetName) {
      idx = collection.findIndex((i: any) => {
        const itemName = (i.name || i.title || i.event || "").toLowerCase().trim();
        return itemName === op.targetName?.toLowerCase().trim();
      });
    }

    if (idx === -1 && op.op !== 'delete') {
      const newItem = { id: crypto.randomUUID(), ...rawValue };
      if (!newItem.name && !newItem.title && !newItem.event && op.targetName) {
         if (op.path === 'characters') newItem.name = op.targetName;
         else if (op.path === 'timeline') newItem.event = op.targetName;
         else newItem.title = op.targetName;
      }
      collection.push(newItem);
      targetName = newItem.name || newItem.title || newItem.event || targetName;
      newVal = newItem;
    } else if (idx !== -1) {
      const currentItem = { ...collection[idx] };
      targetName = currentItem.name || currentItem.title || currentItem.event || targetName;
      
      if (op.op === 'delete') {
        oldVal = currentItem;
        collection.splice(idx, 1);
        newVal = "DELETED";
      } else {
        if (op.field) {
          const statusFields = ['location', 'health', 'currentGoal', 'internalState', 'socialStanding', 'inventory', 'knowledge'];
          
          if (op.path === 'characters' && statusFields.includes(op.field)) {
             oldVal = currentItem.status?.[op.field];
             newVal = (typeof rawValue === 'object' && rawValue !== null && rawValue[op.field] !== undefined) 
               ? rawValue[op.field] 
               : rawValue;
             currentItem.status = { ...currentItem.status, [op.field]: newVal };
          } else {
             oldVal = currentItem[op.field];
             newVal = (typeof rawValue === 'object' && rawValue !== null && rawValue[op.field] !== undefined) 
               ? rawValue[op.field] 
               : rawValue;
             currentItem[op.field] = newVal;
          }
        } else {
          oldVal = { ...currentItem };
          const cleanValue = Object.fromEntries(
            Object.entries(rawValue).filter(([_, v]) => v !== null && v !== undefined)
          );
          newVal = { ...currentItem, ...cleanValue };
        }
        collection[idx] = newVal;
      }
    }
    (nextBible as any)[op.path] = collection;
  }

  const historyEntry: HistoryEntry = {
    id: crypto.randomUUID(),
    timestamp: Date.now(),
    operationId: op.id,
    opType: op.op,
    path: op.path,
    targetName,
    oldValue: oldVal,
    newValue: newVal,
    rationale: op.rationale,
    evidence: op.evidence || "NeuralSync",
    versionAtCommit: nextBible.version
  };

  return {
    ...project,
    bible: nextBible,
    history: [historyEntry, ...project.history].slice(0, 100),
    pendingChanges: project.pendingChanges.filter(p => p.id !== op.id)
  };
};
