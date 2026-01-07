
import React from 'react';
import { Loader2 } from 'lucide-react';

// --- BUTTONS ---

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'indigo' | 'outline' | 'dashed';
type ButtonSize = 'xs' | 'sm' | 'md' | 'lg' | 'icon' | 'icon-sm';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  icon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({ 
  variant = 'primary', 
  size = 'md', 
  isLoading, 
  icon, 
  children, 
  className = '', 
  disabled, 
  ...props 
}) => {
  const baseStyles = "font-black uppercase tracking-widest transition-all active:scale-95 flex items-center justify-center gap-2 rounded-xl disabled:opacity-50 disabled:pointer-events-none";
  
  const variants = {
    primary: "bg-orange-600 text-white hover:bg-orange-500 shadow-xl shadow-orange-900/20",
    secondary: "bg-stone-800 text-stone-400 hover:text-white hover:bg-stone-700",
    ghost: "bg-transparent text-stone-500 hover:text-stone-300 hover:bg-white/5",
    danger: "bg-stone-800 text-rose-400 hover:bg-rose-900/20 hover:text-rose-300",
    indigo: "bg-indigo-600 text-white hover:bg-indigo-500 shadow-xl shadow-indigo-900/20",
    outline: "border border-stone-700 text-stone-400 hover:border-orange-500 hover:text-orange-400 bg-transparent",
    dashed: "border border-dashed border-stone-800 text-stone-600 hover:text-orange-400 hover:border-orange-500/30"
  };

  const sizes = {
    xs: "text-[9px] py-1.5 px-3",
    sm: "text-[10px] py-2 px-4",
    md: "text-[10px] md:text-xs py-3 px-6",
    lg: "text-xs md:text-sm py-4 px-8",
    icon: "p-3 w-10 h-10 md:w-12 md:h-12",
    "icon-sm": "p-2 w-8 h-8"
  };

  // If size is icon, we might want to center content without gap if no children
  const content = (
    <>
      {isLoading ? <Loader2 size={16} className="animate-spin" /> : icon}
      {children}
    </>
  );

  return (
    <button 
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`} 
      disabled={isLoading || disabled}
      {...props}
    >
      {content}
    </button>
  );
};

// --- CARDS ---

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
    glass: "glass", // CSS class from index.html
    "glass-bright": "glass-bright", // CSS class from index.html
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

// --- HEADERS ---

interface SectionHeaderProps {
  icon?: React.ReactNode;
  title: string;
  subtitle?: string;
  color?: string; // e.g. "text-orange-400"
  className?: string;
  action?: React.ReactNode;
}

export const SectionHeader: React.FC<SectionHeaderProps> = ({ icon, title, subtitle, color = "text-stone-600", className = "", action }) => (
  <div className={`flex items-end justify-between ${className}`}>
    <div className="flex flex-col gap-1">
      <div className={`text-[10px] font-black uppercase tracking-widest flex items-center gap-2 ${color}`}>
        {icon}
        <span>{title}</span>
      </div>
      {subtitle && <p className="text-[10px] text-stone-500 font-serif leading-none">{subtitle}</p>}
    </div>
    {action}
  </div>
);

// --- BADGES ---

export const Badge: React.FC<{ color?: 'orange' | 'emerald' | 'rose' | 'indigo' | 'stone' | 'amber', children: React.ReactNode, className?: string }> = ({ color = 'stone', children, className = '' }) => {
  const colors = {
    orange: "bg-orange-500/10 text-orange-400",
    emerald: "bg-emerald-500/10 text-emerald-400",
    rose: "bg-rose-500/10 text-rose-400",
    indigo: "bg-indigo-500/10 text-indigo-400",
    amber: "bg-amber-500/10 text-amber-400",
    stone: "bg-stone-800 text-stone-500"
  };
  return (
    <span className={`px-1.5 py-0.5 rounded text-[7px] md:text-[8px] font-black uppercase tracking-widest ${colors[color]} ${className}`}>
      {children}
    </span>
  );
};
