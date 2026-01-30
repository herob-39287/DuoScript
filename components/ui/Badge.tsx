import React from 'react';
import { cva, type VariantProps } from './variants';
import { cn } from './utils';
import { Styles } from './Styles';

const badgeVariants = cva(`px-2 py-0.5 rounded ${Styles.text.labelSm}`, {
  variants: {
    color: {
      orange: 'bg-accent text-accent-foreground',
      emerald: 'bg-emerald-500/10 text-emerald-400',
      rose: 'bg-destructive-muted text-destructive-text',
      indigo: 'bg-indigo-muted text-indigo-foreground',
      amber: 'bg-amber-500/10 text-amber-400',
      stone: 'bg-secondary text-muted-foreground',
    },
  },
  defaultVariants: {
    color: 'stone',
  },
});

export interface BadgeProps
  extends Omit<React.HTMLAttributes<HTMLSpanElement>, 'color'>,
    VariantProps<typeof badgeVariants> {}

export const Badge: React.FC<BadgeProps> = ({ color, children, className, ...props }) => {
  return (
    <span className={cn(badgeVariants({ color, className }))} {...props}>
      {children}
    </span>
  );
};
