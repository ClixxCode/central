import { z } from 'zod';

const filterModeSchema = z.enum(['is', 'is_not']);

export const savedViewFiltersSchema = z.object({
  statusLabels: z.array(z.string().min(1)).optional(),
  statusMode: filterModeSchema.optional(),
  sectionLabels: z.array(z.string().min(1)).optional(),
  includeNoSection: z.boolean().optional(),
  sectionMode: filterModeSchema.optional(),
  assigneeIds: z.array(z.string().uuid()).optional(),
  assigneeMode: filterModeSchema.optional(),
  overdue: z.boolean().optional(),
});

export const savedViewPresentationSchema = z.object({
  layout: z.enum(['swimlane', 'kanban', 'table']),
  sort: z.object({
    field: z.enum(['position', 'dueDate', 'title', 'status', 'client']),
    direction: z.enum(['asc', 'desc']),
  }),
  tableColumns: z.object({
    title: z.boolean(),
    status: z.boolean(),
    section: z.boolean(),
    assignees: z.boolean(),
    dueDate: z.boolean(),
    source: z.boolean(),
  }).refine((columns) => Object.values(columns).some(Boolean), {
    message: 'At least one table column must be visible',
  }),
  cardFields: z.object({
    section: z.boolean(),
    dueDate: z.boolean(),
    assignees: z.boolean(),
  }),
});

export const savedViewDefinitionSchema = z.object({
  sourceBoardIds: z
    .array(z.string().uuid('Invalid board ID'))
    .min(1, 'Select at least one board')
    .max(100, 'A view can include at most 100 boards')
    .refine((ids) => new Set(ids).size === ids.length, 'Boards must be unique'),
  filters: savedViewFiltersSchema,
  presentation: savedViewPresentationSchema,
  reviewModeEnabled: z.boolean(),
});

export const createSavedViewSchema = savedViewDefinitionSchema.extend({
  name: z.string().trim().min(1, 'Name is required').max(255),
});

export const updateSavedViewSchema = createSavedViewSchema.partial().extend({
  sourceBoardIds: savedViewDefinitionSchema.shape.sourceBoardIds.optional(),
});

export type SavedViewFiltersInput = z.infer<typeof savedViewFiltersSchema>;
export type SavedViewPresentationInput = z.infer<typeof savedViewPresentationSchema>;
export type SavedViewDefinitionInput = z.infer<typeof savedViewDefinitionSchema>;
export type CreateSavedViewInput = z.infer<typeof createSavedViewSchema>;
export type UpdateSavedViewInput = z.infer<typeof updateSavedViewSchema>;
