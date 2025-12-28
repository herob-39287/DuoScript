
import { StoryProject, SyncOperation, HistoryEntry } from '../types';

/**
 * AIからの提案（SyncOperation）を現在の物語設定（StoryProject）に適用し、
 * 新しいプロジェクトのインスタンスを返します。
 * この関数はReactに依存しない純粋なビジネスロジックです。
 */
export const applySyncOperation = (project: StoryProject, op: SyncOperation): StoryProject => {
  // 設定（Bible）のディープコピーを作成し、バージョンを更新
  const nextBible = { ...project.bible, version: project.bible.version + 1 };
  const rawValue = op.value;
  let targetName = op.targetName || "不明";
  let oldVal: any = null;
  let newVal: any = null;

  // 文字列直接更新フィールドの判定
  const isStringField = ['setting', 'tone', 'laws', 'grandArc'].includes(op.path);

  if (isStringField) {
    // 「世界観」や「トーン」など、単一の文字列値を扱うフィールドの更新
    oldVal = (nextBible as any)[op.path];
    newVal = (typeof rawValue === 'object' && rawValue !== null) 
      ? (rawValue.content || rawValue.text || rawValue.value || JSON.stringify(rawValue)) 
      : rawValue;
    (nextBible as any)[op.path] = newVal;
  } else {
    // キャラクター、年表、用語、伏線などのコレクション（配列）の更新
    const collection = [...((nextBible as any)[op.path] || [])];
    
    // IDまたは名称で既存アイテムを特定
    let idx = op.targetId ? collection.findIndex((i: any) => i.id === op.targetId) : -1;
    if (idx === -1 && op.targetName) {
      idx = collection.findIndex((i: any) => {
        const itemName = (i.name || i.title || i.event || "").toLowerCase().trim();
        return itemName === op.targetName?.toLowerCase().trim();
      });
    }

    if (idx === -1 && op.op !== 'delete') {
      // 存在しない場合は新規追加
      const newItem = { id: crypto.randomUUID(), ...rawValue };
      // パスに応じたデフォルト名称の付与
      if (!newItem.name && !newItem.title && !newItem.event && op.targetName) {
         if (op.path === 'characters') newItem.name = op.targetName;
         else if (op.path === 'timeline') newItem.event = op.targetName;
         else newItem.title = op.targetName;
      }
      collection.push(newItem);
      targetName = newItem.name || newItem.title || newItem.event || targetName;
      newVal = newItem;
    } else if (idx !== -1) {
      // 既存アイテムが存在する場合の処理
      const currentItem = { ...collection[idx] };
      targetName = currentItem.name || currentItem.title || currentItem.event || targetName;
      
      if (op.op === 'delete') {
        // 削除操作
        oldVal = currentItem;
        collection.splice(idx, 1);
        newVal = "DELETED";
      } else {
        // 更新操作
        if (op.field) {
          // ピンポイントなフィールド更新（特に登場人物の状態変化に重要）
          const statusFields = ['location', 'health', 'currentGoal', 'internalState', 'socialStanding', 'inventory', 'knowledge'];
          
          if (op.path === 'characters' && statusFields.includes(op.field)) {
             // キャラクターの動的ステータス更新
             oldVal = currentItem.status?.[op.field];
             newVal = (typeof rawValue === 'object' && rawValue !== null && rawValue[op.field] !== undefined) 
               ? rawValue[op.field] 
               : rawValue;
             currentItem.status = { ...currentItem.status, [op.field]: newVal };
          } else {
             // 一般的な属性更新
             oldVal = currentItem[op.field];
             newVal = (typeof rawValue === 'object' && rawValue !== null && rawValue[op.field] !== undefined) 
               ? rawValue[op.field] 
               : rawValue;
             currentItem[op.field] = newVal;
          }
        } else {
          // オブジェクト全体のマージ（null/undefinedを除外して上書きを防止）
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

  // 変更履歴エントリの作成
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

  // プロジェクト全体を更新
  return {
    ...project,
    bible: nextBible,
    history: [historyEntry, ...project.history].slice(0, 100),
    pendingChanges: project.pendingChanges.filter(p => p.id !== op.id)
  };
};
