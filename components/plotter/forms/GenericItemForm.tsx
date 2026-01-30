import React, { useState } from 'react';
import { Plus, X, Loader2, Wand2 } from 'lucide-react';
import { FieldSchema, ItemType, SCHEMAS } from '../../../services/schema/definitions';
import { useMetadata } from '../../../contexts/StoryContext';
import { t } from '../../../utils/i18n';

type ContextEntry = { id: string; name?: string; title?: string };

export interface ContextData {
  locations?: ContextEntry[];
  organizations?: ContextEntry[];
  chapters?: ContextEntry[];
  characters?: ContextEntry[];
  items?: ContextEntry[];
  [key: string]: ContextEntry[] | undefined;
}

interface GenericItemFormProps {
  type: ItemType;
  data: any;
  context: ContextData;
  onChange: (key: string, value: any) => void;
  onAutoFill: (fieldKey: string, fieldLabel: string) => void;
  loadingField: string | null;
}

const AutoFillButton = ({ onClick, isLoading }: { onClick: () => void; isLoading: boolean }) => (
  <button
    onClick={(e) => {
      e.preventDefault();
      onClick();
    }}
    disabled={isLoading}
    className="absolute top-1.5 right-2 p-1.5 bg-stone-800 hover:bg-indigo-600 text-stone-500 hover:text-white rounded-lg transition-all opacity-0 group-hover:opacity-100 disabled:opacity-100 focus:opacity-100"
    title="AI Auto-Fill"
  >
    {isLoading ? (
      <Loader2 size={12} className="animate-spin text-indigo-400" />
    ) : (
      <Wand2 size={12} />
    )}
  </button>
);

