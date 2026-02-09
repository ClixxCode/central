import { getAppUrl } from '../client';

/**
 * Base email template wrapper with consistent styling
 */
export function baseEmailTemplate(content: string, preheader?: string): string {
  const preheaderHtml = preheader
    ? `<span style="display:none;font-size:1px;color:#ffffff;line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;">${preheader}</span>`
    : '';

  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="color-scheme" content="light">
    <meta name="supported-color-schemes" content="light">
    <title>Central</title>
  </head>
  <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 0; background-color: #f3f4f6;">
    ${preheaderHtml}
    <div style="background-color: #f3f4f6; padding: 20px;">
      <div style="background: linear-gradient(135deg, #3B82F6 0%, #1D4ED8 100%); padding: 24px; border-radius: 12px 12px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 20px; font-weight: 600;">Central</h1>
      </div>
      <div style="background: #ffffff; padding: 24px; border-radius: 0 0 12px 12px; border: 1px solid #e5e7eb; border-top: none;">
        ${content}
      </div>
      <div style="text-align: center; padding: 16px;">
        <p style="color: #9ca3af; font-size: 12px; margin: 0;">
          Clix Digital Marketing Agency
        </p>
        <p style="color: #9ca3af; font-size: 11px; margin: 8px 0 0;">
          <a href="${getAppUrl()}/settings/notifications" style="color: #6b7280; text-decoration: underline;">Manage notification preferences</a>
        </p>
      </div>
    </div>
  </body>
</html>`;
}

/**
 * Styled button for email CTAs
 */
export function emailButton(text: string, href: string): string {
  return `<a href="${href}" style="display: inline-block; background: #3B82F6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px;">${text}</a>`;
}

/**
 * Task card component for emails
 */
export function taskCard(task: {
  title: string;
  status: string;
  dueDate?: string;
  clientName?: string;
  boardName?: string;
}): string {
  const dueDateHtml = task.dueDate
    ? `<span style="color: #6b7280; font-size: 13px;">Due: ${task.dueDate}</span>`
    : '';

  const locationHtml = task.clientName || task.boardName
    ? `<span style="color: #9ca3af; font-size: 12px;">${[task.clientName, task.boardName].filter(Boolean).join(' / ')}</span>`
    : '';

  return `<div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px; margin: 8px 0;">
    <div style="font-weight: 500; color: #111827; margin-bottom: 4px;">${task.title}</div>
    <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
      <span style="background: #dbeafe; color: #1e40af; padding: 2px 8px; border-radius: 4px; font-size: 12px; font-weight: 500;">${task.status}</span>
      ${dueDateHtml}
    </div>
    ${locationHtml ? `<div style="margin-top: 4px;">${locationHtml}</div>` : ''}
  </div>`;
}

/**
 * Format a date for display in emails
 */
export function formatEmailDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}
