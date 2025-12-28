
/**
 * DuoScript Gemini Service
 * 
 * This module acts as an aggregator for the split Gemini service components.
 * Logic is divided into:
 * - utils: JSON handling, retries, usage tracking
 * - schemas: Response schema definitions for structured output
 * - api: Core AI logic functions (Architect, Writer, Sync, etc.)
 */

export * from './gemini/api';
export * from './gemini/utils';
export * from './gemini/schemas';
