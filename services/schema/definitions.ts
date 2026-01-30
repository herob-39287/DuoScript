export type FieldType = 'text' | 'textarea' | 'select' | 'number' | 'array' | 'subform' | 'object';

export interface FieldDefinition {
  key: string;
  labelKey: string; // i18n key (e.g. 'form.name')
  defaultLabel: string; // Fallback label (Japanese)
  type: FieldType;

  // Form Configuration
  options?: string[];
  source?: 'locations' | 'organizations' | 'chapters' | 'characters' | 'items';
  placeholder?: string;
  autoFillHint?: string;
  minRows?: number;
  subFields?: FieldDefinition[];
  addButtonLabel?: string;

  // Sync & Logic Configuration
  isNaming?: boolean; // Is this the primary identifier field? (e.g. name, title)
  isContent?: boolean; // Is this the main content field? (e.g. description, summary)
}

// --- Item Types & Labels (Moved from components/plotter/forms/schema.ts) ---

export type ItemType =
  | 'law'
  | 'location'
  | 'organization'
  | 'item'
  | 'entry'
  | 'theme'
  | 'race'
  | 'bestiary'
  | 'ability'
  | 'timeline'
  | 'foreshadowing'
  | 'thread'
  | 'structure'
  | 'volume'
  | 'chapter';

export type FieldSchema = FieldDefinition;

export const ITEM_LABELS: Record<ItemType, string> = {
  law: 'World Law',
  location: 'Location',
  organization: 'Organization',
  item: 'Key Item',
  entry: 'Entry',
  theme: 'Theme',
  race: 'Race',
  bestiary: 'Bestiary',
  ability: 'Ability',
  timeline: 'Timeline Event',
  foreshadowing: 'Foreshadowing',
  thread: 'Story Thread',
  structure: 'Phase',
  volume: 'Volume',
  chapter: 'Chapter',
};

// Map ItemType to a generic model key
export type ModelKey = ItemType | 'character';

