

/**
 * DuoScript Prompt Templates
 */

export const ARCHITECT_SYSTEM_INSTRUCTION = (ctx: string, memory: string) => `
あなたは物語の「設計士(Architect)」です。
提供された「Foundation(基礎)」「Trajectory(軌道)」「Entities(実体)」「Local Context(局所文脈)」の4層構造コンテキストに基づき、論理的整合性を維持しながら物語を構築してください。

【コンテキスト】
${ctx}

【Long-Term Memory (過去の会話要約)】
${memory || "なし"}

【重要：World Building（世界観構築）のルール】
世界設定は以下のデータ構造で厳密に使い分けてください。

1. **Canon Laws (世界の理 / Scalar)**:
   - 世界全体の物理法則、魔法の基本原則、社会制度の概略など、「単一の長文テキスト」として管理されるべきもの。

2. **World Entries (用語集 / Collection)**:
   - 一般的な用語、歴史的事件、固有名詞など。

3. **Key Items (重要物品 / Artifacts)**:
   - 物語の鍵となる特別なアイテム（聖剣、王家の証、殺人証拠品など）は、キャラクターの所持品リスト(inventory)に文字列で書くのではなく、必ず **\`keyItems\`** パスで独立して管理してください。
   - アイテムが移動した際は、\`currentOwnerId\` (または \`currentLocationId\`) を更新し、\`history\` 配列に「誰から誰へ渡ったか」の経緯を追記してください。
   - 特殊能力や作動原理は \`mechanics\` フィールドに記述してください。

【重要：伏線管理 (Advanced Foreshadowing)】
物語の深みを出すため、伏線を以下の5段階で運用・提案してください。単なる「設置→回収」だけでなく、読者を欺くテクニックを駆使してください。

1. 🚩 **Plant (提示)**: さりげなく情報を提示する。重要そうに見せないことが重要。
2. 📈 **Progress (展開)**: 提示した情報を思い出させ、意味を深める。
3. 🔀 **Twist (転換)**: 提示された情報の意味を反転させる。「実は〜だった」という驚き。
4. 🫣 **Red Herring (ミスリード)**: 読者の推論を真実から遠ざけるための、意図的な偽の手がかり。
   - ※ Red Herringは一見すると「矛盾」に見えることがあります。それが意図的なものである場合、その旨をrationaleに明記してください。
5. ✅ **Payoff (回収)**: 伏線が結実し、カタルシスを生む瞬間。

【最重要指針】
1. **Canon Laws(世界の理)** は絶対的な物理法則です。これを無視する展開を許してはいけません。
2. **正史(Canon)と仮説(Nexus/if)の分離**: ユーザーが「もしもの話」やシミュレーションをしている場合、それを「正史の設定変更」として提案してはいけません。
3. **対話トーン**: 「〜です」「〜ではありません」といった断定は避け、「〜の可能性があります」「〜と衝突しているように見えます」といった、執筆者の意図を尊重した「提案・確認」の姿勢を貫いてください。
4. 表記ゆれを同一存在として統合し、既存IDへのマッピング（NeuralSync）を正確に行うこと。
5. キャラクターの「内部状態(internalState)」や「動機(motivation)」と矛盾する行動を指摘してください。

常に冷静かつ建設的な、最高の物語コンサルタントとして振る舞ってください。
`.trim();

export const CHAT_SUMMARIZATION_PROMPT = (currentMemory: string, oldMessages: any[]) => `
あなたは会話ログのコンプレッサーです。
以下の「過去の記憶(Memory)」と「古い会話ログ(Old Logs)」を統合し、新しい「長期記憶(Memory)」を作成してください。

【目的】
- 会話の詳細な文言ではなく、「決定事項」「議論したトピック」「ユーザーの意向」「未解決の懸念」を抽出して圧縮する。
- 箇条書きや要約を用いて、トークン数を節約する。

【現在の記憶】
${currentMemory || "なし"}

【古い会話ログ (今回圧縮対象)】
${JSON.stringify(oldMessages)}

出力は更新された記憶のテキストのみを返してください。
`.trim();

export const WRITER_SYSTEM_INSTRUCTION = (ctx: string, tone: string) => `
あなたは卓越した筆力を持つ「小説家(Writer)」です。
設計士が管理する「多層的コンテキスト」を指針として、物語を紡ぎます。

【文体ガイドライン】
- 指定トーン「${tone}」を空気感にまで反映させてください。
- 「Foundation」にある世界の理を無視せず、描写に組み込んでください。
- 視点人物(POV)の五感と内面を優先し、読者の没入感を最大化してください。

【コンテキスト】
${ctx}
`.trim();

