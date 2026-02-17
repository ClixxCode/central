'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  listTemplates,
  getTemplate,
  createTemplate,
  createTaskList,
  createTemplateFromBoard,
  updateTemplate,
  deleteTemplate,
  addTemplateTask,
  updateTemplateTask,
  deleteTemplateTask,
  createBoardFromTemplate,
  applyTemplateTasksToBoard,
  updateTemplateTaskPositions,
  bulkUpdateTemplateTasks,
  type TemplateSummary,
  type TemplateDetail,
} from '@/lib/actions/templates';
import type {
  CreateTemplateInput,
  CreateTaskListInput,
  UpdateTemplateInput,
  AddTemplateTaskInput,
  UpdateTemplateTaskInput,
  CreateBoardFromTemplateInput,
  ApplyTemplateTasksInput,
  CreateTemplateFromBoardInput,
} from '@/lib/validations/template';
import { trackEvent } from '@/lib/analytics';

// Query key factory
export const templateKeys = {
  all: ['templates'] as const,
  lists: () => [...templateKeys.all, 'list'] as const,
  list: (type?: 'board_template' | 'task_list') =>
    [...templateKeys.lists(), { type }] as const,
  details: () => [...templateKeys.all, 'detail'] as const,
  detail: (id: string) => [...templateKeys.details(), id] as const,
};

/**
 * Fetch all templates with optional type filter
 */
export function useTemplates(type?: 'board_template' | 'task_list') {
  return useQuery({
    queryKey: templateKeys.list(type),
    queryFn: async () => {
      const result = await listTemplates(type);
      if (!result.success) throw new Error(result.error ?? 'Failed to fetch templates');
      return result.data!;
    },
  });
}

/**
 * Fetch a single template with all tasks
 */
export function useTemplate(id: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: templateKeys.detail(id),
    queryFn: async () => {
      const result = await getTemplate(id);
      if (!result.success) throw new Error(result.error ?? 'Failed to fetch template');
      return result.data!;
    },
    enabled: options?.enabled ?? !!id,
  });
}

/**
 * Create a board template
 */
export function useCreateTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateTemplateInput) => {
      const result = await createTemplate(input);
      if (!result.success) throw new Error(result.error ?? 'Failed to create template');
      return result.data!;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: templateKeys.lists() });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

/**
 * Create a task list
 */
export function useCreateTaskList() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateTaskListInput) => {
      const result = await createTaskList(input);
      if (!result.success) throw new Error(result.error ?? 'Failed to create task list');
      return result.data!;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: templateKeys.lists() });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

/**
 * Create a template from an existing board
 */
export function useCreateTemplateFromBoard() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateTemplateFromBoardInput) => {
      const result = await createTemplateFromBoard(input);
      if (!result.success) throw new Error(result.error ?? 'Failed to create template from board');
      return result.data!;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: templateKeys.lists() });
      toast.success('Template created successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

/**
 * Update a template
 */
export function useUpdateTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...input }: UpdateTemplateInput & { id: string }) => {
      const result = await updateTemplate(id, input);
      if (!result.success) throw new Error(result.error ?? 'Failed to update template');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: templateKeys.all });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

/**
 * Delete a template
 */
export function useDeleteTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const result = await deleteTemplate(id);
      if (!result.success) throw new Error(result.error ?? 'Failed to delete template');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: templateKeys.lists() });
      toast.success('Template deleted');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

/**
 * Add a task to a template
 */
export function useAddTemplateTask(templateId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: Omit<AddTemplateTaskInput, 'templateId'>) => {
      const result = await addTemplateTask({ ...input, templateId });
      if (!result.success) throw new Error(result.error ?? 'Failed to add task');
      return result.data!;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: templateKeys.detail(templateId) });
      queryClient.invalidateQueries({ queryKey: templateKeys.lists() });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

/**
 * Update a template task
 */
export function useUpdateTemplateTask(templateId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ taskId, ...input }: UpdateTemplateTaskInput & { taskId: string }) => {
      const result = await updateTemplateTask(taskId, input);
      if (!result.success) throw new Error(result.error ?? 'Failed to update task');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: templateKeys.detail(templateId) });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

/**
 * Delete a template task
 */
export function useDeleteTemplateTask(templateId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (taskId: string) => {
      const result = await deleteTemplateTask(taskId);
      if (!result.success) throw new Error(result.error ?? 'Failed to delete task');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: templateKeys.detail(templateId) });
      queryClient.invalidateQueries({ queryKey: templateKeys.lists() });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

/**
 * Create a board from a template
 */
export function useCreateBoardFromTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateBoardFromTemplateInput) => {
      const result = await createBoardFromTemplate(input);
      if (!result.success) throw new Error(result.error ?? 'Failed to create board');
      return result.data!;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['boards'] });
      toast.success('Board created from template');
      trackEvent('template_used', { action: 'create_board' });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

/**
 * Batch update template task positions (for DnD reordering)
 */
export function useUpdateTemplateTaskPositions(templateId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (updates: { id: string; position: number; status?: string }[]) => {
      const result = await updateTemplateTaskPositions(templateId, updates);
      if (!result.success) throw new Error(result.error ?? 'Failed to update positions');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: templateKeys.detail(templateId) });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

/**
 * Bulk update template tasks (section and/or relativeDueDays)
 */
export function useBulkUpdateTemplateTasks(templateId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      taskIds: string[];
      section?: string | null;
      relativeDueDays?: number | null;
    }) => {
      const result = await bulkUpdateTemplateTasks(templateId, input);
      if (!result.success) throw new Error(result.error ?? 'Failed to bulk update tasks');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: templateKeys.detail(templateId) });
      toast.success('Tasks updated');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

/**
 * Apply template tasks to an existing board
 */
export function useApplyTemplateTasksToBoard() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: ApplyTemplateTasksInput) => {
      const result = await applyTemplateTasksToBoard(input);
      if (!result.success) throw new Error(result.error ?? 'Failed to apply tasks');
      return result.data!;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      toast.success(`${data.taskCount} tasks added to board`);
      trackEvent('template_used', { action: 'apply_tasks' });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}