export const MODEL_DEFINITIONS: Record<string, FieldDefinition[]> = {
  character: [
    { key: 'name', labelKey: 'form.name', defaultLabel: '名前', type: 'text', isNaming: true },
    {
      key: 'role',
      labelKey: 'form.type',
      defaultLabel: '役割',
      type: 'select',
      options: ['Protagonist', 'Antagonist', 'Supporting', 'Minor'],
    },
    {
      key: 'description',
      labelKey: 'form.description',
      defaultLabel: '詳細',
      type: 'textarea',
      isContent: true,
    },
    { key: 'shortSummary', labelKey: 'form.short_summary', defaultLabel: '一言紹介', type: 'text' },
    { key: 'appearance', labelKey: 'form.appearance', defaultLabel: '外見', type: 'textarea' },
    { key: 'personality', labelKey: 'form.personality', defaultLabel: '性格', type: 'textarea' },
    { key: 'background', labelKey: 'form.background', defaultLabel: '背景', type: 'textarea' },
    { key: 'motivation', labelKey: 'form.motivation', defaultLabel: '動機', type: 'text' },
    { key: 'flaw', labelKey: 'form.flaw', defaultLabel: '欠点', type: 'text' },
    { key: 'arc', labelKey: 'form.arc', defaultLabel: 'アーク', type: 'text' },
    { key: 'traits', labelKey: 'form.traits', defaultLabel: '特徴', type: 'array' },
    { key: 'aliases', labelKey: 'form.aliases', defaultLabel: '別名', type: 'array' },
  ],
  law: [
    {
      key: 'name',
      labelKey: 'form.name',
      defaultLabel: '名前',
      type: 'text',
      placeholder: '',
      isNaming: true,
    },
    {
      key: 'type',
      labelKey: 'form.type',
      defaultLabel: '種類',
      type: 'select',
      options: ['Physics', 'Magic', 'Social', 'Divine', 'Taboo'],
    },
    {
      key: 'importance',
      labelKey: 'form.importance',
      defaultLabel: '重要度',
      type: 'select',
      options: ['Absolute', 'Flexible', 'Conditional'],
    },
    {
      key: 'description',
      labelKey: 'form.description',
      defaultLabel: '説明',
      type: 'textarea',
      autoFillHint: '法則の詳細・説明',
      minRows: 4,
      isContent: true,
    },
  ],
  location: [
    { key: 'name', labelKey: 'form.name', defaultLabel: '名前', type: 'text', isNaming: true },
    {
      key: 'type',
      labelKey: 'form.type',
      defaultLabel: '種類',
      type: 'select',
      options: ['Continent', 'Country', 'City', 'Region', 'Spot', 'Building'],
    },
    {
      key: 'description',
      labelKey: 'form.description',
      defaultLabel: '説明',
      type: 'textarea',
      autoFillHint: '場所の描写・歴史',
      minRows: 4,
      isContent: true,
    },
    {
      key: 'connections',
      labelKey: 'form.connections',
      defaultLabel: '接続',
      type: 'subform',
      addButtonLabel: 'Add',
      subFields: [
        {
          key: 'targetLocationId',
          labelKey: 'form.target_id',
          defaultLabel: '接続先',
          type: 'select',
          source: 'locations',
        },
        {
          key: 'travelTime',
          labelKey: 'form.travel_time',
          defaultLabel: '所要時間',
          type: 'text',
          placeholder: '3 days',
        },
        {
          key: 'method',
          labelKey: 'form.method',
          defaultLabel: '移動手段',
          type: 'text',
          placeholder: 'Road, Ship...',
        },
        {
          key: 'dangerLevel',
          labelKey: 'form.danger',
          defaultLabel: '危険度',
          type: 'select',
          options: ['Safe', 'Caution', 'Deadly'],
        },
      ],
    },
  ],
  organization: [
    { key: 'name', labelKey: 'form.name', defaultLabel: '名前', type: 'text', isNaming: true },
    {
      key: 'type',
      labelKey: 'form.type',
      defaultLabel: '種類',
      type: 'select',
      options: ['Guild', 'Government', 'Cult', 'Party', 'Company'],
    },
    {
      key: 'description',
      labelKey: 'form.description',
      defaultLabel: '説明',
      type: 'textarea',
      autoFillHint: '組織の目的・構成',
      minRows: 4,
      isContent: true,
    },
    {
      key: 'relations',
      labelKey: 'form.relations',
      defaultLabel: '関係',
      type: 'subform',
      addButtonLabel: 'Add',
      subFields: [
        {
          key: 'targetOrganizationId',
          labelKey: 'form.target_id',
          defaultLabel: '対象組織',
          type: 'select',
          source: 'organizations',
        },
        {
          key: 'stance',
          labelKey: 'form.stance',
          defaultLabel: 'スタンス',
          type: 'select',
          options: ['Ally', 'Neutral', 'Hostile', 'Subordinate'],
        },
        {
          key: 'description',
          labelKey: 'form.description',
          defaultLabel: '詳細',
          type: 'text',
          placeholder: '...',
        },
      ],
    },
  ],
  item: [
    { key: 'name', labelKey: 'form.name', defaultLabel: '名前', type: 'text', isNaming: true },
    {
      key: 'type',
      labelKey: 'form.type',
      defaultLabel: '種類',
      type: 'select',
      options: ['Weapon', 'Tool', 'Relic', 'Evidence'],
    },
    {
      key: 'description',
      labelKey: 'form.description',
      defaultLabel: '説明',
      type: 'textarea',
      autoFillHint: 'アイテムの外見・由来',
      minRows: 3,
      isContent: true,
    },
    {
      key: 'mechanics',
      labelKey: 'form.mechanics',
      defaultLabel: '仕組み',
      type: 'textarea',
      autoFillHint: '機能・魔法効果',
      minRows: 3,
    },
  ],
  entry: [
    {
      key: 'title',
      labelKey: 'form.title',
      defaultLabel: 'タイトル',
      type: 'text',
      isNaming: true,
    },
    {
      key: 'category',
      labelKey: 'form.type',
      defaultLabel: 'カテゴリ',
      type: 'select',
      options: ['History', 'Culture', 'Technology', 'Magic', 'Geography', 'Lore', 'Terminology'],
    },
    {
      key: 'definition',
      labelKey: 'form.definition',
      defaultLabel: '定義',
      type: 'textarea',
      autoFillHint: '用語の定義・詳細',
      minRows: 5,
      isContent: true,
    },
    { key: 'tags', labelKey: 'form.tags', defaultLabel: 'タグ', type: 'array' },
  ],
  theme: [
    {
      key: 'concept',
      labelKey: 'form.concept',
      defaultLabel: '概念',
      type: 'text',
      placeholder: '',
      isNaming: true,
    },
    {
      key: 'motifs',
      labelKey: 'form.motifs',
      defaultLabel: 'モチーフ',
      type: 'array',
      placeholder: '',
    },
    {
      key: 'description',
      labelKey: 'form.description',
      defaultLabel: '説明',
      type: 'textarea',
      autoFillHint: 'テーマの哲学的背景',
      minRows: 4,
      isContent: true,
    },
  ],
  race: [
    { key: 'name', labelKey: 'form.name', defaultLabel: '名前', type: 'text', isNaming: true },
    {
      key: 'lifespan',
      labelKey: 'form.lifespan',
      defaultLabel: '寿命',
      type: 'text',
      placeholder: '',
    },
    {
      key: 'traits',
      labelKey: 'form.traits',
      defaultLabel: '特徴',
      type: 'array',
      placeholder: '',
    },
    {
      key: 'description',
      labelKey: 'form.description',
      defaultLabel: '説明',
      type: 'textarea',
      autoFillHint: '種族の文化・生態',
      minRows: 4,
      isContent: true,
    },
  ],
  bestiary: [
    { key: 'name', labelKey: 'form.name', defaultLabel: '名前', type: 'text', isNaming: true },
    {
      key: 'type',
      labelKey: 'form.type',
      defaultLabel: '種類',
      type: 'select',
      options: ['Beast', 'Plant', 'Monster', 'Spirit'],
    },
    {
      key: 'dangerLevel',
      labelKey: 'form.danger',
      defaultLabel: '危険度',
      type: 'select',
      options: ['Safe', 'Caution', 'Deadly', 'Catastrophic'],
    },
    {
      key: 'habitat',
      labelKey: 'form.habitat',
      defaultLabel: '生息地',
      type: 'text',
      autoFillHint: '生息環境',
    },
    { key: 'dropItems', labelKey: 'form.drop_items', defaultLabel: 'ドロップ品', type: 'array' },
    {
      key: 'description',
      labelKey: 'form.description',
      defaultLabel: '説明',
      type: 'textarea',
      autoFillHint: '生物の特徴・行動',
      minRows: 3,
      isContent: true,
    },
  ],
  ability: [
    { key: 'name', labelKey: 'form.name', defaultLabel: '名前', type: 'text', isNaming: true },
    {
      key: 'type',
      labelKey: 'form.type',
      defaultLabel: '種類',
      type: 'select',
      options: ['Magic', 'Skill', 'Tech', 'Divine'],
    },
    { key: 'cost', labelKey: 'form.cost', defaultLabel: 'コスト', type: 'text', placeholder: '' },
    {
      key: 'mechanics',
      labelKey: 'form.mechanics',
      defaultLabel: '仕組み',
      type: 'textarea',
      autoFillHint: '発動条件・効果',
      minRows: 3,
    },
    {
      key: 'description',
      labelKey: 'form.description',
      defaultLabel: '説明',
      type: 'textarea',
      autoFillHint: '能力の起源・背景',
      minRows: 3,
      isContent: true,
    },
  ],
  timeline: [
    {
      key: 'timeLabel',
      labelKey: 'form.time_label',
      defaultLabel: '時期',
      type: 'text',
      placeholder: 'e.g. 1999',
    },
    { key: 'event', labelKey: 'form.event', defaultLabel: '出来事', type: 'text', isNaming: true },
    {
      key: 'importance',
      labelKey: 'form.importance',
      defaultLabel: '重要度',
      type: 'select',
      options: ['Minor', 'Major', 'Climax'],
    },
    {
      key: 'status',
      labelKey: 'form.status',
      defaultLabel: '状態',
      type: 'select',
      options: ['Canon', 'Plan', 'Hypothesis'],
    },
    {
      key: 'description',
      labelKey: 'form.description',
      defaultLabel: '詳細',
      type: 'textarea',
      autoFillHint: 'イベントの詳細',
      minRows: 4,
      isContent: true,
    },
  ],
  foreshadowing: [
    {
      key: 'title',
      labelKey: 'form.title',
      defaultLabel: 'タイトル',
      type: 'text',
      isNaming: true,
    },
    {
      key: 'status',
      labelKey: 'form.status',
      defaultLabel: '状態',
      type: 'select',
      options: ['Open', 'Resolved', 'Stale'],
    },
    {
      key: 'priority',
      labelKey: 'form.importance',
      defaultLabel: '重要度',
      type: 'select',
      options: ['Low', 'Medium', 'High', 'Critical'],
    },
    {
      key: 'description',
      labelKey: 'form.description',
      defaultLabel: '説明',
      type: 'textarea',
      autoFillHint: '伏線の内容・意図',
      minRows: 3,
      isContent: true,
    },
    {
      key: 'clues',
      labelKey: 'form.clues',
      defaultLabel: '手がかり',
      type: 'array',
      autoFillHint: '読者へのヒント',
    },
    {
      key: 'redHerrings',
      labelKey: 'form.red_herrings',
      defaultLabel: 'ミスリード',
      type: 'array',
      autoFillHint: '読者を誤誘導する要素',
    },
  ],
  thread: [
    {
      key: 'title',
      labelKey: 'form.title',
      defaultLabel: 'タイトル',
      type: 'text',
      isNaming: true,
    },
    {
      key: 'status',
      labelKey: 'form.status',
      defaultLabel: '状態',
      type: 'select',
      options: ['Open', 'Resolved'],
    },
    {
      key: 'shortSummary',
      labelKey: 'form.summary',
      defaultLabel: '概要',
      type: 'textarea',
      autoFillHint: 'スレッドの概要',
      minRows: 3,
      isContent: true,
    },
    {
      key: 'beats',
      labelKey: 'form.beats',
      defaultLabel: '展開',
      type: 'subform',
      addButtonLabel: 'Add',
      subFields: [
        {
          key: 'chapterId',
          labelKey: 'form.chapter_id',
          defaultLabel: 'チャプター',
          type: 'select',
          source: 'chapters',
        },
        {
          key: 'eventDescription',
          labelKey: 'form.description',
          defaultLabel: '詳細',
          type: 'textarea',
          placeholder: '...',
        },
      ],
    },
  ],
  structure: [
    {
      key: 'name',
      labelKey: 'form.name',
      defaultLabel: 'フェーズ名',
      type: 'text',
      placeholder: '',
      isNaming: true,
    },
    { key: 'goal', labelKey: 'form.goal', defaultLabel: 'ゴール', type: 'text' },
    {
      key: 'summary',
      labelKey: 'form.summary',
      defaultLabel: '概要',
      type: 'textarea',
      autoFillHint: 'フェーズの役割',
      minRows: 4,
      isContent: true,
    },
  ],
  volume: [
    {
      key: 'title',
      labelKey: 'form.title',
      defaultLabel: 'タイトル',
      type: 'text',
      isNaming: true,
    },
    { key: 'order', labelKey: 'form.order', defaultLabel: '順序', type: 'number' },
    {
      key: 'summary',
      labelKey: 'form.summary',
      defaultLabel: 'あらすじ',
      type: 'textarea',
      autoFillHint: 'この巻のあらすじ',
      minRows: 5,
      isContent: true,
    },
  ],
  chapter: [
    {
      key: 'title',
      labelKey: 'form.title',
      defaultLabel: 'タイトル',
      type: 'text',
      isNaming: true,
    },
    {
      key: 'status',
      labelKey: 'form.status',
      defaultLabel: '状態',
      type: 'select',
      options: ['Idea', 'Beats', 'Drafting', 'Polished'],
    },
    {
      key: 'summary',
      labelKey: 'form.summary',
      defaultLabel: 'あらすじ',
      type: 'textarea',
      autoFillHint: '章のプロット',
      minRows: 6,
      isContent: true,
    },
  ],
  // Common / Mixed fields for fallback
  common: [
    {
      key: 'relatedEntityIds',
      labelKey: 'form.relations',
      defaultLabel: '関連エンティティ',
      type: 'array',
    },
    {
      key: 'involvedCharacterIds',
      labelKey: 'form.relations',
      defaultLabel: '関連キャラクター',
      type: 'array',
    },
    {
      key: 'associatedCharacterIds',
      labelKey: 'form.relations',
      defaultLabel: '関連キャラクター',
      type: 'array',
    },
    { key: 'memberIds', labelKey: 'form.relations', defaultLabel: 'メンバー', type: 'array' },
    { key: 'history', labelKey: 'form.history', defaultLabel: '来歴', type: 'array' },
    { key: 'value', labelKey: 'form.value', defaultLabel: '値', type: 'text' },
    { key: 'targetId', labelKey: 'form.target_id', defaultLabel: '対象', type: 'text' },
    { key: 'updatedAt', labelKey: 'common.updated_at', defaultLabel: '更新日時', type: 'number' },
  ],
};