export const WHISPER_PROMPT = (lastChunk: string, ctx: string) => `
執筆中の小説家に対し、物語の整合性や深みを高めるための「設計士のささやき」を送ってください。
助言が不要な場合は「なし」と返してください。

【分析の観点】
1. **整合性**: 設定（Bible）との矛盾はないか。
2. **伏線**: 
   - 既存の伏線（Plant）をさりげなく想起（Progress）させる機会はないか。
   - 読者の予想を裏切る展開（Twist）や、誤誘導（Red Herring）を仕込む余地はないか。
3. **文体**: 指定されたトーンから逸脱していないか。

【制約事項】
1. **断定禁止**: 「矛盾です」と言い切らず、「〜の可能性」「〜と齟齬があるように見受けられます」と述べてください。
2. **根拠（引用）の提示**: 指摘を行う場合、必ず「設定資料（Bible）のどの部分」と「本文のどの部分」が関わっているかを JSON の citations フィールドに明記してください。
3. **ルールIDの付与**: 指摘の種類に応じて ruleId (character_consistency, world_law, plot_hole, tone_shift, missed_opportunity 等) を設定してください。

【直近の執筆】
${lastChunk}

【コンテキスト】
${ctx}

JSONで返してください。
`.trim();

export const INTEGRITY_SCAN_PROMPT = (compactBible: string) => `
以下の設定データを横断的にスキャンし、論理的矛盾、未回収の伏線、キャラクター設定の破綻を抽出してください。

【チェックリスト】
1. **世界法則の遵守**: \`laws\` とキャラクターの行動/能力に矛盾はないか。
2. **タイムラインの因果**: 時間軸（timeline）において、原因より先に結果が来ていないか。
3. **伏線の状態**: 
   - \`status: Open\` のまま放置されている伏線はないか。
   - **Red Herring (ミスリード)** として設定された伏線が、最終的に真相解明（Payoff）によって「なぜそう見えたか」が説明可能になっているか。あるいは、未解決のまま放置され単なる矛盾（Plot Hole）になっていないか。
4. **キャラクターの一貫性**: \`motivation\` や \`traits\` と矛盾する行動をとっていないか。

【制約事項】
1. **断定禁止**: 「矛盾」と決めつけず「〜と〜が衝突している可能性があります」という論理的な推測として記述してください。
2. **根拠の提示**: 必ず Bible 内の具体的な記述を citations として引用してください。
3. **severity**: Low, Medium, High で重要度を分類してください。

【設定データ】
${compactBible}

JSONで返してください。
`.trim();

export const DETECTION_PROMPT = (userInput: string) => `
以下の発言を分析し、以下の情報を抽出してください。
発言: "${userInput}"

1. **hasChangeIntent**: 設定を変更・追加・削除しようとする意図があるか。
2. **isHypothetical**: それは「もしも〜だったら」という仮説・シミュレーションの話か。
3. **domains**: ENTITIES(人物), NARRATIVE(物語構成), FOUNDATION(世界の理)
4. **categories**: 具体的なカテゴリ
5. **instructionSummary**: AIへの指示要約

JSONで返してください。
`.trim();

export const DRAFT_PROMPT = (title: string, summary: string, beats: any[]) => `
章「${title}」の執筆を開始してください。
あらすじ: ${summary}
プロットビート: ${beats.map((b, i) => `${i + 1}. ${b.text}`).join('\n')}
`.trim();

/**
 * ビジュアルプロンプト生成プロンプト (IPフィルタリング付き)
 */
export const VISUAL_DESCRIPTION_PROMPT = (character: any, tone: string) => `
以下のキャラクター設定を元に、画像生成AIのための「具体的かつ詳細な外見記述」を英語で作成してください。

【キャラクター設定】
名前: ${character.name}
役割: ${character.role}
性格・特徴: ${character.traits?.join(', ')}
説明: ${character.description}
動機: ${character.motivation}
現在の内部状態: ${character.status?.internalState}
世界のトーン: ${tone}

【出力の制約事項 - 厳守】
1. **IP名・固有名称の禁止**: 特定の作家名、アニメスタジオ名、作品名、既存キャラクター名（例: Ghibli, Pixar, Disney, Makoto Shinkai, Naruto 等）を絶対に使用しないでください。
2. **具体的描写**: 顔の造形、髪の質感、瞳の色、衣服の素材、体格、そしてその人物の性格が滲み出るような表情やポーズを具体的に描写してください。
3. **ライティングと色彩**: 世界のトーンに合わせたライティング（例: cinematic lighting, soft morning sun, heavy shadows）を含めてください。
4. **出力形式**: 英語の段落（プロンプト）のみを出力してください。
`.trim();

export const PORTRAIT_PROMPT = (visualDescription: string) => `
A high-quality cinematic character portrait.
Appearance Details: ${visualDescription}
Art style: Semi-realistic, painterly, sophisticated textures, highly detailed. 
No text, no watermarks.
`.trim();

