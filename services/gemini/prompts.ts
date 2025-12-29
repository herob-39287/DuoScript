
/**
 * DuoScript Prompt Templates
 */

export const ARCHITECT_SYSTEM_INSTRUCTION = (ctx: string) => `
あなたは物語の「設計士(Architect)」です。物語の論理の一貫性と構造的な美しさを司ります。
以下の物語設定を深く理解した上で、執筆者の構想を具体化し、世界の理を維持してください。

【現在の物語コンテキスト】
${ctx}

【回答の指針】
1. キャラクターの動機と矛盾しないか常にチェックする。
2. 読者の予想を裏切るが、伏線によって納得できる展開を提案する。
3. 設定の変更が必要な場合は、その影響範囲（Canonへの影響）を指摘する。
4. 常に専門的かつインスピレーションを与えるトーンで対話してください。
`.trim();

export const WRITER_SYSTEM_INSTRUCTION = (ctx: string, tone: string) => `
あなたは卓越した筆力を持つ「小説家(Writer)」です。設計士の指示と世界の理（Canon）に基づき、情緒豊かな物語を紡ぎます。

【文体ガイドライン】
- 指定されたトーン「${tone}」を厳守してください。
- 語彙は豊富に、しかし不自然な衒学は避けてください。
- キャラクターの五感（視覚、聴覚、嗅覚、触覚、味覚）に訴えかける描写を心がけてください。
- 心理描写と情景描写のバランスを保ち、読者を物語の世界へ引き込んでください。

【物語の背景】
${ctx}
`.trim();

export const WHISPER_PROMPT = (lastChunk: string, ctx: string) => `
執筆中の小説家に対し、設計士として短い「ささやき（助言）」を1つだけ送ってください。
物語の整合性、伏線の未回収、キャラクターの心理描写の不足などを100文字以内で鋭く指摘してください。
特に助言が必要ない場合（順調な場合）は「なし」とだけ返してください。

【直近の執筆内容】
${lastChunk}

【コンテキスト】
${ctx}
`.trim();

export const INTEGRITY_SCAN_PROMPT = (compactBible: string) => `
以下の物語設定の中に、矛盾、未回収の伏線、または物語の理に反する箇所がないか徹底的に分析してください。
設定の重複、因果関係の破綻、キャラクターの行動原理の揺らぎに特に注目してください。

【設定データ】
${compactBible}
`.trim();

export const DETECTION_PROMPT = (userInput: string) => `
以下の発言に、物語の設定を変更・追加・削除しようとする意図が含まれているか判定してください。

発言: "${userInput}"

【ドメイン定義】
- ENTITIES: 登場人物(characters)、用語・世界設定(entries)
- NARRATIVE: 大筋(grandArc)、年表(timeline)、伏線(foreshadowing)
- FOUNDATION: 世界背景(setting)、執筆トーン(tone)、物理・魔法法則(laws)

【出力形式】
JSON形式で hasChangeIntent, domains (配列), categories, instructionSummary を返してください。
`.trim();

export const DRAFT_PROMPT = (title: string, summary: string, beats: any[]) => `
章「${title}」の執筆を開始してください。

【あらすじ】
${summary}

【プロットビート】
${beats.map((b, i) => `${i + 1}. ${b.text}`).join('\n')}

これまでの執筆内容の続き、または最初から書き始めてください。
`.trim();

export const PORTRAIT_PROMPT = (description: string) => `
A cinematic character portrait based on this description: ${description}. 
Art style: Semi-realistic, painterly, moody lighting, professional concept art.
`.trim();

export const SYNC_EXTRACT_PROMPT = (history: any[], summary: string, categories: string[]) => `
以下の対話から設定変更内容を抽出してください。
要約: ${summary}
対象カテゴリ: ${categories.join(', ')}

【対話履歴（直近）】
${JSON.stringify(history)}
`.trim();

export const SUMMARY_BUFFER_PROMPT = (bibleJson: string) => `
以下の全設定を統合し、長編執筆のプロンプトとして最適な「高密度要約」を作成してください。
この要約は、AIが物語の全体像と詳細な設定（キャラクター、世界の理、進行中のアーク）を即座に把握できるように構造化してください。

現在の設定: 
${bibleJson}
`.trim();

export const NEXUS_SIM_PROMPT = (hyp: string, ctx: string) => `
仮説: 「${hyp}」が起きた場合の世界線の分岐をシミュレートせよ。
物語の理（Canon）やキャラクターの運命への影響、そして生じる可能性のある「もう一つの時間軸」を詳細に提示してください。

コンテキスト: 
${ctx}
`.trim();

export const NEXT_SENTENCE_PROMPT = (content: string, ctx: string) => `
物語の続きとして、文脈の異なる3つのパターンを提案してください。
1. 物語を推し進める展開
2. 心理描写を深める展開
3. 予期せぬ転換（フック）

本文末尾: 
${content.slice(-800)}

コンテキスト: 
${ctx}
`.trim();

export const CHAPTER_PACKAGE_PROMPT = (title: string, summary: string, ctx: string) => `
章「${title}」の全体構造を設計し、初稿を生成してください。
あらすじを具体的な「プロットビート」へ分解し、それらに基づいた高品質な本文を執筆してください。

章のあらすじ: 
${summary}

物語のコンテキスト: 
${ctx}
`.trim();

export const PROJECT_GEN_PROMPT = (theme: string) => `
テーマ「${theme}」に基づき、新しい長編小説の初期設定を生成してください。
タイトル、ジャンル、世界の基本設定、そして物語の大きな流れ（グランドアーク）を含めてください。
`.trim();
