import { z } from 'zod';
import { sectionOptionSchema, statusOptionSchema } from './board';

export const createBoardProjectSchema = z.object({
  parentBoardId: z.string().uuid('Invalid parent board ID'),
  name: z.string().min(1, 'Name is required').max(255, 'Name must be 255 characters or less'),
  description: z.string().max(1000, 'Description must be 1000 characters or less').nullable().optional(),
  status: z.string().min(1, 'Status is required').max(100, 'Status must be 100 characters or less'),
  section: z
    .string()
    .min(1, 'Section is required')
    .max(100, 'Section must be 100 characters or less')
    .nullable()
    .optional(),
  dueDate: z.string().nullable().optional(),
  position: z.number().int('Position must be an integer').optional(),
  internalStatusOptions: z.array(statusOptionSchema).optional(),
  internalSectionOptions: z.array(sectionOptionSchema).optional(),
});

export const updateBoardProjectSchema = z.object({
  id: z.string().uuid('Invalid project card ID'),
  name: z.string().min(1, 'Name is required').max(255, 'Name must be 255 characters or less').optional(),
  description: z.string().max(1000, 'Description must be 1000 characters or less').nullable().optional(),
  status: z
    .string()
    .min(1, 'Status is required')
    .max(100, 'Status must be 100 characters or less')
    .optional(),
  section: z
    .string()
    .min(1, 'Section is required')
    .max(100, 'Section must be 100 characters or less')
    .nullable()
    .optional(),
  dueDate: z.string().nullable().optional(),
  position: z.number().int('Position must be an integer').optional(),
  internalStatusOptions: z.array(statusOptionSchema).optional(),
  internalSectionOptions: z.array(sectionOptionSchema).optional(),
});

export const boardProjectPositionUpdateSchema = z.object({
  id: z.string().uuid('Invalid project card ID'),
  status: z.string().min(1, 'Status is required').max(100, 'Status must be 100 characters or less').optional(),
  section: z
    .string()
    .min(1, 'Section is required')
    .max(100, 'Section must be 100 characters or less')
    .nullable()
    .optional(),
  position: z.number().int('Position must be an integer'),
});

export const updateBoardProjectPositionsSchema = z
  .array(boardProjectPositionUpdateSchema)
  .min(1, 'At least one project card update is required');

export const boardItemPositionUpdateSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('task'),
    id: z.string().uuid('Invalid task ID'),
    status: z.string().min(1, 'Status is required').max(100, 'Status must be 100 characters or less').optional(),
    section: z
      .string()
      .min(1, 'Section is required')
      .max(100, 'Section must be 100 characters or less')
      .nullable()
      .optional(),
    position: z.number().int('Position must be an integer'),
  }),
  boardProjectPositionUpdateSchema.extend({
    kind: z.literal('project'),
  }),
]);

export const updateBoardItemPositionsSchema = z
  .array(boardItemPositionUpdateSchema)
  .min(1, 'At least one board item update is required');

export type CreateBoardProjectInput = z.infer<typeof createBoardProjectSchema>;
export type UpdateBoardProjectInput = z.infer<typeof updateBoardProjectSchema>;
export type BoardProjectPositionUpdateInput = z.infer<typeof boardProjectPositionUpdateSchema>;
export type BoardItemPositionUpdateInput = z.infer<typeof boardItemPositionUpdateSchema>;
