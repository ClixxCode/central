/**
 * Slack Bot API Client
 *
 * Handles sending direct messages to users via the Slack Bot API.
 * Requires SLACK_BOT_TOKEN to be set in environment variables.
 */

export interface SlackMessage {
  text?: string;
  blocks?: SlackBlock[];
  attachments?: SlackAttachment[];
}

export interface SlackTextObject {
  type: 'plain_text' | 'mrkdwn';
  text: string;
  emoji?: boolean;
}

export interface SlackBlockElement {
  type: string;
  text?: SlackTextObject | string;
  url?: string;
  action_id?: string;
  value?: string;
}

export interface SlackBlock {
  type: string;
  text?: SlackTextObject;
  elements?: (SlackBlockElement | SlackTextObject)[];
  accessory?: SlackBlockElement;
  fields?: SlackTextObject[];
}

export interface SlackAttachment {
  color?: string;
  fallback?: string;
  pretext?: string;
  author_name?: string;
  title?: string;
  title_link?: string;
  text?: string;
  fields?: { title: string; value: string; short?: boolean }[];
  footer?: string;
  ts?: number;
}

export interface SlackWebhookResponse {
  success: boolean;
  error?: string;
  statusCode?: number;
}

export interface SlackUser {
  id: string;
  name: string;
  real_name?: string;
}

/**
 * Get the Slack bot token from environment
 */
function getSlackBotToken(): string | undefined {
  return process.env.SLACK_BOT_TOKEN;
}

/**
 * Find a Slack user by username
 */
export async function findSlackUser(username: string): Promise<SlackUser | null> {
  const token = getSlackBotToken();

  if (!token) {
    console.error('SLACK_BOT_TOKEN not configured');
    return null;
  }

  const cleanUsername = username.trim().replace(/^@/, '').toLowerCase();

  try {
    // Use users.list to find the user
    const response = await fetch('https://slack.com/api/users.list', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();

    if (!data.ok) {
      console.error('Slack API error:', data.error);
      return null;
    }

    // Find user by matching name or display_name
    const user = data.members?.find((member: any) => {
      if (member.deleted || member.is_bot) return false;

      const name = member.name?.toLowerCase();
      const realName = member.real_name?.toLowerCase();
      const displayName = member.profile?.display_name?.toLowerCase();

      return name === cleanUsername ||
             realName === cleanUsername ||
             displayName === cleanUsername;
    });

    if (!user) {
      return null;
    }

    return {
      id: user.id,
      name: user.name,
      real_name: user.real_name,
    };
  } catch (error) {
    console.error('Error finding Slack user:', error);
    return null;
  }
}

/**
 * Send a direct message to a Slack user
 */
export async function sendSlackDirectMessage(
  userId: string,
  message: SlackMessage
): Promise<SlackWebhookResponse> {
  const token = getSlackBotToken();

  if (!token) {
    return {
      success: false,
      error: 'SLACK_BOT_TOKEN not configured',
    };
  }

  if (!userId) {
    return {
      success: false,
      error: 'User ID is required',
    };
  }

  try {
    const response = await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        channel: userId,
        unfurl_links: false,
        unfurl_media: false,
        ...message,
      }),
    });

    const data = await response.json();

    if (data.ok) {
      return { success: true };
    }

    // Handle specific Slack API errors
    let errorMessage = data.error || 'Failed to send Slack message';

    if (data.error === 'channel_not_found' || data.error === 'user_not_found') {
      errorMessage = 'User not found or bot lacks permission to message them';
    } else if (data.error === 'not_in_channel') {
      errorMessage = 'Bot is not in the channel';
    } else if (data.error === 'invalid_auth' || data.error === 'account_inactive') {
      errorMessage = 'Invalid or inactive Slack bot token';
    } else if (data.error === 'rate_limited') {
      errorMessage = 'Rate limited - too many requests';
    }

    return {
      success: false,
      error: errorMessage,
      statusCode: response.status,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      error: `Network error: ${errorMessage}`,
    };
  }
}

/**
 * Send a message to a Slack user by username
 */
export async function sendSlackMessageToUser(
  username: string,
  message: SlackMessage
): Promise<SlackWebhookResponse> {
  // Find the user first
  const user = await findSlackUser(username);

  if (!user) {
    return {
      success: false,
      error: `Slack user not found: ${username}`,
    };
  }

  // Send DM to the user
  return sendSlackDirectMessage(user.id, message);
}

/**
 * Test Slack bot connection by sending a test DM to a user
 */
export async function testSlackBot(username: string): Promise<SlackWebhookResponse> {
  const testMessage: SlackMessage = {
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: ':white_check_mark: *Connection test successful!*\n\nYour Slack notifications are now configured.',
        },
      },
    ],
  };

  return sendSlackMessageToUser(username, testMessage);
}

/**
 * Validates a Slack webhook URL format
 */
export function isValidSlackWebhookUrl(url: string): boolean {
  if (!url) return false;

  try {
    const parsed = new URL(url);
    // Slack webhooks must be HTTPS and from hooks.slack.com
    return (
      parsed.protocol === 'https:' &&
      parsed.hostname === 'hooks.slack.com' &&
      parsed.pathname.startsWith('/services/')
    );
  } catch {
    return false;
  }
}

/**
 * Send a message to Slack via webhook
 */
export async function sendSlackMessage(
  webhookUrl: string,
  message: SlackMessage
): Promise<SlackWebhookResponse> {
  if (!isValidSlackWebhookUrl(webhookUrl)) {
    return {
      success: false,
      error: 'Invalid Slack webhook URL',
    };
  }

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });

    // Slack returns 'ok' as text for successful requests
    const responseText = await response.text();

    if (response.ok && responseText === 'ok') {
      return { success: true };
    }

    // Handle specific Slack error responses
    let errorMessage = 'Failed to send Slack message';

    if (response.status === 400) {
      errorMessage = 'Invalid message format';
    } else if (response.status === 403) {
      errorMessage = 'Webhook URL is invalid or revoked';
    } else if (response.status === 404) {
      errorMessage = 'Webhook URL not found - channel may be archived';
    } else if (response.status === 410) {
      errorMessage = 'Webhook URL has been deleted';
    } else if (response.status === 429) {
      errorMessage = 'Rate limited - too many requests';
    } else if (response.status >= 500) {
      errorMessage = 'Slack server error - try again later';
    } else if (responseText) {
      errorMessage = responseText;
    }

    return {
      success: false,
      error: errorMessage,
      statusCode: response.status,
    };
  } catch (error) {
    // Network errors, timeouts, etc.
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      error: `Network error: ${errorMessage}`,
    };
  }
}

/**
 * Test a Slack webhook by sending a test message
 */
export async function testSlackWebhook(webhookUrl: string): Promise<SlackWebhookResponse> {
  const testMessage: SlackMessage = {
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: ':white_check_mark: *Central connection test successful!*\n\nYour Slack notifications are now configured.',
        },
      },
    ],
  };

  return sendSlackMessage(webhookUrl, testMessage);
}
