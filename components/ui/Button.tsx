
import React from 'react';
import { Loader2 } from 'lucide-react';

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
    xs: "text-[10px] py-1.5 px-3",
    sm: "text-[11px] py-2 px-4",
    md: "text-xs py-3 px-6",
    lg: "text-sm py-4 px-8",
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
