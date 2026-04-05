import { z } from 'zod';
import {
  BranchPolicySchema,
  ChapterLogSchema,
  RevealPlanSchema,
  RouteSchema,
  ScenePackageSchema,
  StateAxisSchema,
} from '../validation/schemas';

const CodexTaskTypeSchema = z.enum([
  'route design',
  'scene package generation',
  'branch repair',
  'draft polish',
  'project genesis',
  'interactive refinement',
]);

const ScopeGuardSchema = z.object({
  editableChapterIds: z.array(z.string()).optional(),
  editableSceneIds: z.array(z.string()).optional(),
  protectedPaths: z.array(z.string()).optional(),
});

const BaseOpSchema = z.object({
  opId: z.string().min(1),
  reason: z.string().optional(),
});

export const CodexPatchOperationSchema = z.discriminatedUnion('type', [
  BaseOpSchema.extend({
    type: z.literal('setProjectField'),
    path: z.enum(['meta.title', 'meta.author', 'meta.genre', 'bible.setting']),
    value: z.string(),
  }),
  BaseOpSchema.extend({
    type: z.literal('upsertStateAxis'),
    axis: StateAxisSchema,
  }),
  BaseOpSchema.extend({
    type: z.literal('upsertRoute'),
    route: RouteSchema,
  }),
  BaseOpSchema.extend({
    type: z.literal('upsertRevealPlan'),
    revealPlan: RevealPlanSchema,
  }),
  BaseOpSchema.extend({
    type: z.literal('upsertBranchPolicy'),
    policy: BranchPolicySchema,
  }),
  BaseOpSchema.extend({
    type: z.literal('upsertChapter'),
    chapter: ChapterLogSchema,
  }),
  BaseOpSchema.extend({
    type: z.literal('upsertScenePackage'),
    chapterId: z.string().min(1),
    scenePackage: ScenePackageSchema,
  }),
  BaseOpSchema.extend({
    type: z.literal('deleteScenePackage'),
    chapterId: z.string().min(1),
    sceneId: z.string().min(1),
  }),
]);

export const CodexOpsArtifactSchema = z.object({
  kind: z.literal('duoscript.codex.ops'),
  version: z.literal(1),
  generatedAt: z.number(),
  taskType: CodexTaskTypeSchema,
  responseMode: z.literal('ops'),
  scopeGuard: ScopeGuardSchema.optional(),
  operations: z.array(CodexPatchOperationSchema),
  unresolved: z.array(z.string()).optional(),
});

export const CodexQuestionsArtifactSchema = z.object({
  kind: z.literal('duoscript.codex.questions'),
  version: z.literal(1),
  generatedAt: z.number(),
  taskType: CodexTaskTypeSchema,
  responseMode: z.literal('questions'),
  questions: z.array(z.string().min(1)),
});
