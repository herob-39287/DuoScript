
import React from 'react';

type CardVariant = 'glass' | 'glass-bright' | 'panel' | 'outline' | 'ghost';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

export const Card: React.FC<CardProps> = ({ 
  variant = 'panel', 
  padding = 'md', 
  children, 
  className = '', 
  ...props 
}) => {
  const baseStyles = "transition-all relative overflow-hidden";
  
  const variants = {
    glass: "glass", 
    "glass-bright": "glass-bright",
    panel: "bg-stone-900/40 border border-white/5",
    outline: "border border-dashed border-stone-800 bg-transparent",
    ghost: "bg-transparent border border-transparent"
  };

  const paddings = {
    none: "",
    sm: "p-3",
    md: "p-4 md:p-6",
    lg: "p-6 md:p-10"
  };

  const defaultRounding = className.includes('rounded-') ? '' : 'rounded-[1.5rem] md:rounded-[2rem]';

  return (
    <div className={`${baseStyles} ${variants[variant]} ${paddings[padding]} ${defaultRounding} ${className}`} {...props}>
      {children}
    </div>
  );
};
