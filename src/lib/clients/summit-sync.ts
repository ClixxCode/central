import materialSymbolsPackage from 'material-symbols/package.json';

import type { ClientMetadata } from '@/lib/db/schema';

export const MATERIAL_SYMBOLS_ICON_SET_VERSION = materialSymbolsPackage.version;

export type SummitClientPayload = {
  id: string;
  name: string;
  slug: string;
  color: string | null;
  icon: string | null;
  metadata: ClientMetadata | null;
  leadUserId: string | null;
  defaultBoardId: string | null;
  createdAt: string;
  iconSetVersion: string;
};

export type SummitClientEvent = 'client.upserted' | 'client.deleted';

type ClientPayloadSource = {
  id: string;
  name: string;
  slug: string;
  color: string | null;
  icon: string | null;
  metadata: ClientMetadata | null;
  leadUserId: string | null;
  defaultBoardId: string | null;
  createdAt: Date | string;
};

export function mapClientForSummit(client: ClientPayloadSource): SummitClientPayload {
  return {
    id: client.id,
    name: client.name,
    slug: client.slug,
    color: client.color,
    icon: client.icon,
    metadata: client.metadata,
    leadUserId: client.leadUserId,
    defaultBoardId: client.defaultBoardId,
    createdAt: client.createdAt instanceof Date ? client.createdAt.toISOString() : client.createdAt,
    iconSetVersion: MATERIAL_SYMBOLS_ICON_SET_VERSION,
  };
}

export async function notifySummitClientChange(
  event: SummitClientEvent,
  client: SummitClientPayload
): Promise<void> {
  const webhookUrl = process.env.SUMMIT_CLIENT_WEBHOOK_URL;
  const webhookSecret = process.env.SUMMIT_CLIENT_WEBHOOK_SECRET;

  if (!webhookUrl || !webhookSecret) {
    return;
  }

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${webhookSecret}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        event,
        sentAt: new Date().toISOString(),
        client,
      }),
    });

    if (!response.ok) {
      const responseText = await response.text().catch(() => '');
      console.error('Summit client webhook failed:', response.status, responseText);
    }
  } catch (error) {
    console.error('Summit client webhook error:', error);
  }
}
