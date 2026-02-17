import { z } from 'zod';

export const createRollupBoardSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255, 'Name must be 255 characters or less'),
  sourceBoardIds: z
    .array(z.string().uuid('Invalid board ID'))
    .min(1, 'At least one source board is required'),
});

export const updateRollupSourcesSchema = z.object({
  rollupBoardId: z.string().uuid('Invalid rollup board ID'),
  sourceBoardIds: z
    .array(z.string().uuid('Invalid board ID'))
    .min(1, 'At least one source board is required'),
});

export const updateRollupBoardSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255, 'Name must be 255 characters or less').optional(),
  reviewModeEnabled: z.boolean().optional(),
});

export type CreateRollupBoardInput = z.infer<typeof createRollupBoardSchema>;
export type UpdateRollupSourcesInput = z.infer<typeof updateRollupSourcesSchema>;
export type UpdateRollupBoardInput = z.infer<typeof updateRollupBoardSchema>;
