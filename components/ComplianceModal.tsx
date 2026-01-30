import React, { useState } from 'react';
import {
  ShieldCheck,
  FileText,
  Database,
  Send,
  Lock,
  Zap,
  Globe,
  Sparkles,
  UserCheck,
  Key,
  AlertTriangle,
} from 'lucide-react';
import { AppPreferences, TransmissionScope, SafetyPreset, AiPersona } from '../types';
import { t } from '../utils/i18n';

interface Props {
  onAccept: (prefs: AppPreferences) => void;
}

const ComplianceModal: React.FC<Props> = ({ onAccept }) => {
  const [prefs, setPrefs] = useState<AppPreferences>({
    uiLanguage: 'ja',
    transmissionScope: TransmissionScope.FULL,
    safetyPreset: SafetyPreset.MATURE,
    aiPersona: AiPersona.STANDARD,
    allowSearch: true,
    whisperSensitivity: 50,
    disabledLinterRules: [],
  });

  const lang = prefs.uiLanguage;

  return (
    <div className="fixed inset-0 z-[500] bg-stone-950/95 backdrop-blur-3xl flex items-center justify-center p-4 md:p-6 animate-fade-in overflow-y-auto">
      <div className="bg-stone-900 w-full max-w-3xl rounded-[2rem] md:rounded-[3rem] border border-stone-800 shadow-[0_50px_100px_-20px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col max-h-[95vh] md:max-h-[90vh]">
        <div className="p-6 md:p-10 border-b border-stone-800 bg-stone-900/50 flex items-center gap-6">
          <div className="p-3 md:p-4 bg-orange-600 rounded-2xl text-white shadow-xl shadow-orange-900/20">
            <ShieldCheck size={32} className="md:w-8 md:h-8 w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl md:text-3xl font-black text-white italic tracking-tighter uppercase">
              {t('comp.title', lang)}
            </h2>
            <p className="text-stone-500 font-medium text-xs md:text-sm">
              {t('comp.subtitle', lang)}
            </p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 md:p-10 space-y-8 md:space-y-10 custom-scrollbar">
          {/* Language Settings */}
          <section className="space-y-4">
            <h3 className="text-[10px] md:text-xs font-black text-orange-400 uppercase tracking-[0.2em] flex items-center gap-2">
              <Globe size={14} /> {t('comp.ui_lang', lang)}
            </h3>
            <div className="flex gap-3">
              <button
                onClick={() => setPrefs({ ...prefs, uiLanguage: 'ja' })}
                className={`flex-1 p-3 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-all ${prefs.uiLanguage === 'ja' ? 'bg-orange-600/10 border-orange-500/40 text-orange-400' : 'bg-stone-950/40 border-white/5 text-stone-500'}`}
              >
                日本語
              </button>
              <button
                onClick={() => setPrefs({ ...prefs, uiLanguage: 'en' })}
                className={`flex-1 p-3 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-all ${prefs.uiLanguage === 'en' ? 'bg-orange-600/10 border-orange-500/40 text-orange-400' : 'bg-stone-950/40 border-white/5 text-stone-500'}`}
              >
                English
              </button>
            </div>
          </section>

          {/* API Key Security Warning */}
          <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex gap-3">
            <div className="p-2 bg-amber-500/20 rounded-xl text-amber-500 shrink-0 h-fit">
              <AlertTriangle size={20} />
            </div>
            <div className="space-y-1">
              <h4 className="text-[10px] font-black text-amber-400 uppercase tracking-widest flex items-center gap-2">
                {t('comp.apikey_warning_title', lang)}
              </h4>
              <p className="text-[10px] md:text-[11px] text-amber-100/80 font-serif leading-relaxed">
                {t('comp.apikey_warning_desc', lang)}
              </p>
            </div>
          </div>

          {/* AI Persona Section */}
          <section className="space-y-4">
            <h3 className="text-[10px] md:text-xs font-black text-orange-400 uppercase tracking-[0.2em] flex items-center gap-2">
              <UserCheck size={14} /> AI Partner Personality
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <PersonaCard
                active={prefs.aiPersona === AiPersona.STANDARD}
                onClick={() => setPrefs({ ...prefs, aiPersona: AiPersona.STANDARD })}
                label="Standard (標準)"
                desc={
                  lang === 'ja'
                    ? 'バランスの取れた伴走者。設定を遵守し、適度に提案します。'
                    : 'Balanced companion. Adheres to settings and proposes moderately.'
                }
              />
              <PersonaCard
                active={prefs.aiPersona === AiPersona.STRICT}
                onClick={() => setPrefs({ ...prefs, aiPersona: AiPersona.STRICT })}
                label="Strict Editor (鬼編集)"
                desc={
                  lang === 'ja'
                    ? '論理的矛盾を厳しく指摘。品質重視のストイックなパートナー。'
                    : 'Strictly points out logical contradictions. Quality-focused.'
                }
              />
              <PersonaCard
                active={prefs.aiPersona === AiPersona.GENTLE}
                onClick={() => setPrefs({ ...prefs, aiPersona: AiPersona.GENTLE })}
                label="Gentle Muse (全肯定)"
                desc={
                  lang === 'ja'
                    ? 'あなたのアイデアを全て肯定し、優しくモチベーションを支えます。'
                    : 'Affirms all your ideas and gently supports motivation.'
                }
              />
              <PersonaCard
                active={prefs.aiPersona === AiPersona.CREATIVE}
                onClick={() => setPrefs({ ...prefs, aiPersona: AiPersona.CREATIVE })}
                label="Wild Ideas (拡散思考)"
                desc={
                  lang === 'ja'
                    ? '整合性より面白さ優先。突飛で斬新なアイデアを提案します。'
                    : 'Prioritizes fun over consistency. Proposes wild ideas.'
                }
              />
            </div>
          </section>

          {/* Transmission Scope Section */}
          <section className="space-y-4">
            <h3 className="text-[10px] md:text-xs font-black text-orange-400 uppercase tracking-[0.2em] flex items-center gap-2">
              <FileText size={14} /> {t('comp.scope_section', lang)}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <ScopeCard
                active={prefs.transmissionScope === TransmissionScope.FULL}
                onClick={() => setPrefs({ ...prefs, transmissionScope: TransmissionScope.FULL })}
                label="Full Context"
                desc={
                  lang === 'ja'
                    ? '全てのプロットと設定をAIに共有し、最高の整合性を維持します。'
                    : 'Shares all plots and settings with AI to maintain maximum consistency.'
                }
              />
              <ScopeCard
                active={prefs.transmissionScope === TransmissionScope.SUMMARY}
                onClick={() => setPrefs({ ...prefs, transmissionScope: TransmissionScope.SUMMARY })}
                label="Summary Only"
                desc={
                  lang === 'ja'
                    ? '要約と最小限のキャラクター情報のみ共有し、プライバシーを保護します。'
                    : 'Shares only summaries and minimal character info to protect privacy.'
                }
              />
            </div>
          </section>

          {/* Safety Presets Section */}
          <section className="space-y-4">
            <h3 className="text-[10px] md:text-xs font-black text-orange-400 uppercase tracking-[0.2em] flex items-center gap-2">
              <Zap size={14} /> {t('comp.safety_section', lang)}
            </h3>
            <div className="flex flex-col md:flex-row gap-3">
              <PresetBtn
                active={prefs.safetyPreset === SafetyPreset.STRICT}
                onClick={() => setPrefs({ ...prefs, safetyPreset: SafetyPreset.STRICT })}
                label="Strict"
                sub={lang === 'ja' ? '一般向け' : 'General'}
                desc={lang === 'ja' ? '安全性最優先' : 'Safety First'}
              />
              <PresetBtn
                active={prefs.safetyPreset === SafetyPreset.MATURE}
                onClick={() => setPrefs({ ...prefs, safetyPreset: SafetyPreset.MATURE })}
                label="Mature"
                sub={lang === 'ja' ? '文学・創作' : 'Literature'}
                desc={lang === 'ja' ? 'ドラマ性を許容' : 'Allow Drama'}
              />
              <PresetBtn
                active={prefs.safetyPreset === SafetyPreset.CREATIVE}
                onClick={() => setPrefs({ ...prefs, safetyPreset: SafetyPreset.CREATIVE })}
                label="Creative"
                sub={lang === 'ja' ? '無制限' : 'Unrestricted'}
                desc={lang === 'ja' ? '表現の自由を重視' : 'Freedom'}
              />
            </div>
          </section>
        </div>

        <div className="p-6 md:p-10 border-t border-stone-800 bg-stone-900/50 flex flex-col gap-6">
          <div className="flex items-center gap-3">
            <div className="w-5 h-5 rounded bg-orange-600 flex items-center justify-center text-white">
              <ShieldCheck size={12} />
            </div>
            <p className="text-[10px] text-stone-500 font-black uppercase tracking-widest">
              {t('comp.agree', lang)}
            </p>
          </div>
          <button
            onClick={() => onAccept(prefs)}
            className="w-full py-5 bg-orange-600 text-white font-black rounded-2xl shadow-2xl shadow-orange-900/40 hover:bg-orange-500 transition-all active:scale-[0.98] text-xs uppercase tracking-[0.2em]"
          >
            {t('comp.enter', lang)}
          </button>
        </div>
      </div>
    </div>
  );
};

