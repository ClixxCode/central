import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  isValidSlackWebhookUrl,
  sendSlackMessage,
  testSlackWebhook,
  type SlackMessage,
} from '@/lib/slack/client';

// Build test webhook URL dynamically to avoid triggering GitHub secret scanning
const TEST_WEBHOOK_URL = [
  'https:/',
  '/hooks.slack.com',
  '/services',
  '/T00000000',
  '/B00000000',
  '/XXXXXXXXXXXXXXXXXXXXXXXX',
].join('');

describe('Slack Client', () => {
  describe('isValidSlackWebhookUrl', () => {
    it('accepts valid Slack webhook URLs', () => {
      expect(
        isValidSlackWebhookUrl(TEST_WEBHOOK_URL)
      ).toBe(true);
    });

    it('rejects HTTP URLs', () => {
      expect(
        isValidSlackWebhookUrl(TEST_WEBHOOK_URL.replace('https://', 'http://'))
      ).toBe(false);
    });

    it('rejects non-Slack URLs', () => {
      expect(isValidSlackWebhookUrl('https://example.com/webhook')).toBe(false);
      expect(isValidSlackWebhookUrl('https://api.slack.com/something')).toBe(false);
    });

    it('rejects URLs without /services/ path', () => {
      expect(isValidSlackWebhookUrl('https://hooks.slack.com/other/path')).toBe(false);
    });

    it('rejects empty strings', () => {
      expect(isValidSlackWebhookUrl('')).toBe(false);
    });

    it('rejects invalid URLs', () => {
      expect(isValidSlackWebhookUrl('not-a-url')).toBe(false);
    });
  });

  describe('sendSlackMessage', () => {
    beforeEach(() => {
      vi.stubGlobal('fetch', vi.fn());
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it('returns error for invalid webhook URL', async () => {
      const result = await sendSlackMessage('invalid-url', { text: 'Hello' });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid Slack webhook URL');
    });

    it('sends message to valid webhook URL', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve('ok'),
      });
      vi.stubGlobal('fetch', mockFetch);

      const webhookUrl = TEST_WEBHOOK_URL;
      const message: SlackMessage = { text: 'Hello World' };

      const result = await sendSlackMessage(webhookUrl, message);

      expect(result.success).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(message),
      });
    });

    it('handles 400 Bad Request errors', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: false,
          status: 400,
          text: () => Promise.resolve('invalid_payload'),
        })
      );

      const webhookUrl = TEST_WEBHOOK_URL;
      const result = await sendSlackMessage(webhookUrl, { text: 'Hello' });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid message format');
      expect(result.statusCode).toBe(400);
    });

    it('handles 403 Forbidden errors', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: false,
          status: 403,
          text: () => Promise.resolve(''),
        })
      );

      const webhookUrl = TEST_WEBHOOK_URL;
      const result = await sendSlackMessage(webhookUrl, { text: 'Hello' });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Webhook URL is invalid or revoked');
      expect(result.statusCode).toBe(403);
    });

    it('handles 404 Not Found errors', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: false,
          status: 404,
          text: () => Promise.resolve(''),
        })
      );

      const webhookUrl = TEST_WEBHOOK_URL;
      const result = await sendSlackMessage(webhookUrl, { text: 'Hello' });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Webhook URL not found - channel may be archived');
      expect(result.statusCode).toBe(404);
    });

    it('handles 410 Gone errors', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: false,
          status: 410,
          text: () => Promise.resolve(''),
        })
      );

      const webhookUrl = TEST_WEBHOOK_URL;
      const result = await sendSlackMessage(webhookUrl, { text: 'Hello' });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Webhook URL has been deleted');
    });

    it('handles 429 Rate Limit errors', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: false,
          status: 429,
          text: () => Promise.resolve(''),
        })
      );

      const webhookUrl = TEST_WEBHOOK_URL;
      const result = await sendSlackMessage(webhookUrl, { text: 'Hello' });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Rate limited - too many requests');
    });

    it('handles 5xx Server errors', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: false,
          status: 500,
          text: () => Promise.resolve(''),
        })
      );

      const webhookUrl = TEST_WEBHOOK_URL;
      const result = await sendSlackMessage(webhookUrl, { text: 'Hello' });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Slack server error - try again later');
    });

    it('handles network errors', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));

      const webhookUrl = TEST_WEBHOOK_URL;
      const result = await sendSlackMessage(webhookUrl, { text: 'Hello' });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Network error: Network error');
    });
  });

  describe('testSlackWebhook', () => {
    beforeEach(() => {
      vi.stubGlobal('fetch', vi.fn());
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it('sends a test message with success indicator', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve('ok'),
      });
      vi.stubGlobal('fetch', mockFetch);

      const webhookUrl = TEST_WEBHOOK_URL;
      const result = await testSlackWebhook(webhookUrl);

      expect(result.success).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Verify the message format
      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);
      expect(body.blocks).toBeDefined();
      expect(body.blocks[0].text.text).toContain('connection test successful');
    });
  });
});
