import { getAppUrl } from '../client';

/**
 * Base email template wrapper with consistent dark-mode styling
 */
export function baseEmailTemplate(content: string, preheader?: string): string {
  const appUrl = getAppUrl();
  const preheaderHtml = preheader
    ? `<span style="display:none;font-size:1px;color:#1a1a1f;line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;">${preheader}</span>`
    : '';

  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="color-scheme" content="dark">
    <meta name="supported-color-schemes" content="dark">
    <title>Central</title>
  </head>
  <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #f5f5f5; max-width: 600px; margin: 0 auto; padding: 0; background-color: #1a1a1f;">
    ${preheaderHtml}
    <div style="background-color: #1a1a1f; padding: 20px;">
      <div style="text-align: center; padding: 24px 0 16px;">
        <img src="${appUrl}/clix_logo_white.png" alt="Clix" width="36" height="36" style="display: inline-block; vertical-align: middle; margin-right: 10px;" />
        <span style="color: #f5f5f5; font-size: 20px; font-weight: 600; vertical-align: middle;">Central</span>
      </div>
      <div style="background: #262629; padding: 24px; border-radius: 12px; border: 1px solid #42424a;">
        ${content}
      </div>
      <div style="text-align: center; padding: 16px;">
        <p style="color: #6b6b74; font-size: 12px; margin: 0;">
          Clix Digital Marketing Agency
        </p>
        <p style="color: #6b6b74; font-size: 11px; margin: 8px 0 0;">
          <a href="${appUrl}/settings/notifications" style="color: #C4959C; text-decoration: underline;">Manage notification preferences</a>
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
  return `<a href="${href}" style="display: inline-block; background: #f5f5f5; color: #1a1a1f; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px;">${text}</a>`;
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
    ? `<span style="color: #a0a0a8; font-size: 13px;">Due: ${task.dueDate}</span>`
    : '';

  const locationHtml = task.clientName || task.boardName
    ? `<span style="color: #6b6b74; font-size: 12px;">${[task.clientName, task.boardName].filter(Boolean).join(' / ')}</span>`
    : '';

  return `<div style="background: #333338; border: 1px solid #42424a; border-radius: 8px; padding: 12px; margin: 8px 0;">
    <div style="font-weight: 500; color: #f5f5f5; margin-bottom: 4px;">${task.title}</div>
    <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
      <span style="background: #42424a; color: #d0d0d5; padding: 2px 8px; border-radius: 4px; font-size: 12px; font-weight: 500;">${task.status}</span>
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