const ScopeCard = ({
  active,
  onClick,
  label,
  desc,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  desc: string;
}) => (
  <button
    onClick={onClick}
    className={`p-5 text-left rounded-2xl border transition-all space-y-2 ${active ? 'bg-orange-600/10 border-orange-500/40' : 'bg-stone-950/40 border-white/5 hover:border-white/10'}`}
  >
    <div
      className={`text-[10px] font-black uppercase tracking-widest ${active ? 'text-orange-400' : 'text-stone-500'}`}
    >
      {label}
    </div>
    <p className="text-[10px] text-stone-400 leading-relaxed font-serif">{desc}</p>
  </button>
);

const PersonaCard = ({
  active,
  onClick,
  label,
  desc,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  desc: string;
}) => (
  <button
    onClick={onClick}
    className={`p-4 text-left rounded-2xl border transition-all space-y-2 ${active ? 'bg-indigo-600/10 border-indigo-500/40' : 'bg-stone-950/40 border-white/5 hover:border-white/10'}`}
  >
    <div
      className={`text-[10px] font-black uppercase tracking-widest flex items-center gap-2 ${active ? 'text-indigo-400' : 'text-stone-500'}`}
    >
      <Sparkles size={12} />
      {label}
    </div>
    <p className="text-[10px] text-stone-400 leading-relaxed font-serif">{desc}</p>
  </button>
);

const PresetBtn = ({
  active,
  onClick,
  label,
  sub,
  desc,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  sub: string;
  desc: string;
}) => (
  <button
    onClick={onClick}
    className={`flex-1 p-4 rounded-2xl border transition-all text-center ${active ? 'bg-orange-600/10 border-orange-500/40' : 'bg-stone-950/40 border-white/5 hover:border-white/10'}`}
  >
    <div
      className={`text-[11px] font-black uppercase tracking-widest ${active ? 'text-orange-400' : 'text-stone-300'}`}
    >
      {label}
    </div>
    <div className="text-[8px] font-black text-stone-500 uppercase mt-0.5">{sub}</div>
    <div className="text-[9px] text-stone-600 mt-2 font-serif">{desc}</div>
  </button>
);

export default ComplianceModal;
