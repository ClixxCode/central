import posthog from 'posthog-js';

type AnalyticsEvents = {
  task_created: { source?: 'board' | 'quick_add'; has_due_date?: boolean; has_assignees?: boolean; is_recurring?: boolean };
  task_completed: {};
  task_deleted: {};
  subtask_created: {};
  board_created: { from_template?: boolean };
  board_viewed: { view_type: 'kanban' | 'swimlane' | 'table' };
  comment_created: { is_reply?: boolean; has_attachments?: boolean };
  template_used: { action: 'create_board' | 'apply_tasks' };
  bulk_operation: { action: 'update' | 'duplicate' | 'archive' | 'delete'; count: number };
  search_performed: { result_count: number; has_results: boolean };
  user_signed_up: { provider: 'credentials' };
  user_invited: {};
  calendar_connected: {};
  calendar_disconnected: {};
  favorite_toggled: { action: 'add' | 'remove'; entity_type: string };
};

export function trackEvent<T extends keyof AnalyticsEvents>(
  name: T,
  ...args: AnalyticsEvents[T] extends Record<string, never> ? [] : [properties: AnalyticsEvents[T]]
) {
  posthog.capture(name, args[0] as Record<string, string | number | boolean>);
}
