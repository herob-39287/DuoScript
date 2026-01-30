import React from 'react';
import { getFieldLabelKey } from '../../services/schema/definitions';
import { t } from '../../utils/i18n';
import { AppLanguage } from '../../types';

export const translateKey = (key: string, lang: AppLanguage) => {
  const labelKey = getFieldLabelKey(key);
  if (labelKey) return t(labelKey, lang);

  // Fallback for known system keys not in schemas
  const systemKeys: Record<string, string> =
    lang === 'ja'
      ? {
          id: 'ID',
          profile: 'プロフィール',
          state: '状態',
          relationships: '人間関係',
          internalState: '心理状態',
          currentGoal: '目的',
          location: '現在地',
          health: '健康状態',
          socialStanding: '社会的地位',
          voice: '口調',
          setting: '舞台設定',
          tone: 'トーン',
          grandArc: 'グランドアーク',
        }
      : {
          id: 'ID',
          profile: 'Profile',
          state: 'State',
          relationships: 'Relationships',
          internalState: 'Internal State',
          currentGoal: 'Current Goal',
          location: 'Location',
          health: 'Health',
          socialStanding: 'Social Standing',
          voice: 'Voice',
          setting: 'Setting',
          tone: 'Tone',
          grandArc: 'Grand Arc',
        };

  return systemKeys[key] || key;
};

export const ValueRenderer: React.FC<{
  value: any;
  depth?: number;
  resolver?: (id: string) => string | undefined;
  currentKey?: string;
  lang: AppLanguage;
}> = ({ value, depth = 0, resolver, currentKey, lang }) => {
  if (value === null || value === undefined)
    return <span className="text-stone-600 italic">---</span>;

  if (Array.isArray(value)) {
    if (value.length === 0)
      return <span className="text-stone-600 italic text-[10px]">(None)</span>;

    // String/Number Array
    if (value.every((v) => typeof v === 'string' || typeof v === 'number')) {
      const shouldResolve =
        resolver &&
        currentKey &&
        [
          'relatedEntityIds',
          'involvedCharacterIds',
          'associatedCharacterIds',
          'memberIds',
        ].includes(currentKey);

      return (
        <div className="flex flex-wrap gap-1">
          {value.map((v, i) => {
            const label = shouldResolve ? resolver(String(v)) || v : v;
            return (
              <span
                key={i}
                className="px-1.5 py-0.5 bg-stone-800 rounded text-[9px] text-stone-300 border border-white/5"
              >
                {label}
              </span>
            );
          })}
        </div>
      );
    }

    // Object Array (Small, e.g. relationships)
    if (value.length <= 5 && typeof value[0] === 'object') {
      return (
        <div className="space-y-1.5">
          {value.map((v: any, i: number) => (
            <div key={i} className="p-2 bg-stone-950/30 rounded border border-white/5">
              <ValueRenderer value={v} depth={depth + 1} resolver={resolver} lang={lang} />
            </div>
          ))}
        </div>
      );
    }

    return (
      <span className="text-[10px] font-mono text-stone-500">[List ({value.length} items)]</span>
    );
  }

  if (typeof value === 'object') {
    return (
      <div
        className={`grid grid-cols-1 gap-y-2 ${depth > 0 ? 'pl-2 border-l border-white/10 mt-1' : ''}`}
      >
        {Object.entries(value).map(([k, v]) => {
          // Filter internal fields
          if (['id', 'history', 'updatedAt', 'lastChangedAt', 'createdAt'].includes(k)) return null;
          if (typeof v === 'object' && v !== null && Object.keys(v).length === 0) return null;

          return (
            <div key={k} className="group">
              <div className="text-[9px] font-black text-stone-500 uppercase tracking-widest mb-0.5 flex items-center gap-2">
                {translateKey(k, lang)}
              </div>
              <div className="text-[11px] md:text-[12px] text-stone-300 leading-relaxed font-serif">
                <ValueRenderer
                  value={v}
                  depth={depth + 1}
                  resolver={resolver}
                  currentKey={k}
                  lang={lang}
                />
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  // Handle single ID resolution for specific keys like targetId
  const idKeys = ['targetId', 'targetCharacterId', 'targetLocationId', 'targetOrganizationId'];
  if (resolver && currentKey && idKeys.includes(currentKey) && typeof value === 'string') {
    const name = resolver(value);
    if (name)
      return (
        <span className="whitespace-pre-wrap text-emerald-400 font-bold" title={value}>
          {name}
        </span>
      );
  }

  return <span className="whitespace-pre-wrap text-stone-300">{String(value)}</span>;
};
