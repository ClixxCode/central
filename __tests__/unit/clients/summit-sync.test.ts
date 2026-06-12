import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  MATERIAL_SYMBOLS_ICON_SET_VERSION,
  mapClientForSummit,
  notifySummitClientChange,
  type SummitClientPayload,
} from '@/lib/clients/summit-sync';

const OLD_ENV = process.env;

describe('Summit client sync', () => {
  beforeEach(() => {
    process.env = { ...OLD_ENV };
  });

  afterEach(() => {
    process.env = OLD_ENV;
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('maps full client payloads with ISO dates and icon registry version', () => {
    const payload = mapClientForSummit({
      id: 'client-1',
      name: 'Acme',
      slug: 'acme',
      color: '#14B8A6',
      icon: 'storefront',
      metadata: {
        industry: 'Retail',
        tags: ['priority'],
        links: [{ name: 'Website', url: 'https://example.com', showOnCard: true }],
      },
      leadUserId: 'user-1',
      defaultBoardId: 'board-1',
      createdAt: new Date('2026-06-12T16:30:00.000Z'),
    });

    expect(payload).toEqual({
      id: 'client-1',
      name: 'Acme',
      slug: 'acme',
      color: '#14B8A6',
      icon: 'storefront',
      metadata: {
        industry: 'Retail',
        tags: ['priority'],
        links: [{ name: 'Website', url: 'https://example.com', showOnCard: true }],
      },
      leadUserId: 'user-1',
      defaultBoardId: 'board-1',
      createdAt: '2026-06-12T16:30:00.000Z',
      iconSetVersion: MATERIAL_SYMBOLS_ICON_SET_VERSION,
    });
  });

  it('no-ops when webhook env vars are missing', async () => {
    delete process.env.SUMMIT_CLIENT_WEBHOOK_URL;
    delete process.env.SUMMIT_CLIENT_WEBHOOK_SECRET;
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await notifySummitClientChange('client.upserted', clientPayload());

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('posts authenticated client change events to Summit', async () => {
    process.env.SUMMIT_CLIENT_WEBHOOK_URL = 'https://summit.example.test/webhooks/clients';
    process.env.SUMMIT_CLIENT_WEBHOOK_SECRET = 'secret-value';
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve('ok'),
    });
    vi.stubGlobal('fetch', fetchMock);

    await notifySummitClientChange('client.deleted', clientPayload());

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://summit.example.test/webhooks/clients',
      expect.objectContaining({
        method: 'POST',
        headers: {
          'Authorization': 'Bearer secret-value',
          'Content-Type': 'application/json',
        },
      })
    );
    const requestBody = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(requestBody).toMatchObject({
      event: 'client.deleted',
      client: clientPayload(),
    });
    expect(new Date(requestBody.sentAt).toISOString()).toBe(requestBody.sentAt);
  });

  it('logs webhook failures without throwing', async () => {
    process.env.SUMMIT_CLIENT_WEBHOOK_URL = 'https://summit.example.test/webhooks/clients';
    process.env.SUMMIT_CLIENT_WEBHOOK_SECRET = 'secret-value';
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: () => Promise.resolve('server error'),
      })
    );
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(notifySummitClientChange('client.upserted', clientPayload())).resolves.toBeUndefined();

    expect(errorSpy).toHaveBeenCalledWith('Summit client webhook failed:', 500, 'server error');
  });
});

function clientPayload(): SummitClientPayload {
  return {
    id: 'client-1',
    name: 'Acme',
    slug: 'acme',
    color: '#14B8A6',
    icon: 'storefront',
    metadata: { industry: 'Retail' },
    leadUserId: 'user-1',
    defaultBoardId: 'board-1',
    createdAt: '2026-06-12T16:30:00.000Z',
    iconSetVersion: MATERIAL_SYMBOLS_ICON_SET_VERSION,
  };
}
