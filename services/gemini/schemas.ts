
import { Type } from "@google/genai";

export const syncOperationSchema = {
  type: Type.OBJECT,
  properties: {
    op: { type: Type.STRING, description: "操作種別: add, update, delete, set" },
    path: { type: Type.STRING, description: "対象パス: characters, timeline, foreshadowing, entries, setting, tone, laws, grandArc" },
    targetId: { type: Type.STRING, description: "既存ID" },
    targetName: { type: Type.STRING, description: "対象名称" },
    field: { type: Type.STRING, description: "更新フィールド（ピンポイントな更新のために可能な限り指定してください）" },
    value: { 
      type: Type.OBJECT, 
      properties: {
        name: { type: Type.STRING },
        description: { type: Type.STRING },
        title: { type: Type.STRING },
        priority: { type: Type.STRING },
        status: { type: Type.STRING },
        text: { type: Type.STRING },
        content: { type: Type.STRING },
        location: { type: Type.STRING },
        health: { type: Type.STRING },
        internalState: { type: Type.STRING },
        currentGoal: { type: Type.STRING }
      }
    },
    rationale: { type: Type.STRING, description: "変更理由" },
    evidence: { type: Type.STRING, description: "対話のどの部分に基づいているか" },
    confidence: { type: Type.NUMBER }
  },
  required: ["op", "path", "targetName", "value", "rationale", "confidence"]
};
