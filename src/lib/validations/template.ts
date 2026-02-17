import { z } from 'zod';
import { statusOptionSchema, sectionOptionSchema } from './board';

export const createTemplateSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255, 'Name must be 255 characters or less'),
  description: z.string().max(2000).nullable().optional(),
  statusOptions: z.array(statusOptionSchema).optional(),
  sectionOptions: z.array(sectionOptionSchema).optional(),
});

export const createTaskListSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255, 'Name must be 255 characters or less'),
  description: z.string().max(2000).nullable().optional(),
});

export const updateTemplateSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255).optional(),
  description: z.string().max(2000).nullable().optional(),
  statusOptions: z.array(statusOptionSchema).optional(),
  sectionOptions: z.array(sectionOptionSchema).optional(),
  icon: z.string().max(100).nullable().optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid color format').nullable().optional(),
});

export const addTemplateTaskSchema = z.object({
  templateId: z.string().uuid(),
  title: z.string().min(1, 'Title is required').max(500),
  descriptionJson: z.string().nullable().optional(),
  status: z.string().max(100).nullable().optional(),
  section: z.string().max(100).nullable().optional(),
  relativeDueDays: z.number().int().nullable().optional(),
  recurringConfigJson: z.string().nullable().optional(),
  parentTemplateTaskId: z.string().uuid().nullable().optional(),
});

export const updateTemplateTaskSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  descriptionJson: z.string().nullable().optional(),
  status: z.string().max(100).nullable().optional(),
  section: z.string().max(100).nullable().optional(),
  relativeDueDays: z.number().int().nullable().optional(),
  recurringConfigJson: z.string().nullable().optional(),
  position: z.number().int().min(0).optional(),
});

export const createBoardFromTemplateSchema = z.object({
  templateId: z.string().uuid(),
  clientId: z.string().uuid(),
  boardName: z.string().min(1, 'Board name is required').max(255),
});

export const applyTemplateTasksSchema = z.object({
  templateId: z.string().uuid(),
  boardId: z.string().uuid(),
  statusMapping: z.record(z.string(), z.string()).optional(),
  sectionMapping: z.record(z.string(), z.string().nullable()).optional(),
});

export const createTemplateFromBoardSchema = z.object({
  boardId: z.string().uuid(),
  name: z.string().min(1, 'Name is required').max(255),
  description: z.string().max(2000).nullable().optional(),
  includeTasks: z.boolean().default(false),
});

export type CreateTemplateInput = z.infer<typeof createTemplateSchema>;
export type CreateTaskListInput = z.infer<typeof createTaskListSchema>;
export type UpdateTemplateInput = z.infer<typeof updateTemplateSchema>;
export type AddTemplateTaskInput = z.infer<typeof addTemplateTaskSchema>;
export type UpdateTemplateTaskInput = z.infer<typeof updateTemplateTaskSchema>;
export type CreateBoardFromTemplateInput = z.infer<typeof createBoardFromTemplateSchema>;
export type ApplyTemplateTasksInput = z.infer<typeof applyTemplateTasksSchema>;
export const updateTemplateTaskPositionSchema = z.object({
  id: z.string().uuid(),
  position: z.number().int().min(0),
  status: z.string().max(100).optional(),
});

export type CreateTemplateFromBoardInput = z.infer<typeof createTemplateFromBoardSchema>;
export type UpdateTemplateTaskPositionInput = z.infer<typeof updateTemplateTaskPositionSchema>;