export const SCHEMAS: Record<ItemType, FieldDefinition[]> = {
  law: MODEL_DEFINITIONS.law,
  location: MODEL_DEFINITIONS.location,
  organization: MODEL_DEFINITIONS.organization,
  item: MODEL_DEFINITIONS.item,
  entry: MODEL_DEFINITIONS.entry,
  theme: MODEL_DEFINITIONS.theme,
  race: MODEL_DEFINITIONS.race,
  bestiary: MODEL_DEFINITIONS.bestiary,
  ability: MODEL_DEFINITIONS.ability,
  timeline: MODEL_DEFINITIONS.timeline,
  foreshadowing: MODEL_DEFINITIONS.foreshadowing,
  thread: MODEL_DEFINITIONS.thread,
  structure: MODEL_DEFINITIONS.structure,
  volume: MODEL_DEFINITIONS.volume,
  chapter: MODEL_DEFINITIONS.chapter,
};

// Helper Functions

export function getNamingField(model: string): string {
  const def = MODEL_DEFINITIONS[model];
  if (!def) return 'title';
  const naming = def.find((f) => f.isNaming);
  return naming ? naming.key : 'title';
}

export function getContentField(model: string): string {
  const def = MODEL_DEFINITIONS[model];
  if (!def) return 'description';
  const content = def.find((f) => f.isContent);
  return content ? content.key : 'description';
}

