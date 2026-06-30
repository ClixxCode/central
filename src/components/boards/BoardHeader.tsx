'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowLeft, ExternalLink, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FavoriteButton } from '@/components/shared/FavoriteButton';
import { PULSE_BASE_URL } from '@/lib/ui/account-status';
import {
  Avatar,
  AvatarImage,
  AvatarFallback,
  AvatarGroup,
  AvatarGroupCount,
} from '@/components/ui/avatar';
import type { AccountTeamMember } from '@/lib/db/schema';

interface BoardHeaderProps {
  boardId: string;
  boardName: string;
  clientName?: string;
  clientSlug: string;
  canEdit: boolean;
  // Reflected Pulse account state (one-way Pulse → Central).
  pulseAccountId?: string | null;
  accountStatus?: string | null;
  accountType?: string | null;
  podName?: string | null;
  accountTeam?: AccountTeamMember[];
  accountServices?: string[];
  parentBoard?: {
    id: string;
    name: string;
    clientSlug?: string | null;
  } | null;
}

// Lifecycle status → pill styling. Falls back to neutral for unknown values.
const STATUS_STYLES: Record<string, string> = {
  active: 'bg-green-100 text-green-800 border-green-200',
  onboarding: 'bg-blue-100 text-blue-800 border-blue-200',
  paused: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  offboarding: 'bg-orange-100 text-orange-800 border-orange-200',
  terminated: 'bg-gray-100 text-gray-500 border-gray-200',
  pipeline: 'bg-purple-100 text-purple-800 border-purple-200',
};

function titleCase(s: string): string {
  return s.replace(/(^|_)([a-z])/g, (_, p, c) => (p ? ' ' : '') + c.toUpperCase());
}

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
}

function Pill({ label, className }: { label: string; className?: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${
        className ?? 'bg-muted text-muted-foreground border-transparent'
      }`}
    >
      {label}
    </span>
  );
}

function TeamGroup({ label, members }: { label: string; members: AccountTeamMember[] }) {
  if (members.length === 0) return null;
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</span>
      <AvatarGroup>
        {members.slice(0, 5).map((m) => (
          <Avatar key={m.staff_id} size="lg">
            <AvatarImage src={m.avatar_url ?? undefined} alt={m.full_name ?? ''} />
            <AvatarFallback>{getInitials(m.full_name ?? m.email ?? '?')}</AvatarFallback>
          </Avatar>
        ))}
        {members.length > 5 && <AvatarGroupCount>+{members.length - 5}</AvatarGroupCount>}
      </AvatarGroup>
    </div>
  );
}

export function BoardHeader({
  boardId,
  boardName,
  clientName,
  clientSlug,
  canEdit,
  pulseAccountId,
  accountStatus,
  accountType,
  podName,
  accountTeam = [],
  accountServices = [],
  parentBoard,
}: BoardHeaderProps) {
  const management = accountTeam.filter((m) => m.group === 'management');
  const delivery = accountTeam.filter((m) => m.group === 'delivery');
  const parentHref =
    parentBoard && (parentBoard.clientSlug ?? clientSlug)
      ? `/clients/${parentBoard.clientSlug ?? clientSlug}/boards/${parentBoard.id}`
      : null;

  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-bold">{boardName}</h1>
          {parentHref && (
            <Link
              href={parentHref}
              className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground hover:underline"
            >
              <ArrowLeft className="size-3.5" />
              {parentBoard?.name}
            </Link>
          )}
          {accountStatus && (
            <Pill label={titleCase(accountStatus)} className={STATUS_STYLES[accountStatus]} />
          )}
          {accountType && accountType !== 'client' && (
            <Pill label={titleCase(accountType)} />
          )}
          {podName && <Pill label={podName} />}
          {pulseAccountId && (
            <a
              href={`${PULSE_BASE_URL}/accounts/${pulseAccountId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-full border border-transparent bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground hover:underline"
              title="Open this account in Pulse"
            >
              View in Pulse
              <ExternalLink className="size-3" />
            </a>
          )}
        </div>
        {clientName && (
          <Link
            href={`/clients/${clientSlug}`}
            className="text-sm text-muted-foreground hover:text-foreground hover:underline transition-colors"
          >
            {clientName}
          </Link>
        )}
        {accountTeam.length > 0 && (
          <div className="mt-2 flex flex-wrap items-center gap-4">
            <TeamGroup label="Management" members={management} />
            <TeamGroup label="Delivery" members={delivery} />
          </div>
        )}
        {accountServices.length > 0 && (
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Services
            </span>
            {accountServices.map((s) => (
              <span
                key={s}
                className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
              >
                {s}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <FavoriteButton entityType="board" entityId={boardId} />
        {canEdit && (
          <Button variant="outline" size="sm" asChild>
            <Link href={`/clients/${clientSlug}/boards/${boardId}/settings`}>
              <Settings className="mr-2 size-4" />
              Settings
            </Link>
          </Button>
        )}
      </div>
    </div>
  );
}
