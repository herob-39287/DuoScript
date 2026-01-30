import React from 'react';
import { MessageSquare, Edit2, Trash2, Plus } from 'lucide-react';
import { SectionHeader } from '../../ui/DesignSystem';

interface WorldSectionProps {
  title: string;
  icon: React.ReactNode;
  items: any[];
  renderItem: (item: any) => React.ReactNode;
  compact?: boolean;
  onConsult?: (item: any) => void;
  onAdd?: () => void;
  onEdit?: (item: any) => void;
  onDelete?: (item: any) => void;
}

export const WorldSection: React.FC<WorldSectionProps> = ({
  title,
  icon,
  items,
  renderItem,
  compact = false,
  onConsult,
  onAdd,
  onEdit,
  onDelete,
}) => (
  <div className="space-y-4">
    <SectionHeader
      icon={icon}
      title={title}
      action={
        onAdd && (
          <button
            onClick={onAdd}
            className="p-1.5 bg-stone-800 hover:bg-orange-600 hover:text-white text-stone-500 rounded-lg transition-all"
            title="新規追加"
          >
            <Plus size={14} />
          </button>
        )
      }
    />
    <div className={`grid ${compact ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2'} gap-3`}>
      {items.length === 0 ? (
        <div className="col-span-full p-4 border border-dashed border-stone-800 rounded-xl text-center text-stone-600 text-[10px]">
          データがありません
        </div>
      ) : (
        items.map((item, i) => (
          <div
            key={item.id || i}
            className={`relative group p-3 bg-stone-900/40 border border-white/5 rounded-xl hover:border-orange-500/20 transition-colors ${compact ? 'flex items-center gap-2' : 'space-y-1'}`}
          >
            {renderItem(item)}

            <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
              {onEdit && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onEdit(item);
                  }}
                  className="p-1.5 bg-stone-800 text-stone-500 hover:bg-stone-700 hover:text-white rounded-lg shadow-lg"
                  title="編集"
                >
                  <Edit2 size={12} />
                </button>
              )}
              {onDelete && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(item);
                  }}
                  className="p-1.5 bg-stone-800 text-stone-500 hover:bg-rose-600 hover:text-white rounded-lg shadow-lg"
                  title="削除"
                >
                  <Trash2 size={12} />
                </button>
              )}
              {onConsult && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onConsult(item);
                  }}
                  className="p-1.5 bg-stone-800 text-stone-500 hover:bg-orange-600 hover:text-white rounded-lg shadow-lg"
                  title="設計士に相談"
                >
                  <MessageSquare size={12} />
                </button>
              )}
            </div>
          </div>
        ))
      )}
    </div>
  </div>
);
