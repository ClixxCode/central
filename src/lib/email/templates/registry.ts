import {
  mentionEmailHtml,
  type MentionEmailData,
} from './mention';
import {
  commentAddedEmailHtml,
  type CommentAddedEmailData,
} from './comment-added';
import {
  taskAssignedEmailHtml,
  type TaskAssignedEmailData,
} from './task-assigned';
import {
  taskDueEmailHtml,
  type TaskDueEmailData,
} from './task-due';
import {
  dailyDigestEmailHtml,
  type DailyDigestEmailData,
} from './daily-digest';
import { invitationEmailHtml } from './invitation';
import {
  emailVerificationTemplate,
  emailVerifiedTemplate,
} from './email-verification';
import { adminPasswordResetTemplate } from './password-reset';

export const RESEND_STRING_VARIABLE_MAX_LENGTH = 2000;

export const CENTRAL_EMAIL_TEMPLATE_ALIASES = {
  mention: 'central_mention',
  commentAdded: 'central_comment_added',
  taskAssigned: 'central_task_assigned',
  taskDueSoon: 'central_task_due_soon',
  taskOverdue: 'central_task_overdue',
  dailyDigest: 'central_daily_digest',
  invitation: 'central_invitation',
  emailVerification: 'central_email_verification',
  emailVerified: 'central_email_verified',
  passwordReset: 'central_password_reset',
} as const;

export type CentralEmailTemplateAlias =
  (typeof CENTRAL_EMAIL_TEMPLATE_ALIASES)[keyof typeof CENTRAL_EMAIL_TEMPLATE_ALIASES];

export type CentralTemplateVariableValue = string | number;
export type CentralTemplateVariables = Record<string, CentralTemplateVariableValue>;

export interface CentralTemplateVariableDefinition {
  key: string;
  type: 'string' | 'number';
  fallbackValue?: CentralTemplateVariableValue | null;
  required?: boolean;
}

export interface CentralEmailTemplateDefinition {
  alias: CentralEmailTemplateAlias;
  name: CentralEmailTemplateAlias;
  subject: string;
  variables: CentralTemplateVariableDefinition[];
  sampleVariables: CentralTemplateVariables;
  renderHtml: () => Promise<string>;
  text: string;
}

export const RESERVED_RESEND_TEMPLATE_VARIABLE_KEYS = new Set([
  'RESEND_CLICK_TRACKING_URL',
  'RESEND_OPEN_TRACKING_URL',
  'RESEND_UNSUBSCRIBE_URL',
  'RESEND_UNSUBSCRIBE_EMAIL',
]);

export function resendTemplatePlaceholder(key: string): string {
  return `{{{${key}}}}`;
}

const p = resendTemplatePlaceholder;

const commonTaskVariables = [
  { key: 'RECIPIENT_NAME', type: 'string', fallbackValue: 'there' },
  { key: 'TASK_TITLE', type: 'string', required: true },
  { key: 'TASK_STATUS', type: 'string', fallbackValue: 'No status' },
  { key: 'TASK_STATUS_COLOR', type: 'string', fallbackValue: '#6B7280' },
  { key: 'TASK_STATUS_BACKGROUND_COLOR', type: 'string', fallbackValue: 'rgba(107, 114, 128, 0.12)' },
  { key: 'TASK_DUE_DATE', type: 'string', fallbackValue: 'No due date' },
  { key: 'CTA_URL', type: 'string', required: true },
] satisfies CentralTemplateVariableDefinition[];

const commentPreviewVariable = {
  key: 'COMMENT_PREVIEW',
  type: 'string',
  fallbackValue: 'Open Central to view the full comment.',
} satisfies CentralTemplateVariableDefinition;

const taskLocationVariables = [
  { key: 'CLIENT_NAME', type: 'string', fallbackValue: 'Central' },
  { key: 'BOARD_NAME', type: 'string', fallbackValue: 'Tasks' },
] satisfies CentralTemplateVariableDefinition[];