export const GenericItemForm: React.FC<GenericItemFormProps> = ({
  type,
  data,
  context,
  onChange,
  onAutoFill,
  loadingField,
}) => {
  const schema = SCHEMAS[type];
  const {
    preferences: { uiLanguage },
  } = useMetadata();

  if (!schema) return <div className="text-stone-500">No schema found for {type}</div>;

  const renderField = (
    field: FieldSchema,
    currentValue: any,
    handleChange: (val: any) => void,
    pathPrefix: string,
  ) => {
    const fieldKey = `${pathPrefix}${field.key}`;
    const isLoading = loadingField === fieldKey;
    const label = t(field.labelKey, uiLanguage);

    if (field.type === 'subform') {
      const items = Array.isArray(currentValue) ? currentValue : [];

      const handleAddItem = () => {
        const newItem: any = {};
        field.subFields?.forEach((sf) => (newItem[sf.key] = sf.type === 'number' ? 0 : ''));
        handleChange([...items, newItem]);
      };

      const handleRemoveItem = (index: number) => {
        const updated = [...items];
        updated.splice(index, 1);
        handleChange(updated);
      };

      const handleUpdateItem = (index: number, subKey: string, val: any) => {
        const updated = [...items];
        updated[index] = { ...updated[index], [subKey]: val };
        handleChange(updated);
      };

      return (
        <div key={field.key} className="space-y-3 pt-2 border-t border-white/5 mt-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black text-stone-500 uppercase tracking-widest">
              {label}
            </span>
            <button
              onClick={handleAddItem}
              type="button"
              className="text-orange-400 hover:text-white flex items-center gap-1 text-[9px] font-black uppercase transition-colors"
            >
              <Plus size={12} /> {t('common.add', uiLanguage)}
            </button>
          </div>
          <div className="space-y-3">
            {items.map((item: any, idx: number) => (
              <div
                key={idx}
                className="p-3 bg-stone-950/30 border border-white/5 rounded-xl space-y-3 relative"
              >
                {field.subFields?.map((subField) => (
                  <div key={subField.key}>
                    {renderField(
                      subField,
                      item[subField.key],
                      (val) => handleUpdateItem(idx, subField.key, val),
                      `${fieldKey}.${idx}.`,
                    )}
                  </div>
                ))}
                <button
                  onClick={() => handleRemoveItem(idx)}
                  className="absolute -top-2 -right-2 p-1 bg-stone-800 text-stone-500 hover:text-rose-400 rounded-full shadow-lg border border-stone-700 transition-colors"
                >
                  <X size={12} />
                </button>
              </div>
            ))}
            {items.length === 0 && (
              <div className="text-center text-stone-600 text-[10px] py-2 italic border border-dashed border-stone-800 rounded-lg">
                List is empty
              </div>
            )}
          </div>
        </div>
      );
    }

    const wrapperClass = 'space-y-1 relative group';
    const labelClass = 'text-[10px] font-black text-stone-500 uppercase tracking-widest';
    const inputClass =
      'w-full bg-stone-950 border border-white/10 rounded-xl px-3 py-2 text-xs md:text-sm text-stone-200 outline-none focus:border-orange-500/50 transition-all placeholder:text-stone-700';

    if (field.type === 'select') {
      let options = field.options || [];
      if (field.source) {
        const sourceList = context[field.source] ?? [];
        options = sourceList.map((item) => item.id);
      }

      return (
        <div key={field.key} className={wrapperClass}>
          <label className={labelClass}>{label}</label>
          <div className="relative">
            <select
              value={currentValue || ''}
              onChange={(e) => handleChange(e.target.value)}
              className={`${inputClass} appearance-none`}
            >
              <option value="">Select...</option>
              {field.source
                ? (context[field.source] ?? []).map((opt) => (
                    <option key={opt.id} value={opt.id}>
                      {'title' in opt ? opt.title : opt.name}
                    </option>
                  ))
                : options.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
            </select>
            <div className="absolute right-3 top-2.5 pointer-events-none text-stone-600">▼</div>
          </div>
        </div>
      );
    }

    if (field.type === 'textarea') {
      return (
        <div key={field.key} className={wrapperClass}>
          <label className={labelClass}>{label}</label>
          <div className="relative">
            <textarea
              value={currentValue || ''}
              onChange={(e) => handleChange(e.target.value)}
              placeholder={field.placeholder}
              rows={field.minRows || 3}
              className={`${inputClass} resize-none`}
            />
            {field.autoFillHint && (
              <AutoFillButton
                onClick={() => onAutoFill(field.key, field.autoFillHint!)}
                isLoading={isLoading}
              />
            )}
          </div>
        </div>
      );
    }

    if (field.type === 'array') {
      const displayValue = Array.isArray(currentValue)
        ? currentValue.join(', ')
        : currentValue || '';
      const handleArrayChange = (val: string) => {
        const arr = val
          .split(/,|、/)
          .map((s) => s.trim())
          .filter(Boolean);
        handleChange(arr);
      };

      return (
        <div key={field.key} className={wrapperClass}>
          <label className={labelClass}>{label}</label>
          <div className="relative">
            <input
              type="text"
              value={displayValue}
              onChange={(e) => handleArrayChange(e.target.value)}
              placeholder={field.placeholder}
              className={inputClass}
            />
            {field.autoFillHint && (
              <AutoFillButton
                onClick={() => onAutoFill(field.key, field.autoFillHint!)}
                isLoading={isLoading}
              />
            )}
          </div>
        </div>
      );
    }

    if (field.type === 'number') {
      return (
        <div key={field.key} className={wrapperClass}>
          <label className={labelClass}>{label}</label>
          <input
            type="number"
            value={currentValue || 0}
            onChange={(e) => handleChange(Number(e.target.value))}
            placeholder={field.placeholder}
            className={inputClass}
          />
        </div>
      );
    }

    return (
      <div key={field.key} className={wrapperClass}>
        <label className={labelClass}>{label}</label>
        <div className="relative">
          <input
            type="text"
            value={currentValue || ''}
            onChange={(e) => handleChange(e.target.value)}
            placeholder={field.placeholder}
            className={inputClass}
          />
          {field.autoFillHint && (
            <AutoFillButton
              onClick={() => onAutoFill(field.key, field.autoFillHint!)}
              isLoading={isLoading}
            />
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {schema.map((field) =>
        renderField(field, data[field.key], (val) => onChange(field.key, val), ''),
      )}
    </div>
  );
};
