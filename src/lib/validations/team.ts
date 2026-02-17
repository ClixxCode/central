import { z } from 'zod';

export const createTeamSchema = z.object({
  name: z.string().min(1, 'Team name is required').max(255),
});

export const updateTeamSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  excludeFromPublic: z.boolean().optional(),
});

export type CreateTeamInput = z.infer<typeof createTeamSchema>;
export type UpdateTeamInput = z.infer<typeof updateTeamSchema>;
