
import React from 'react';
import { Styles } from './Styles';

type TextVariant = keyof typeof Styles.text;

interface TextProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: TextVariant;
  as?: 'span' | 'div' | 'p' | 'h1' | 'h2' | 'h3' | 'h4' | 'label';
}

export const Txt: React.FC<TextProps> = ({ 
  variant = 'body', 
  as: Component = 'div', 
  children, 
  className = '', 
  ...props 
}) => {
  return (
    <Component className={`${Styles.text[variant]} ${className}`} {...props}>
      {children}
    </Component>
  );
};