export function getFieldLabel(key: string, modelType?: string): string {
  // Use fallback for labelKey
  const fieldDef = findFieldDefinition(key, modelType);
  return fieldDef ? fieldDef.defaultLabel : key || '';
}

export function getFieldLabelKey(key: string, modelType?: string): string {
  const fieldDef = findFieldDefinition(key, modelType);
  return fieldDef ? fieldDef.labelKey : '';
}

function findFieldDefinition(key: string, modelType?: string): FieldDefinition | undefined {
  // 1. Try model specific definition
  if (modelType && MODEL_DEFINITIONS[modelType]) {
    const field = MODEL_DEFINITIONS[modelType].find((f) => f.key === key);
    if (field) return field;

    // Check subfields
    for (const f of MODEL_DEFINITIONS[modelType]) {
      if (f.subFields) {
        const sub = f.subFields.find((s) => s.key === key);
        if (sub) return sub;
      }
    }
  }

  // 2. Try common definitions
  const common = MODEL_DEFINITIONS['common'].find((f) => f.key === key);
  if (common) return common;

  // 3. Scan all definitions for match (heuristic)
  for (const model of Object.values(MODEL_DEFINITIONS)) {
    const match = model.find((f) => f.key === key);
    if (match) return match;
  }

  return undefined;
}
