import { z } from 'zod';

// Auto-membership rule for a rollup board. Mirrors the RollupRule type in the
// schema; membership is derived from Pulse-reflected client attributes.
export const rollupRuleSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('pod'), pod_name: z.string().min(1, 'Pod is required') }),
  z.object({
    type: z.literal('assignment'),
    staff_id: z.string().uuid('Invalid person'),
    role: z.enum(['management', 'delivery']).nullish(),
  }),
  z.object({
    type: z.literal('lifecycle'),
    statuses: z.array(z.string()).min(1, 'Select at least one status'),
  }),
]);

export const createRollupBoardSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255, 'Name must be 255 characters or less'),
  rule: rollupRuleSchema,
});

export const updateRollupRuleSchema = z.object({
  rollupBoardId: z.string().uuid('Invalid rollup board ID'),
  rule: rollupRuleSchema,
});

// Legacy manual-source schema — retained for the older updateRollupSources path.
export const updateRollupSourcesSchema = z.object({
  rollupBoardId: z.string().uuid('Invalid rollup board ID'),
  sourceBoardIds: z.array(z.string().uuid('Invalid board ID')).min(1, 'At least one source board is required'),
});

export const updateRollupBoardSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255, 'Name must be 255 characters or less').optional(),
  reviewModeEnabled: z.boolean().optional(),
});

export type RollupRuleInput = z.infer<typeof rollupRuleSchema>;
export type CreateRollupBoardInput = z.infer<typeof createRollupBoardSchema>;
export type UpdateRollupRuleInput = z.infer<typeof updateRollupRuleSchema>;
export type UpdateRollupSourcesInput = z.infer<typeof updateRollupSourcesSchema>;
export type UpdateRollupBoardInput = z.infer<typeof updateRollupBoardSchema>;