const mentionSample = {
  RECIPIENT_NAME: p('RECIPIENT_NAME'),
  MENTIONER_NAME: p('MENTIONER_NAME'),
  TASK_TITLE: p('TASK_TITLE'),
  TASK_STATUS: p('TASK_STATUS'),
  TASK_STATUS_COLOR: p('TASK_STATUS_COLOR'),
  TASK_STATUS_BACKGROUND_COLOR: p('TASK_STATUS_BACKGROUND_COLOR'),
  TASK_DUE_DATE: p('TASK_DUE_DATE'),
  COMMENT_PREVIEW: p('COMMENT_PREVIEW'),
  CTA_URL: p('CTA_URL'),
};

const commentAddedSample = {
  RECIPIENT_NAME: p('RECIPIENT_NAME'),
  COMMENTER_NAME: p('COMMENTER_NAME'),
  TASK_TITLE: p('TASK_TITLE'),
  TASK_STATUS: p('TASK_STATUS'),
  TASK_STATUS_COLOR: p('TASK_STATUS_COLOR'),
  TASK_STATUS_BACKGROUND_COLOR: p('TASK_STATUS_BACKGROUND_COLOR'),
  TASK_DUE_DATE: p('TASK_DUE_DATE'),
  COMMENT_PREVIEW: p('COMMENT_PREVIEW'),
  CTA_URL: p('CTA_URL'),
};

const assignmentSample = {
  RECIPIENT_NAME: p('RECIPIENT_NAME'),
  ASSIGNER_NAME: p('ASSIGNER_NAME'),
  TASK_TITLE: p('TASK_TITLE'),
  TASK_STATUS: p('TASK_STATUS'),
  TASK_STATUS_COLOR: p('TASK_STATUS_COLOR'),
  TASK_STATUS_BACKGROUND_COLOR: p('TASK_STATUS_BACKGROUND_COLOR'),
  TASK_DUE_DATE: p('TASK_DUE_DATE'),
  TASK_DESCRIPTION: p('TASK_DESCRIPTION'),
  CLIENT_NAME: p('CLIENT_NAME'),
  BOARD_NAME: p('BOARD_NAME'),
  CTA_URL: p('CTA_URL'),
};

const dueSample = {
  RECIPIENT_NAME: p('RECIPIENT_NAME'),
  TASK_TITLE: p('TASK_TITLE'),
  TASK_STATUS: p('TASK_STATUS'),
  TASK_STATUS_COLOR: p('TASK_STATUS_COLOR'),
  TASK_STATUS_BACKGROUND_COLOR: p('TASK_STATUS_BACKGROUND_COLOR'),
  TASK_DUE_DATE: p('TASK_DUE_DATE'),
  CLIENT_NAME: p('CLIENT_NAME'),
  BOARD_NAME: p('BOARD_NAME'),
  CTA_URL: p('CTA_URL'),
};

const dailyDigestSample = {
  RECIPIENT_NAME: p('RECIPIENT_NAME'),
  DIGEST_DATE: p('DIGEST_DATE'),
  SUMMARY_TEXT: p('SUMMARY_TEXT'),
  TASKS_OVERDUE_COUNT: p('TASKS_OVERDUE_COUNT'),
  TASKS_DUE_TODAY_COUNT: p('TASKS_DUE_TODAY_COUNT'),
  TASKS_DUE_TOMORROW_COUNT: p('TASKS_DUE_TOMORROW_COUNT'),
  UNREAD_NOTIFICATIONS_COUNT: p('UNREAD_NOTIFICATIONS_COUNT'),
  CTA_URL: p('CTA_URL'),
};

const invitationSample = {
  INVITER_NAME: p('INVITER_NAME'),
  INVITE_URL: p('INVITE_URL'),
};

const emailVerificationSample = {
  USER_NAME: p('USER_NAME'),
  VERIFICATION_URL: p('VERIFICATION_URL'),
};

