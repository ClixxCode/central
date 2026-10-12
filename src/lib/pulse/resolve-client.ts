import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { clients } from '@/lib/db/schema';
import type { ClientMetadata } from '@/lib/db/schema';

/**
 * THE single rule for "which Central client is this Pulse account?".
 *
 * This existed twice, with two different answers, and that is what produced
 * five duplicate clients (Hill Vision Services, My Best Friend Veterinary
 * Center, Filtration Systems Products Inc., Oakes & Fosher LLC, Automated
 * Gasket Corp) plus 15 onboarding tasks stranded on the shells, 3 each:
 *
 *   - client-onboarded matched on slug, then metadata, and never wrote the
 *     pulse_account_id COLUMN at all.
 *   - account-updated matched on the column, then slug, then metadata, and
 *     did write the column.
 *
 * So the originals ended up holding the column with null metadata, the
 * duplicates holding the metadata with a null column, and the onboarding
 * bridge could only ever find clients it had created itself. Both webhooks
 * now call this, so the two can no longer drift apart.
 *
 * Order is deliberate:
 *   1. pulse_account_id  - the only real identity. Authoritative.
 *   2. slug              - for clients that predate the column. Still needed:
 *                          6 live clients carry neither the column nor the
 *                          metadata field, and slug is the only way to reach
 *                          them. Narrows to zero as the backfill below runs.
 *   3. metadata          - legacy mirror written by the onboarding bridge
 *                          before the column existed.
 *
 * SLUG IS NEVER WRITTEN BACK. It is the client's URL identity
 * (/clients/{slug}/boards/{id}) and carries a UNIQUE constraint. Syncing it
 * from Pulse, which derives it as slugify(account_name) on every push, both
 * breaks copied links (20 of 126 linked clients have a slug that no longer
 * equals slugify(name)) and throws a unique violation the moment the target
 * name collides with an existing row. Renames propagate through `name`.
 */

export type ClientMatchBasis = 'pulse_account_id' | 'slug' | 'metadata';

export interface ResolvedPulseClient {
  id: string;
  name: string;
  slug: string;
  metadata: ClientMetadata | null;
  defaultBoardId: string | null;
  pulseAccountId: string | null;
  /** How this row was found. `pulse_account_id` means the link is already sound. */
  matchedBy: ClientMatchBasis;
}

const CLIENT_COLUMNS = {
  id: true,
  name: true,
  slug: true,
  metadata: true,
  defaultBoardId: true,
  pulseAccountId: true,
} as const;

export async function resolveClientForPulseAccount(
  pulseAccountId: string,
  slug: string | null,
): Promise<ResolvedPulseClient | null> {
  const byId = await db.query.clients.findFirst({
    where: eq(clients.pulseAccountId, pulseAccountId),
    columns: CLIENT_COLUMNS,
  });
  if (byId) return { ...byId, matchedBy: 'pulse_account_id' };

  if (slug) {
    const bySlug = await db.query.clients.findFirst({
      where: eq(clients.slug, slug),
      columns: CLIENT_COLUMNS,
    });
    if (bySlug) return { ...bySlug, matchedBy: 'slug' };
  }

  const candidates = await db.query.clients.findMany({ columns: CLIENT_COLUMNS });
  const byMetadata = candidates.find(
    (c) => (c.metadata as ClientMetadata | null)?.customFields?.pulse_account_id === pulseAccountId,
  );
  return byMetadata ? { ...byMetadata, matchedBy: 'metadata' } : null;
}

/**
 * Backfill the column whenever we matched some other way.
 *
 * Safe against `clients_pulse_account_id_key` (UNIQUE WHERE NOT NULL) by
 * construction, not by luck: this value is only ever written on a `slug` or
 * `metadata` match, and those are only reached when the `pulse_account_id`
 * lookup above returned nothing. No other row can hold it.
 */
export function pulseAccountIdPatch(
  resolved: ResolvedPulseClient,
  pulseAccountId: string,
): { pulseAccountId: string } | Record<string, never> {
  return resolved.pulseAccountId === pulseAccountId ? {} : { pulseAccountId };
}