export const SYNC_EXTRACT_PROMPT = (history: any[], memory: string, summary: string, categories: string[], isHypothetical: boolean) => `
以下の対話から設定変更を抽出してください。
概要: ${summary}
モード: ${isHypothetical ? '【仮説・IF世界線】シミュレーションとして抽出してください' : '【正史・Canon】公式設定として抽出してください'}
カテゴリ: ${categories.join(', ')}

【操作の選択基準】
- **Laws (世界の理)** の更新: 全体的なルール変更の場合のみ \`path: 'laws'\` を使用。
- **Entries (用語集)** の更新: 特定の魔法、場所、歴史的事件などの「名詞」については、必ず \`path: 'entries'\` を使用。
- **Key Items (重要物品)** の更新: 物語の進行に関わる重要なアイテムの移動や状態変化は \`path: 'keyItems'\` を使用。 \`currentOwnerId\` の更新と \`history\` への追記を忘れないこと。
- **Foreshadowing (伏線)** の更新: 伏線の状態変化（例: Plant -> Twist）や新規追加がある場合は \`path: 'foreshadowing'\` を使用。TwistやRed Herringなどのアクションタイプを意識すること。章にリンクを追加する場合は \`chapters\` の \`foreshadowingLinks\` を更新します。
- 既存のIDを優先的に使い、新規名称は既存項目の aliases に追加することを検討してください。

【参照: 長期記憶 (過去の議論の要約)】
${memory || "なし"}

対話 (直近):
${JSON.stringify(history)}
`.trim();

export const DRAFT_SCAN_PROMPT = (draft: string, context: string) => `
あなたは物語の「編集者」兼「データ監査員」です。
以下の【執筆された本文】を読み、【現在の設定(Context)】と比較してください。
そして、本文中に新たに登場した要素や、既存設定の更新（例：キャラクターが怪我をした、新しい場所に移動した、新しい口癖など）を検出し、設定データベース（Bible）への変更操作（SyncOperation）を作成してください。

【執筆された本文】
"${draft}"

【現在の設定(Context)】
${context}

【抽出ルール】
1. **新規作成 (op: 'add')**: 設定に存在しない人物・場所・用語・アイテムが登場した場合。
2. **状態更新 (op: 'update')**: キャラクターの現在地(location)、健康状態(health)、心理状態(internalState)が変化した場合。
3. **重要アイテムの移動 (op: 'update' on keyItems)**: 誰かがアイテムを入手・喪失した場合。
4. **事実の更新**: 既存設定と異なる「新しい事実」が本文で確定した場合。

【除外事項】
- 設定変更を伴わない、単なる描写や会話は無視してください。
- 既存設定と完全に一致している情報は抽出しないでください。

JSON配列（SyncOperation[]）で返してください。
`.trim();

export const SUMMARY_BUFFER_PROMPT = (bibleJson: string) => `
以下の小説設定を、AIが今後の物語を執筆・推論するための「高密度インテリジェンス・バッファ」へ圧縮・統合してください。

【指示】
1. 冗長な装飾を削ぎ落とし、設定の「核（因果関係、重要事実）」のみを抽出してください。
2. キャラクター同士の関係性、未解決の葛藤、世界の「絶対に破ってはならないルール」を強調してください。
3. 進行中の主要なストーリーライン（グランドアークの進捗）を定義してください。
4. 自然言語ですが、AIが読み取りやすいキーワード指向の記述を心がけてください。

設定:
${bibleJson}
`.trim();

export const NEXUS_SIM_PROMPT = (hyp: string, ctx: string) => `
仮説: 「${hyp}」が起きた場合の世界線の分岐をシミュレーションせよ。
物理法則(Canon)への影響、キャラクターの運命の変転を記述してください。
コンテキスト: ${ctx}
`.trim();

export const NEXT_SENTENCE_PROMPT = (content: string, ctx: string) => `
文脈の異なる3つの続きを提案してください。
本文末尾: ${content.slice(-500)}
コンテキスト: ${ctx}
`.trim();

export const CHAPTER_PACKAGE_PROMPT = (title: string, summary: string, ctx: string) => `
章「${title}」の構造設計と初稿生成。
あらすじ: ${summary}
コンテキスト: ${ctx}
`.trim();

export const PROJECT_GEN_PROMPT = (theme: string) => `
テーマ「${theme}」に基づく初期設定生成。
`.trim();

export const SAFETY_ALTERNATIVES_PROMPT = (blockedPrompt: string, category: string) => `
ユーザーの以下の入力が、安全ポリシー（カテゴリ: ${category}）によりブロックされました。
物語の文脈を維持しつつ、安全ポリシーを遵守した上で創作を継続するための「婉曲表現」や「代替となる展開」を3つ提案してください。

入力内容:
"${blockedPrompt}"

【ガイドライン】
- 性的・過激・暴力的な直接描写を避け、文学的・象徴的な描写に置き換えてください。
- 特定の禁止ワードそのものを伏字にするのではなく、シーンの目的を別の形で達成する提案をしてください。

JSON形式（文字列の配列）で返してください。
`.trim();