'use client';

import * as React from 'react';
import { ExternalLink } from 'lucide-react';
import {
  Avatar,
  AvatarImage,
  AvatarFallback,
  AvatarGroup,
  AvatarGroupCount,
} from '@/components/ui/avatar';
import type { AccountTeamMember } from '@/lib/db/schema';
import {
  ACCOUNT_STATUS_STYLES,
  PULSE_BASE_URL,
  accountInitials,
  accountTitleCase,
} from '@/lib/ui/account-status';

/**
 * Compact account context for rollup group headers: a lifecycle status pill,
 * the account team as a small avatar group (management first, then delivery),
 * a consolidated services count, and a link to the Pulse account profile.
 * Mirrors BoardHeader's presentation in a single inline row.
 */
export function RollupAccountMeta({
  pulseAccountId,
  accountStatus,
  accountTeam = [],
  accountServices = [],
}: {
  pulseAccountId?: string | null;
  accountStatus: string | null;
  accountTeam?: AccountTeamMember[];
  accountServices?: string[];
}) {
  if (
    !accountStatus &&
    accountTeam.length === 0 &&
    accountServices.length === 0 &&
    !pulseAccountId
  ) {
    return null;
  }

  // Management before delivery so AM/BD lead the avatar stack.
  const ordered = [
    ...accountTeam.filter((m) => m.group === 'management'),
    ...accountTeam.filter((m) => m.group !== 'management'),
  ];

  return (
    <div className="flex items-center gap-2">
      {accountStatus && (
        <span
          className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${
            ACCOUNT_STATUS_STYLES[accountStatus] ??
            'bg-muted text-muted-foreground border-transparent'
          }`}
        >
          {accountTitleCase(accountStatus)}
        </span>
      )}
      {ordered.length > 0 && (
        <AvatarGroup>
          {ordered.slice(0, 5).map((m) => (
            <Avatar key={m.staff_id} size="sm">
              <AvatarImage src={m.avatar_url ?? undefined} alt={m.full_name ?? ''} />
              <AvatarFallback>{accountInitials(m.full_name ?? m.email ?? '?')}</AvatarFallback>
            </Avatar>
          ))}
          {ordered.length > 5 && <AvatarGroupCount>+{ordered.length - 5}</AvatarGroupCount>}
        </AvatarGroup>
      )}
      {accountServices.length > 0 && (
        <span
          className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
          title={accountServices.join(', ')}
        >
          {accountServices.length} {accountServices.length === 1 ? 'service' : 'services'}
        </span>
      )}
      {pulseAccountId && (
        <a
          href={`${PULSE_BASE_URL}/accounts/${pulseAccountId}`}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground hover:underline"
          title="Open this account in Pulse"
        >
          Pulse
          <ExternalLink className="size-3" />
        </a>
      )}
    </div>
  );
}
