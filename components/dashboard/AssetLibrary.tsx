import React, { useState, useEffect } from 'react';
import { Image as ImageIcon, Trash2, Loader2 } from 'lucide-react';
import { Card, SectionHeader } from '../ui/DesignSystem';
import { AssetMetadata } from '../../types';
import { getPortrait } from '../../services/storageService';
import { t } from '../../utils/i18n';
import { AppLanguage } from '../../types';

interface AssetLibraryProps {
  assets: AssetMetadata[];
  onDeleteAsset: (id: string) => void;
  lang: AppLanguage;
}

const AssetThumbnail: React.FC<{ asset: AssetMetadata; onDelete: () => void }> = ({
  asset,
  onDelete,
}) => {
  const [data, setData] = useState<string | null>(null);

  useEffect(() => {
    getPortrait(asset.id).then(setData);
  }, [asset.id]);

  return (
    <div className="relative group aspect-square rounded-xl overflow-hidden bg-stone-900 border border-white/5 shadow-lg">
      {data ? (
        <img
          src={data}
          className="w-full h-full object-cover transition-transform group-hover:scale-110"
          alt="portrait asset"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center text-stone-800">
          <Loader2 size={14} className="animate-spin" />
        </div>
      )}
      <div className="absolute inset-0 bg-stone-950/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2">
        <button
          onClick={onDelete}
          className="p-2 bg-rose-600 text-white rounded-full hover:bg-rose-500 transition-colors shadow-xl"
        >
          <Trash2 size={12} />
        </button>
      </div>
    </div>
  );
};

export const AssetLibrary: React.FC<AssetLibraryProps> = ({ assets, onDeleteAsset, lang }) => {
  return (
    <Card variant="glass" padding="lg" className="space-y-6 md:space-y-8 mx-1 min-w-0">
      <SectionHeader
        icon={<ImageIcon size={20} className="text-orange-400" />}
        title={t('dashboard.assets_library', lang)}
      />
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-3 md:gap-4">
        {assets.length === 0 ? (
          <div className="col-span-full py-8 text-center text-stone-700 italic font-serif border border-dashed border-stone-800 rounded-2xl">
            Empty
          </div>
        ) : (
          assets.map((asset) => (
            <AssetThumbnail key={asset.id} asset={asset} onDelete={() => onDeleteAsset(asset.id)} />
          ))
        )}
      </div>
    </Card>
  );
};
