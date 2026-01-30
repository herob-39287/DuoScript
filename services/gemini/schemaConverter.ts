import { Type, Schema } from '@google/genai';
import { z } from 'zod';

/**
 * Converts a Zod schema to a Google GenAI Schema (Type).
 */
export function zodToGeminiSchema(schema: z.ZodTypeAny): Schema {
  if (!schema) return { type: Type.STRING };

  // Handle Effects / Preprocess (unwrap)
  if (schema instanceof z.ZodEffects || schema instanceof z.ZodTransformer) {
    return zodToGeminiSchema(schema._def.schema);
  }

  // Handle Optional / Nullable
  if (schema instanceof z.ZodOptional || schema instanceof z.ZodNullable) {
    const inner = zodToGeminiSchema(schema.unwrap());
    return { ...inner, nullable: true };
  }

  // Handle Default (unwrap, but maybe note default in description? skipping for now)
  if (schema instanceof z.ZodDefault) {
    return zodToGeminiSchema(schema.removeDefault());
  }

  const description = schema.description;

  // String
  if (schema instanceof z.ZodString) {
    return { type: Type.STRING, description };
  }

  // Number
  if (schema instanceof z.ZodNumber) {
    return { type: Type.NUMBER, description };
  }

  // Boolean
  if (schema instanceof z.ZodBoolean) {
    return { type: Type.BOOLEAN, description };
  }

  // Enum
  if (schema instanceof z.ZodEnum || schema instanceof z.ZodNativeEnum) {
    return {
      type: Type.STRING,
      enum: Object.values(schema._def.values),
      description,
    };
  }

  // Array
  if (schema instanceof z.ZodArray) {
    return {
      type: Type.ARRAY,
      items: zodToGeminiSchema(schema.element),
      description,
    };
  }

  // Object
  if (schema instanceof z.ZodObject) {
    const shape = schema.shape;
    const properties: Record<string, Schema> = {};
    const required: string[] = [];

    for (const key in shape) {
      const fieldSchema = shape[key];
      properties[key] = zodToGeminiSchema(fieldSchema);

      // Determine required status
      // ZodOptional/Nullable/Default are optional.
      if (
        !(fieldSchema instanceof z.ZodOptional) &&
        !(fieldSchema instanceof z.ZodNullable) &&
        !(fieldSchema instanceof z.ZodDefault)
      ) {
        required.push(key);
      }
    }

    return {
      type: Type.OBJECT,
      properties,
      required: required.length > 0 ? required : undefined,
      description,
    };
  }

  // Fallback
  console.warn(
    'Unsupported Zod type for Gemini Schema conversion, defaulting to STRING:',
    schema.constructor.name,
  );
  return { type: Type.STRING, description };
}
