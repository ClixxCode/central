import { z } from 'zod';

const hexColorRegex = /^#[0-9A-Fa-f]{6}$/;

export const statusOptionSchema = z.object({
  id: z.string().min(1, 'Status ID is required'),
  label: z.string().min(1, 'Label is required').max(50, 'Label must be 50 characters or less'),
  color: z.string().regex(hexColorRegex, 'Invalid color format (must be #RRGGBB)'),
  position: z.number().int().min(0, 'Position must be non-negative'),
});

export const sectionOptionSchema = z.object({
  id: z.string().min(1, 'Section ID is required'),
  label: z.string().min(1, 'Label is required').max(50, 'Label must be 50 characters or less'),
  color: z.string().regex(hexColorRegex, 'Invalid color format (must be #RRGGBB)'),
  position: z.number().int().min(0, 'Position must be non-negative'),
});

export const createBoardSchema = z.object({
  clientId: z.string().uuid('Invalid client ID'),
  name: z.string().min(1, 'Name is required').max(255, 'Name must be 255 characters or less'),
  statusOptions: z.array(statusOptionSchema).optional(),
  sectionOptions: z.array(sectionOptionSchema).optional(),
});

export const updateBoardSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255, 'Name must be 255 characters or less').optional(),
  statusOptions: z.array(statusOptionSchema).optional(),
  sectionOptions: z.array(sectionOptionSchema).optional(),
  color: z.string().regex(hexColorRegex, 'Invalid color format (must be #RRGGBB)').nullable().optional(),
  icon: z.string().max(100).nullable().optional(),
});

export const addBoardAccessSchema = z
  .object({
    boardId: z.string().uuid('Invalid board ID'),
    userId: z.string().uuid('Invalid user ID').optional().nullable(),
    teamId: z.string().uuid('Invalid team ID').optional().nullable(),
    accessLevel: z.enum(['full', 'assigned_only']),
  })
  .refine(
    (data) => {
      const hasUser = data.userId !== null && data.userId !== undefined;
      const hasTeam = data.teamId !== null && data.teamId !== undefined;
      return (hasUser && !hasTeam) || (!hasUser && hasTeam);
    },
    { message: 'Must specify either userId or teamId, not both' }
  );

export const updateBoardAccessSchema = z.object({
  accessId: z.string().uuid('Invalid access ID'),
  accessLevel: z.enum(['full', 'assigned_only']),
});

export type CreateBoardInput = z.infer<typeof createBoardSchema>;
export type UpdateBoardInput = z.infer<typeof updateBoardSchema>;
export type AddBoardAccessInput = z.infer<typeof addBoardAccessSchema>;
export type UpdateBoardAccessInput = z.infer<typeof updateBoardAccessSchema>;
export type StatusOption = z.infer<typeof statusOptionSchema>;
export type SectionOption = z.infer<typeof sectionOptionSchema>;
