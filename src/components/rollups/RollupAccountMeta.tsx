'use client';

import * as React from 'react';
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
  accountInitials,
  accountTitleCase,
} from '@/lib/ui/account-status';

/**
 * Compact account context for rollup group headers: a lifecycle status pill
 * plus the account team as a small avatar group (management first, then
 * delivery). Mirrors BoardHeader's presentation in a single inline row.
 */
export function RollupAccountMeta({
  accountStatus,
  accountTeam = [],
}: {
  accountStatus: string | null;
  accountTeam?: AccountTeamMember[];
}) {
  if (!accountStatus && accountTeam.length === 0) return null;

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
    </div>
  );
}
