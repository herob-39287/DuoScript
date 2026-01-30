import React from 'react';
import { Styles } from './Styles';

interface SectionHeaderProps {
  icon?: React.ReactNode;
  title: string;
  subtitle?: string;
  color?: string; // e.g. "text-orange-400"
  className?: string;
  action?: React.ReactNode;
}

export const SectionHeader: React.FC<SectionHeaderProps> = ({
  icon,
  title,
  subtitle,
  color = 'text-stone-600',
  className = '',
  action,
}) => (
  <div className={`flex items-end justify-between ${className}`}>
    <div className="flex flex-col gap-1">
      <div className={`${Styles.text.section} flex items-center gap-2 ${color}`}>
        {icon}
        <span>{title}</span>
      </div>
      {subtitle && <p className={Styles.text.bodySm}>{subtitle}</p>}
    </div>
    {action}
  </div>
);
