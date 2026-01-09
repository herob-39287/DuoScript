
import { AppLanguage } from "../types";

type TranslationKey = keyof typeof translations['en'];

export const translations = {
  ja: {
    // Welcome Screen
    "welcome.title": "物語のアトリエ",
    "welcome.subtitle": "物語を紡ぐための、静かなアトリエ",
    "welcome.continue": "続行または読み込み",
    "welcome.loading_projects": "書庫を確認中...",
    "welcome.no_projects": "アーカイブされた物語はありません",
    "welcome.load_backup": "バックアップを復元",
    "welcome.load_json": "JSONをロード",
    "welcome.start_new": "新しく物語を始める",
    "welcome.manual_title": "自由な構想",
    "welcome.manual_desc": "物語の題名",
    "welcome.manual_idea": "始まりのアイデア...",
    "welcome.enter_atelier": "アトリエに入る",
    "welcome.muse_title": "AI ミューズ",
    "welcome.muse_desc": "テーマを入力するだけで、AIがインスピレーションを形にし、初期設定を自動生成します。",
    "welcome.muse_placeholder": "テーマ (例: 記憶を売る喫茶店)",
    "welcome.muse_btn": "インスピレーションを得る",
    "welcome.guide": "アトリエガイドを表示",
    
    // Compliance
    "comp.title": "アトリエ入室プロトコル",
    "comp.subtitle": "データ管理とプライバシー設定",
    "comp.data_section": "データの保存と送信について",
    "comp.local_save": "保存（ローカル）",
    "comp.local_desc": "プロジェクトデータ、キャラクター設定、執筆中の原稿は、お使いの端末（IndexedDB）にのみ保存されます。",
    "comp.api_send": "送信（Gemini API）",
    "comp.api_desc": "推論、執筆、画像生成のため、必要なテキストデータがGoogle Gemini APIへ送信されます。",
    "comp.scope_section": "AIへの送信範囲",
    "comp.safety_section": "創作セーフティ・プリセット",
    "comp.agree": "私はデータの取り扱いと設定内容を理解し、同意します",
    "comp.enter": "設定を保存してアトリエに入る",
    "comp.ui_lang": "インターフェース言語",
    "comp.story_lang": "物語の言語 (AI生成)",

    // Common
    "common.cancel": "キャンセル",
    "common.confirm": "確認",
    "common.close": "閉じる",
    "common.save": "保存",
    "common.delete": "削除",
    "common.edit": "編集",
    "common.back": "戻る",
    "common.loading": "読み込み中...",
    "common.error": "エラー",
  },
  en: {
    // Welcome Screen
    "welcome.title": "Story Atelier",
    "welcome.subtitle": "A quiet atelier for weaving stories",
    "welcome.continue": "Continue or Load",
    "welcome.loading_projects": "Checking archives...",
    "welcome.no_projects": "No archived stories found",
    "welcome.load_backup": "Restore Backup",
    "welcome.load_json": "Load JSON",
    "welcome.start_new": "Start New Story",
    "welcome.manual_title": "Free Creation",
    "welcome.manual_desc": "Story Title",
    "welcome.manual_idea": "Initial Idea...",
    "welcome.enter_atelier": "Enter Atelier",
    "welcome.muse_title": "AI Muse",
    "welcome.muse_desc": "Enter a theme, and AI will shape your inspiration and generate initial settings.",
    "welcome.muse_placeholder": "Theme (e.g., A cafe that sells memories)",
    "welcome.muse_btn": "Get Inspiration",
    "welcome.guide": "Show Atelier Guide",

    // Compliance
    "comp.title": "Atelier Protocol",
    "comp.subtitle": "Data Management & Privacy Settings",
    "comp.data_section": "Data Storage & Transmission",
    "comp.local_save": "Storage (Local)",
    "comp.local_desc": "Project data, character settings, and drafts are stored ONLY on your device (IndexedDB).",
    "comp.api_send": "Transmission (Gemini API)",
    "comp.api_desc": "Necessary text data is sent to Google Gemini API for reasoning, writing, and image generation.",
    "comp.scope_section": "AI Context Scope",
    "comp.safety_section": "Creative Safety Preset",
    "comp.agree": "I understand and agree to the data handling and settings",
    "comp.enter": "Save Settings & Enter",
    "comp.ui_lang": "Interface Language",
    "comp.story_lang": "Story Language (AI Output)",

    // Common
    "common.cancel": "Cancel",
    "common.confirm": "Confirm",
    "common.close": "Close",
    "common.save": "Save",
    "common.delete": "Delete",
    "common.edit": "Edit",
    "common.back": "Back",
    "common.loading": "Loading...",
    "common.error": "Error",
  }
};

export const t = (key: string, lang: AppLanguage = 'ja'): string => {
  const dict = translations[lang] as Record<string, string>;
  return dict[key] || key;
};
