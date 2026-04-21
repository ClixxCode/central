// Inngest event type definitions

export interface MentionNotificationEvent {
  name: 'notification/mention.created';
  data: {
    notificationId: string;
    recipientId: string;
    recipientEmail: string;
    recipientName: string | null;
    mentionerName: string;
    taskId: string;
    taskShortId: string | null;
    taskTitle: string;
    taskStatus: string;
    taskDueDate: string | null;
    boardId: string;
    clientSlug: string;
    commentId: string;
    commentPreview: string | null;
  };
}

export interface AssignmentNotificationEvent {
  name: 'notification/assignment.created';
  data: {
    notificationId: string;
    recipientId: string;
    recipientEmail: string;
    recipientName: string | null;
    assignerName: string;
    taskId: string;
    taskShortId: string | null;
    taskTitle: string;
    taskStatus: string;
    taskDueDate: string | null;
    taskDescription: string | null;
    boardId: string;
    boardName: string;
    clientSlug: string;
    clientName: string;
  };
}

export interface DueReminderEvent {
  name: 'notification/due-reminder.scheduled';
  data: {
    notificationId: string;
    recipientId: string;
    recipientEmail: string;
    recipientName: string | null;
    taskId: string;
    taskShortId: string | null;
    taskTitle: string;
    taskStatus: string;
    dueDate: string;
    isOverdue: boolean;
    boardId: string;
    boardName: string;
    clientSlug: string;
    clientName: string;
  };
}

export interface DailyDigestEvent {
  name: 'notification/daily-digest.scheduled';
  data: {
    userId: string;
    userEmail: string;
    userName: string | null;
  };
}

// Recurring task completion event
export interface RecurringTaskCompletedEvent {
  name: 'task/recurring.completed';
  data: {
    taskId: string;
    boardId: string;
    recurringGroupId: string;
    recurringConfig: {
      frequency: 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly';
      interval: number;
      daysOfWeek?: number[];
      dayOfMonth?: number;
      endDate?: string;
      endAfterOccurrences?: number;
    };
    completedDueDate: string;
    completedByUserId: string;
    // Task data to copy to next instance
    title: string;
    description: unknown | null;
    section: string | null;
    dateFlexibility: string;
    assigneeIds: string[];
  };
}

// Pulse → Central onboarding task generation request
export interface PulseOnboardingTasksRequestedEvent {
  name: 'pulse/onboarding.tasks.requested';
  data: {
    centralClientId: string;
    centralBoardId: string;
    pulseAccountId: string;
    accountName: string;
    targetWebsite: string | null;
    services: Array<{
      name: string;
      catalog_id: string | null;
      onboarding_scope: string | null;
      accesses_required: string | null;
    }>;
  };
}

// Union type for all events
export type NotificationEvent =
  | MentionNotificationEvent
  | AssignmentNotificationEvent
  | DueReminderEvent
  | DailyDigestEvent
  | RecurringTaskCompletedEvent
  | PulseOnboardingTasksRequestedEvent;