const emailVerifiedSample = {
  USER_NAME: p('USER_NAME'),
  LOGIN_URL: p('LOGIN_URL'),
};

const passwordResetSample = {
  USER_NAME: p('USER_NAME'),
  ADMIN_NAME: p('ADMIN_NAME'),
  RESET_URL: p('RESET_URL'),
};

function templateText(lines: string[]): string {
  return lines.join('\n');
}

function asMentionData(sample: typeof mentionSample): MentionEmailData {
  return {
    recipientName: sample.RECIPIENT_NAME,
    mentionerName: sample.MENTIONER_NAME,
    taskTitle: sample.TASK_TITLE,
    taskId: 'template-task-id',
    boardId: 'template-board-id',
    clientSlug: 'template-client',
    ctaUrl: sample.CTA_URL,
    commentPreview: sample.COMMENT_PREVIEW,
    taskStatus: sample.TASK_STATUS,
    taskStatusColor: sample.TASK_STATUS_COLOR,
    taskStatusBackgroundColor: sample.TASK_STATUS_BACKGROUND_COLOR,
    taskDueDate: sample.TASK_DUE_DATE,
  };
}

function asCommentAddedData(sample: typeof commentAddedSample): CommentAddedEmailData {
  return {
    recipientName: sample.RECIPIENT_NAME,
    commenterName: sample.COMMENTER_NAME,
    taskTitle: sample.TASK_TITLE,
    taskId: 'template-task-id',
    boardId: 'template-board-id',
    clientSlug: 'template-client',
    ctaUrl: sample.CTA_URL,
    commentPreview: sample.COMMENT_PREVIEW,
    taskStatus: sample.TASK_STATUS,
    taskStatusColor: sample.TASK_STATUS_COLOR,
    taskStatusBackgroundColor: sample.TASK_STATUS_BACKGROUND_COLOR,
    taskDueDate: sample.TASK_DUE_DATE,
  };
}

function asTaskAssignedData(sample: typeof assignmentSample): TaskAssignedEmailData {
  return {
    recipientName: sample.RECIPIENT_NAME,
    assignerName: sample.ASSIGNER_NAME,
    taskTitle: sample.TASK_TITLE,
    taskId: 'template-task-id',
    boardId: 'template-board-id',
    clientSlug: 'template-client',
    ctaUrl: sample.CTA_URL,
    clientName: sample.CLIENT_NAME,
    boardName: sample.BOARD_NAME,
    taskStatus: sample.TASK_STATUS,
    taskStatusColor: sample.TASK_STATUS_COLOR,
    taskStatusBackgroundColor: sample.TASK_STATUS_BACKGROUND_COLOR,
    taskDueDate: sample.TASK_DUE_DATE,
    taskDescription: sample.TASK_DESCRIPTION,
  };
}

function asTaskDueData(sample: typeof dueSample, isOverdue: boolean): TaskDueEmailData {
  return {
    recipientName: sample.RECIPIENT_NAME,
    taskTitle: sample.TASK_TITLE,
    taskId: 'template-task-id',
    boardId: 'template-board-id',
    clientSlug: 'template-client',
    ctaUrl: sample.CTA_URL,
    clientName: sample.CLIENT_NAME,
    boardName: sample.BOARD_NAME,
    taskStatus: sample.TASK_STATUS,
    taskStatusColor: sample.TASK_STATUS_COLOR,
    taskStatusBackgroundColor: sample.TASK_STATUS_BACKGROUND_COLOR,
    dueDate: sample.TASK_DUE_DATE,
    isOverdue,
  };
}

function asDailyDigestData(sample: typeof dailyDigestSample): DailyDigestEmailData {
  return {
    recipientName: sample.RECIPIENT_NAME,
    date: sample.DIGEST_DATE,
    summaryText: sample.SUMMARY_TEXT,
    tasksOverdueCount: sample.TASKS_OVERDUE_COUNT,
    tasksDueTodayCount: sample.TASKS_DUE_TODAY_COUNT,
    tasksDueTomorrowCount: sample.TASKS_DUE_TOMORROW_COUNT,
    unreadNotificationsCount: sample.UNREAD_NOTIFICATIONS_COUNT,
    ctaUrl: sample.CTA_URL,
  };
}

