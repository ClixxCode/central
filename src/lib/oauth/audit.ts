import { db } from '@/lib/db';
import { oauthAuditEvents } from '@/lib/db/schema';

export function recordOAuthAudit(input: {
  userId?: string | null;
  clientId?: string | null;
  event: string;
  toolName?: string | null;
  outcome: 'success' | 'denied' | 'error';
  durationMs?: number;
  metadata?: Record<string, unknown>;
}): void {
  void db
    .insert(oauthAuditEvents)
    .values({
      userId: input.userId ?? null,
      clientId: input.clientId ?? null,
      event: input.event,
      toolName: input.toolName ?? null,
      outcome: input.outcome,
      durationMs: input.durationMs,
      metadata: input.metadata,
    })
    .catch((error) => console.error('[oauth-audit] Failed to record event', error));
}
