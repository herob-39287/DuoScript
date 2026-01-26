import React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from './utils';

const cardVariants = cva(
  "transition-all relative overflow-hidden",
  {
    variants: {
      variant: {
        glass: "glass",
        "glass-bright": "glass-bright",
        panel: "bg-stone-900/40 border border-white/5",
        outline: "border border-dashed border-stone-800 bg-transparent",
        ghost: "bg-transparent border border-transparent"
      },
      padding: {
        none: "",
        sm: "p-3",
        md: "p-4 md:p-6",
        lg: "p-6 md:p-10"
      },
      radius: {
        default: "rounded-[1.5rem] md:rounded-[2rem]",
        none: "",
        sm: "rounded-xl"
      }
    },
    defaultVariants: {
      variant: "panel",
      padding: "md",
      radius: "default"
    }
  }
);

export interface CardProps 
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof cardVariants> {
}

export const Card: React.FC<CardProps> = ({ 
  variant, 
  padding, 
  radius,
  children, 
  className, 
  ...props 
}) => {
  return (
    <div className={cn(cardVariants({ variant, padding, radius, className }))} {...props}>
      {children}
    </div>
  );
};