export const CENTRAL_EMAIL_TEMPLATES = {
  [CENTRAL_EMAIL_TEMPLATE_ALIASES.mention]: {
    alias: CENTRAL_EMAIL_TEMPLATE_ALIASES.mention,
    name: CENTRAL_EMAIL_TEMPLATE_ALIASES.mention,
    subject: 'You were mentioned in Central',
    variables: [
      ...commonTaskVariables,
      { key: 'MENTIONER_NAME', type: 'string', required: true },
      commentPreviewVariable,
    ],
    sampleVariables: mentionSample,
    renderHtml: () => mentionEmailHtml(asMentionData(mentionSample)),
    text: templateText([
      'You were mentioned in Central',
      '',
      `${p('MENTIONER_NAME')} mentioned you in "${p('TASK_TITLE')}".`,
      `Comment: ${p('COMMENT_PREVIEW')}`,
      `Status: ${p('TASK_STATUS')}`,
      `Due: ${p('TASK_DUE_DATE')}`,
      '',
      `View task: ${p('CTA_URL')}`,
    ]),
  },
  [CENTRAL_EMAIL_TEMPLATE_ALIASES.commentAdded]: {
    alias: CENTRAL_EMAIL_TEMPLATE_ALIASES.commentAdded,
    name: CENTRAL_EMAIL_TEMPLATE_ALIASES.commentAdded,
    subject: 'New comment in Central',
    variables: [
      ...commonTaskVariables,
      { key: 'COMMENTER_NAME', type: 'string', required: true },
      commentPreviewVariable,
    ],
    sampleVariables: commentAddedSample,
    renderHtml: () => commentAddedEmailHtml(asCommentAddedData(commentAddedSample)),
    text: templateText([
      'New comment in Central',
      '',
      `${p('COMMENTER_NAME')} commented on "${p('TASK_TITLE')}".`,
      `Comment: ${p('COMMENT_PREVIEW')}`,
      `Status: ${p('TASK_STATUS')}`,
      `Due: ${p('TASK_DUE_DATE')}`,
      '',
      `View comment: ${p('CTA_URL')}`,
    ]),
  },
  [CENTRAL_EMAIL_TEMPLATE_ALIASES.taskAssigned]: {
    alias: CENTRAL_EMAIL_TEMPLATE_ALIASES.taskAssigned,
    name: CENTRAL_EMAIL_TEMPLATE_ALIASES.taskAssigned,
    subject: 'New task assignment in Central',
    variables: [
      ...commonTaskVariables,
      ...taskLocationVariables,
      { key: 'ASSIGNER_NAME', type: 'string', required: true },
      { key: 'TASK_DESCRIPTION', type: 'string', fallbackValue: 'No description provided.' },
    ],
    sampleVariables: assignmentSample,
    renderHtml: () => taskAssignedEmailHtml(asTaskAssignedData(assignmentSample)),
    text: templateText([
      'New task assignment in Central',
      '',
      `${p('ASSIGNER_NAME')} assigned you to "${p('TASK_TITLE')}".`,
      `Project: ${p('CLIENT_NAME')} / ${p('BOARD_NAME')}`,
      `Status: ${p('TASK_STATUS')}`,
      `Due: ${p('TASK_DUE_DATE')}`,
      `Description: ${p('TASK_DESCRIPTION')}`,
      '',
      `View task: ${p('CTA_URL')}`,
    ]),
  },
  [CENTRAL_EMAIL_TEMPLATE_ALIASES.taskDueSoon]: {
    alias: CENTRAL_EMAIL_TEMPLATE_ALIASES.taskDueSoon,
    name: CENTRAL_EMAIL_TEMPLATE_ALIASES.taskDueSoon,
    subject: 'Task due soon in Central',
    variables: [
      ...commonTaskVariables,
      ...taskLocationVariables,
    ],
    sampleVariables: dueSample,
    renderHtml: () => taskDueEmailHtml(asTaskDueData(dueSample, false)),
    text: templateText([
      'Task due soon in Central',
      '',
      `"${p('TASK_TITLE')}" is due on ${p('TASK_DUE_DATE')}.`,
      `Project: ${p('CLIENT_NAME')} / ${p('BOARD_NAME')}`,
      `Status: ${p('TASK_STATUS')}`,
      '',
      `View task: ${p('CTA_URL')}`,
    ]),
  },
  [CENTRAL_EMAIL_TEMPLATE_ALIASES.taskOverdue]: {
    alias: CENTRAL_EMAIL_TEMPLATE_ALIASES.taskOverdue,
    name: CENTRAL_EMAIL_TEMPLATE_ALIASES.taskOverdue,
    subject: 'Task overdue in Central',
    variables: [
      ...commonTaskVariables,
      ...taskLocationVariables,
    ],
    sampleVariables: dueSample,
    renderHtml: () => taskDueEmailHtml(asTaskDueData(dueSample, true)),
    text: templateText([
      'Task overdue in Central',
      '',
      `"${p('TASK_TITLE')}" was due on ${p('TASK_DUE_DATE')}.`,
      `Project: ${p('CLIENT_NAME')} / ${p('BOARD_NAME')}`,
      `Status: ${p('TASK_STATUS')}`,
      '',
      `View task: ${p('CTA_URL')}`,
    ]),
  },
  [CENTRAL_EMAIL_TEMPLATE_ALIASES.dailyDigest]: {
    alias: CENTRAL_EMAIL_TEMPLATE_ALIASES.dailyDigest,
    name: CENTRAL_EMAIL_TEMPLATE_ALIASES.dailyDigest,
    subject: 'Your Central daily digest',
    variables: [
      { key: 'RECIPIENT_NAME', type: 'string', fallbackValue: 'there' },
      { key: 'DIGEST_DATE', type: 'string', required: true },
      { key: 'SUMMARY_TEXT', type: 'string', fallbackValue: 'Here is what needs your attention in Central today.' },
      { key: 'TASKS_OVERDUE_COUNT', type: 'number', fallbackValue: 0 },
      { key: 'TASKS_DUE_TODAY_COUNT', type: 'number', fallbackValue: 0 },
      { key: 'TASKS_DUE_TOMORROW_COUNT', type: 'number', fallbackValue: 0 },
      { key: 'UNREAD_NOTIFICATIONS_COUNT', type: 'number', fallbackValue: 0 },
      { key: 'CTA_URL', type: 'string', required: true },
    ],
    sampleVariables: dailyDigestSample,
    renderHtml: () => dailyDigestEmailHtml(asDailyDigestData(dailyDigestSample)),
    text: templateText([
      'Your Central daily digest',
      '',
      `${p('SUMMARY_TEXT')}`,
      '',
      `Overdue: ${p('TASKS_OVERDUE_COUNT')}`,
      `Due today: ${p('TASKS_DUE_TODAY_COUNT')}`,
      `Due tomorrow: ${p('TASKS_DUE_TOMORROW_COUNT')}`,
      `Unread notifications: ${p('UNREAD_NOTIFICATIONS_COUNT')}`,
      '',
      `View My Tasks: ${p('CTA_URL')}`,
    ]),
  },
  [CENTRAL_EMAIL_TEMPLATE_ALIASES.invitation]: {
    alias: CENTRAL_EMAIL_TEMPLATE_ALIASES.invitation,
    name: CENTRAL_EMAIL_TEMPLATE_ALIASES.invitation,
    subject: "You've been invited to Central",
    variables: [
      { key: 'INVITER_NAME', type: 'string', required: true },
      { key: 'INVITE_URL', type: 'string', required: true },
    ],
    sampleVariables: invitationSample,
    renderHtml: () => invitationEmailHtml(invitationSample.INVITER_NAME, invitationSample.INVITE_URL),
    text: templateText([
      "You've been invited to Central",
      '',
      `${p('INVITER_NAME')} has invited you to join Central.`,
      `Accept invitation: ${p('INVITE_URL')}`,
    ]),
  },
  [CENTRAL_EMAIL_TEMPLATE_ALIASES.emailVerification]: {
    alias: CENTRAL_EMAIL_TEMPLATE_ALIASES.emailVerification,
    name: CENTRAL_EMAIL_TEMPLATE_ALIASES.emailVerification,
    subject: 'Verify your email for Central',
    variables: [
      { key: 'USER_NAME', type: 'string', fallbackValue: 'there' },
      { key: 'VERIFICATION_URL', type: 'string', required: true },
    ],
    sampleVariables: emailVerificationSample,
    renderHtml: async () => {
      const template = await emailVerificationTemplate({
        name: emailVerificationSample.USER_NAME,
        verificationUrl: emailVerificationSample.VERIFICATION_URL,
      });

      return template.html;
    },
    text: templateText([
      'Verify your email for Central',
      '',
      `Hi ${p('USER_NAME')},`,
      'Please verify your email address to complete your Central registration.',
      `Verify email: ${p('VERIFICATION_URL')}`,
    ]),
  },
  [CENTRAL_EMAIL_TEMPLATE_ALIASES.emailVerified]: {
    alias: CENTRAL_EMAIL_TEMPLATE_ALIASES.emailVerified,
    name: CENTRAL_EMAIL_TEMPLATE_ALIASES.emailVerified,
    subject: 'Email verified - Welcome to Central',
    variables: [
      { key: 'USER_NAME', type: 'string', fallbackValue: 'there' },
      { key: 'LOGIN_URL', type: 'string', required: true },
    ],
    sampleVariables: emailVerifiedSample,
    renderHtml: async () => {
      const template = await emailVerifiedTemplate({
        name: emailVerifiedSample.USER_NAME,
        loginUrl: emailVerifiedSample.LOGIN_URL,
      });

      return template.html;
    },
    text: templateText([
      'Email verified - Welcome to Central',
      '',
      `Hi ${p('USER_NAME')},`,
      'Your email has been verified successfully.',
      `Sign in: ${p('LOGIN_URL')}`,
    ]),
  },
  [CENTRAL_EMAIL_TEMPLATE_ALIASES.passwordReset]: {
    alias: CENTRAL_EMAIL_TEMPLATE_ALIASES.passwordReset,
    name: CENTRAL_EMAIL_TEMPLATE_ALIASES.passwordReset,
    subject: 'Reset your password for Central',
    variables: [
      { key: 'USER_NAME', type: 'string', fallbackValue: 'there' },
      { key: 'ADMIN_NAME', type: 'string', required: true },
      { key: 'RESET_URL', type: 'string', required: true },
    ],
    sampleVariables: passwordResetSample,
    renderHtml: async () => {
      const template = await adminPasswordResetTemplate({
        name: passwordResetSample.USER_NAME,
        adminName: passwordResetSample.ADMIN_NAME,
        resetUrl: passwordResetSample.RESET_URL,
      });

      return template.html;
    },
    text: templateText([
      'Reset your password for Central',
      '',
      `${p('ADMIN_NAME')} has sent you a link to reset your password for Central.`,
      `Reset password: ${p('RESET_URL')}`,
    ]),
  },
} satisfies Record<CentralEmailTemplateAlias, CentralEmailTemplateDefinition>;

export const CENTRAL_EMAIL_TEMPLATE_LIST = Object.values(CENTRAL_EMAIL_TEMPLATES);

export function getCentralEmailTemplate(alias: CentralEmailTemplateAlias): CentralEmailTemplateDefinition {
  return CENTRAL_EMAIL_TEMPLATES[alias];
}
