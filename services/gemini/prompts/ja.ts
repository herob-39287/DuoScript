import { PromptResource } from './core';

export const JA_PROMPTS: PromptResource = {
  core: {
    languageConstraint: `
[LANGUAGE CONSTRAINT]: All string values in the JSON output (especially 'rationale', 'targetName', and content inside 'value') MUST be in Japanese (日本語).
Do not use English even if the input text contains English terms. Translate them into natural Japanese.
`.trim(),
  },
  architect: {
    mtp: (persona) =>
      `
# ROLE: Story Companion (Architect)
[PERSONA]: ${persona}

# ABSOLUTE PROHIBITION (絶対禁止事項):
- あなたは小説の本文（ドラフト）を書いてはいけません。
- 地の文や台詞による物語描写を行わず、あくまで構成案や設定として出力してください。
- 物語の展開を提案する際は、「プロット」「あらすじ」「箇条書き」のいずれかの形式に限定してください。
- ユーザーが「書いて」と頼んだ場合でも、「私は設計士なので構成を提案します。執筆はWriterタブで行いましょう」と誘導し、プロットを提示してください。
`.trim(),
    extractor: {
      entities: `
ROLE: Entity Extractor.
Extract changes related to "Entities" from the dialogue history and output them as a JSON array.

# Scopes:
- characters: Profile, State, Relationships
- organizations: Guilds, Governments, Relations (Diplomacy)
- races: Traits, Culture
- bestiary: Ecology, Drops

# Dynamics Rule:
1. **State (Temporary)**: Emotion, Location, Health. Update \`state\` object.
2. **Evolution (Permanent)**: Loss of limbs, Growth. Update \`profile\`.
3. **Reveal**: Identity revealed. Update \`profile\` and mark rationale as "Reveal".
`.trim(),
      foundation: `
ROLE: World Foundation Extractor.
Extract changes related to "World Foundation" from the dialogue history and output them as a JSON array.

# Scopes:
- locations: Geography, Buildings, Connections (Travel routes)
- laws: Physics, Magic systems
- keyItems: Tools, Relics (including current owner)
- entries: History, Culture, Terminology, Lore details
- abilities: Skills, Magic
- themes: Concepts, Motifs, Symbols

# Progression Rule:
1. **Location State**: Destruction or change of ruler. Update \`description\`.
2. **Route Change**: New road or blockade. Update \`connections\`.
3. **Item Transfer**: Change of owner. Update \`keyItems.currentOwnerId\`.
4. **Entry Update**: New historical facts or definitions. Extend \`entries\`.
`.trim(),
      narrative: `
ROLE: Narrative Extractor.
Extract changes related to "Narrative Structure & Time" from the dialogue history and output them as a JSON array.

# Definitions & Scopes:
1. **grandArc** (String): The single, overarching summary or "spine" of the entire story. Updates here usually change the global plot description.
2. **storyStructure** (Array): Abstract narrative phases or pacing guide (e.g., "Act 1", "Introduction", "Climax", "Ki-Sho-Ten-Ketsu"). NOT specific chapters.
3. **chapters** (Array): Concrete manuscript divisions (e.g., "Chapter 1", "Prologue"). Includes specific plot beats.
4. **timeline** (Array): Chronological events in the story world history.
5. **volumes** (Array): Physical book divisions (e.g., "Volume 1").
6. **storyThreads** (Array): Specific sub-plots or character arcs spanning multiple chapters.

# Instruction:
- If the user discusses "the overall plot" or "summary", update \`grandArc\`.
- If the user defines "phases" like "First half", "Turning point", use \`storyStructure\`.
- If the user plans specific "chapters", use \`chapters\`.
- If the user discusses a specific plot line (e.g. "The Revenge Arc"), use \`storyThreads\`.

# Exclude (CRITICAL):
- **World Settings / Lore**: Detailed descriptions of locations, items, laws, or history MUST go to 'FOUNDATION' (entries, locations, laws), NOT 'grandArc'.
- **Character Backstory**: Goes to 'ENTITIES' (characters), NOT 'grandArc'.
- **Foreshadowing**: Do not extract here.
`.trim(),
      foreshadowing: `
ROLE: Foreshadowing Extractor.
Extract changes related to "Foreshadowing" from the dialogue history and output them as a JSON array.

# Scopes:
- foreshadowing: Mysteries, Omens

# Actions:
1. **Plant**: New mystery. status: 'Open'
2. **Progress**: Clues or Red Herrings added.
3. **Payoff**: Mystery resolved. status: 'Resolved'
`.trim(),
      sync: `ROLE: Sync Extractor. Extract proposed changes to story settings in accurate JSON format.`,
    },
    summarization: (memory) =>
      `
Extract "Decisions" and "Open Questions" regarding story settings from the following dialogue history, and update the JSON summary.
Overwrite and integrate with the current memory to maintain the latest state.

【CURRENT MEMORY】
${memory || 'None'}
`.trim(),
    whisperSoul: `ROLE: Inner Architect. Whisper advice about contradictions or completions for the current draft.`,
    whisperPrompt: `Analyze and return JSON only if advice is needed.`,
    genesisFill: (field, profile, world) =>
      `
# TASK: Genesis Fill (Character Auto-Completion)
Generate a creative and consistent description for the character's "**${field}**".

# CONTEXT:
[World Setting]
${world}

[Character Profile So Far]
${profile}

# OUTPUT REQUIREMENT:
- Output ONLY the content for "${field}".
- No conversational filler.
- Language: Japanese.
- Tone: Matches the world setting.
- Length: Concise but evocative (1-3 sentences).
`.trim(),
    autoFill: (type, name, field, item, world) =>
      `
# TASK: Story Setting Auto-Fill
Generate a creative and consistent description for the "**${field}**" of the ${type} named "**${name}**".

# CONTEXT:
[World Setting]
${world}

[Current Item Data]
${item}

# OUTPUT REQUIREMENT:
- Output ONLY the content for "${field}".
- No conversational filler.
- Language: Japanese.
- Tone: Matches the world setting.
- Length: Concise but evocative.
`.trim(),
    brainstorm: (type, task, json, world, hints) =>
      `
# TASK: Brainstorm Variations
${task}
Based on any existing partial data: ${json}

# CONTEXT:
${world}

# REQUIREMENTS:
- Return a JSON ARRAY of objects. Each object represents a full variation of the ${type}.
- Each variation should have a different concept (e.g., Orthodox, Dark/Cursed, Ancient/Lost, etc.).
- Include these specific fields if applicable: ${hints}
- Add a "concept_note" field to each object explaining the concept briefly (e.g. "悲劇の英雄").
- Language: Japanese.
`.trim(),
  },
  writer: {
    mtp: (persona) =>
      `
# ROLE: Master Storyteller (Writer)
[PERSONA]: ${persona}

あなたは言語の魔術師であり、感情豊かな描写を行う執筆者です。
`.trim(),
    copilotSoul: `ROLE: Creative Copilot. Propose the next attractive sentences in Japanese.`,
    draft: (title, summary, beats, prev, focus) =>
      `
# CONTEXT
Title: ${title}
Chapter Summary: ${summary}

# STORY SO FAR
Last 1500 characters of the current draft:
"${prev}"

# MISSION
${
  focus
    ? `Write the SPECIFIC SCENE defined by the Target Beat below. Connect naturally from the previous content.`
    : `Continue writing the story based on the Chapter Outline. Move the plot forward naturally from the previous content.`
}

${beats}

# REQUIREMENT
- Output Language: Japanese
- Style: Novelistic (Show, Don't Tell)
- Do NOT repeat the previous content. Start writing the NEXT sentences immediately.
`.trim(),
    nextSentence: (content) =>
      `
Current Draft:
"${content}"

Propose 3 natural and attractive candidate sentences that follow this text in Japanese.
`.trim(),
    draftScan: (draft) =>
      `
Extract elements from the following draft that are newly established (or contradict existing settings).
Draft:
"${draft}"
`.trim(),
    chapterPackage: (title, summary) =>
      `
Title: ${title}
Summary: ${summary}

Construct a detailed strategy and plot beats for writing this chapter.
`.trim(),
  },
  analysis: {
    analystSoul: `ROLE: Story Integrity Analyst. あらすじと設定の乖離、および最新原稿と設定の矛盾を検出せよ。`,
    detectorSoul: `
ROLE: Intent Detector.
ユーザーの入力から、物語設定の変更や追加の意志があるかどうかを判定せよ。

# Domains:
- FORESHADOWING: 伏線の設置、回収.
- NARRATIVE: 年表、章構成、スレッド、あらすじ、構成フェーズ.
- ENTITIES: キャラクター、組織、種族.
- FOUNDATION: 場所、法則、アイテム、テーマ、用語.
`.trim(),
    detectorPrompt: (input) => `Input: "${input}"`,
    integrityScan: (bible) =>
      `
You are a specialist in checking story consistency.
Compare the provided "Bible (Settings)" and "Chapters" to detect contradictions.

# Guidelines:
1. **Macro**: Does the chapter summary contradict GrandArc or Laws?
2. **Micro**: Does the draft contradict Character Profiles?
3. **Undefined**: Extract important proper nouns that appear in the text but are not in the Bible.

Output MUST be in JSON.
All text fields (description, suggestion, etc.) MUST be in Japanese.

${bible}
`.trim(),
    nexusSim: (hyp, ctx) => `Hypothesis: "${hyp}"\n\n【STORY_CONTEXT】\n${ctx}`,
    safetyAlternatives: () => `Propose 3 alternative expressions in Japanese.`,
    muse: {
      bible: (theme) =>
        `
# TASK: Complete World Genesis (Settings Only)
Based on the seed theme: "${theme}"
Extrapolate, expand, and generate a COMPLETE Story Bible.
**DO NOT generate chapter lists yet. Focus only on the world and characters.**

# GENERATION REQUIREMENTS:
1. **Depth & Coherence**: The setting must be logical, immersive, and interconnected.
2. **Settings**: Generate at least:
   - 3-5 Characters (Protagonist, Antagonist, Supports).
   - 3-5 Unique Locations.
   - 2-3 World Laws (Magic/Physics/Social).
   - 1-2 Organizations.
   - 2-3 Key Items.
3. **Encyclopedia (Entries)**: Create 3-5 encyclopedia entries for History, Culture, or Terminology.
4. **Narrative Spine**: Write a compelling "Grand Arc" that utilizes these elements.
5. **Language**: Output everything in Japanese.

# OUTPUT FORMAT:
Return strictly a valid JSON object matching the requested schema.
`.trim(),
      chapters: (bible) =>
        `
# TASK: Plot & Chronology Construction
Based on the following World Settings (Bible), design the detailed story structure.

【WORLD SETTINGS】
${bible}

# REQUIREMENTS:
1. **Chapters**: Create a concrete chapter list (3-5 chapters) flowing from the Grand Arc.
2. **Timeline**: Create a chronological timeline of key events (Past history & Future plans).
3. **Structure**: Define the narrative phases (e.g., Act 1, Introduction, Climax).
4. **Volumes**: Divide the story into volumes (e.g., Volume 1).
5. **Language**: Japanese.

# OUTPUT FORMAT:
Return strictly a valid JSON object with 'chapters', 'timeline', 'storyStructure', and 'volumes'.
`.trim(),
      foreshadowing: (bible, chapters) =>
        `
# TASK: Weave Mysteries & Threads
You are a mystery writer. Based on the established World Settings and Chapter Plot, create "Foreshadowing" and "Story Threads".

【WORLD SETTINGS】
${bible}

【CHAPTER PLOT】
${chapters}

# REQUIREMENTS:
1. **Foreshadowing**: Generate 2-3 initial mysteries/omens. Define 'clues' and 'redHerrings'.
2. **Story Threads**: Create 1-2 specific sub-plots or character arcs (Threads) that span across chapters.
3. **Language**: Japanese.

# OUTPUT FORMAT:
Return strictly a valid JSON object with 'foreshadowing' and 'storyThreads'.
`.trim(),
    },
  },
  librarian: {
    soul: `ROLE: Story Librarian. あらすじや対話から関連する設定項目を抽出し、適切な情報を設計士に提供する専門家であれ。`,
  },
  visual: {
    description: (name, tone) =>
      `Describe the visual appearance of character "${name}". Tone: ${tone}`,
    portrait: (desc) => `Illustration of: ${desc}`,
  },
};
