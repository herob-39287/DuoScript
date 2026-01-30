import { type ClassValue, clsx } from 'clsx';

/**
 * Merges class names safely, handling Tailwind CSS conflicts.
 */
export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}
