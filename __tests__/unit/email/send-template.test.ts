import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CENTRAL_EMAIL_TEMPLATE_ALIASES,
  RESEND_STRING_VARIABLE_MAX_LENGTH,
} from '@/lib/email/templates';
import {
  normalizeTemplateVariables,
  sendCentralTemplateEmail,
} from '@/lib/email/send-template';

const sendMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/email/client', () => ({
  EMAIL_CONFIG: {
    from: 'Central <noreply@central.test>',
    replyTo: 'support@central.test',
  },
  getAppUrl: () => 'https://app.central.test',
  resend: {
    emails: {
      send: sendMock,
    },
  },
}));

describe('sendCentralTemplateEmail', () => {
  beforeEach(() => {
    sendMock.mockReset();
    sendMock.mockResolvedValue({ data: { id: 'email-123' }, error: null });
  });

  it('sends a hosted Resend template with config and normalized variables', async () => {
    await sendCentralTemplateEmail({
      templateAlias: CENTRAL_EMAIL_TEMPLATE_ALIASES.mention,
      to: 'user@example.com',
      subject: 'Alice mentioned you in "Review PR"',
      variables: {
        RECIPIENT_NAME: 'Bob',
        MENTIONER_NAME: 'Alice',
        TASK_TITLE: 'Review PR',
        TASK_STATUS: 'In Progress',
        CTA_URL: 'https://app.central.test/t/task-123',
      },
    });

    expect(sendMock).toHaveBeenCalledWith({
      from: 'Central <noreply@central.test>',
      replyTo: 'support@central.test',
      to: 'user@example.com',
      subject: 'Alice mentioned you in "Review PR"',
      template: {
        id: 'central_mention',
        variables: {
          RECIPIENT_NAME: 'Bob',
          MENTIONER_NAME: 'Alice',
          TASK_TITLE: 'Review PR',
          TASK_STATUS: 'In Progress',
          TASK_STATUS_COLOR: '#6B7280',
          TASK_STATUS_BACKGROUND_COLOR: 'rgba(107, 114, 128, 0.12)',
          TASK_DUE_DATE: 'No due date',
          COMMENT_PREVIEW: 'Open Central to view the full comment.',
          CTA_URL: 'https://app.central.test/t/task-123',
        },
      },
    });
  });

  it('falls back to the registry subject when none is provided', async () => {
    await sendCentralTemplateEmail({
      templateAlias: CENTRAL_EMAIL_TEMPLATE_ALIASES.invitation,
      to: 'new@example.com',
      variables: {
        INVITER_NAME: 'Admin',
        INVITE_URL: 'https://app.central.test/invite/token',
      },
    });

    expect(sendMock).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: "You've been invited to Central",
        template: expect.objectContaining({ id: 'central_invitation' }),
      })
    );
  });

  it('throws when Resend returns an API error', async () => {
    sendMock.mockResolvedValueOnce({
      data: null,
      error: {
        message: 'Domain is not verified',
        name: 'validation_error',
        statusCode: 422,
      },
      headers: null,
    });

    await expect(
      sendCentralTemplateEmail({
        templateAlias: CENTRAL_EMAIL_TEMPLATE_ALIASES.invitation,
        to: 'new@example.com',
        variables: {
          INVITER_NAME: 'Admin',
          INVITE_URL: 'https://app.central.test/invite/token',
        },
      })
    ).rejects.toThrow(
      'Resend email send failed (validation_error 422): Domain is not verified'
    );
  });
});

describe('normalizeTemplateVariables', () => {
  const definitions = [
    { key: 'NAME', type: 'string' as const, required: true },
    { key: 'BODY', type: 'string' as const, fallbackValue: 'Fallback body' },
    { key: 'COUNT', type: 'number' as const, fallbackValue: 0 },
    { key: 'CTA_URL', type: 'string' as const, required: true },
  ];

  it('throws when a required variable is missing', () => {
    expect(() =>
      normalizeTemplateVariables(definitions, {
        NAME: 'Ada',
        CTA_URL: 'https://app.central.test',
      })
    ).not.toThrow();

    expect(() =>
      normalizeTemplateVariables(definitions, {
        CTA_URL: 'https://app.central.test',
      })
    ).toThrow('Missing required email template variable: NAME');
  });

  it('rejects non-http URL variables', () => {
    expect(() =>
      normalizeTemplateVariables(definitions, {
        NAME: 'Ada',
        CTA_URL: 'javascript:alert(1)',
      })
    ).toThrow('Email template URL must use http or https: CTA_URL');
  });

  it('truncates long string variables to Resend limits', () => {
    const longBody = 'x'.repeat(RESEND_STRING_VARIABLE_MAX_LENGTH + 50);

    const normalized = normalizeTemplateVariables(definitions, {
      NAME: 'Ada',
      BODY: longBody,
      CTA_URL: 'https://app.central.test',
    });

    expect(String(normalized.BODY)).toHaveLength(RESEND_STRING_VARIABLE_MAX_LENGTH);
    expect(String(normalized.BODY).endsWith('...')).toBe(true);
  });
});
