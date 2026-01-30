import React from 'react';
import { Loader2 } from 'lucide-react';
import { cva, type VariantProps } from './variants';
import { cn } from './utils';

const buttonVariants = cva(
  'font-black uppercase tracking-widest transition-all active:scale-95 flex items-center justify-center gap-2 rounded-xl disabled:opacity-50 disabled:pointer-events-none focus:outline-none focus:ring-2 focus:ring-primary/50',
  {
    variants: {
      variant: {
        primary:
          'bg-primary text-primary-foreground hover:bg-primary-hover shadow-xl shadow-primary/20',
        secondary:
          'bg-secondary text-secondary-foreground hover:text-white hover:bg-secondary-hover',
        ghost: 'bg-transparent text-muted-foreground hover:text-foreground hover:bg-white/5',
        danger:
          'bg-secondary text-destructive-text hover:bg-destructive-muted hover:text-destructive',
        indigo:
          'bg-indigo-DEFAULT text-white hover:bg-indigo-hover shadow-xl shadow-indigo-DEFAULT/20',
        outline:
          'border border-stone-700 text-muted-foreground hover:border-primary hover:text-primary bg-transparent',
        dashed:
          'border border-dashed border-stone-800 text-muted-foreground hover:text-primary hover:border-primary/30',
      },
      size: {
        xs: 'text-[10px] py-1.5 px-3',
        sm: 'text-[11px] py-2 px-4',
        md: 'text-xs py-3 px-6',
        lg: 'text-sm py-4 px-8',
        icon: 'p-3 w-10 h-10 md:w-12 md:h-12',
        'icon-sm': 'p-2 w-8 h-8',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  isLoading?: boolean;
  icon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  className,
  variant,
  size,
  isLoading,
  icon,
  children,
  disabled,
  ...props
}) => {
  return (
    <button
      className={cn(buttonVariants({ variant, size, className }))}
      disabled={isLoading || disabled}
      {...props}
    >
      {isLoading ? <Loader2 size={16} className="animate-spin" /> : icon}
      {children}
    </button>
  );
};
