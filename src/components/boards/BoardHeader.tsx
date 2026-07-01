'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowLeft, MoreHorizontal, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FavoriteButton } from '@/components/shared/FavoriteButton';
import { useTopShellContextOverride } from '@/components/layout/top-shell-override';
import type { TopShellContext } from '@/components/layout/shell-context';
import type { AccountTeamMember } from '@/lib/db/schema';

interface BoardHeaderProps {
  boardId: string;
  boardName: string;
  boardIcon?: string | null;
  boardColor?: string | null;
  clientName?: string;
  clientSlug: string;
  canEdit: boolean;
  // Reflected Pulse account state. Accepted here so board pages can pass the
  // account context while the top-shell visual treatment evolves.
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

export function BoardHeader({
  boardId,
  boardName,
  boardIcon,
  boardColor,
  clientName,
  clientSlug,
  canEdit,
  parentBoard,
}: BoardHeaderProps) {
  const parentBoardId = parentBoard?.id;
  const parentBoardName = parentBoard?.name;
  const parentBoardClientSlug = parentBoard?.clientSlug ?? clientSlug;

  const shellContext = React.useMemo<TopShellContext>(() => {
    const clientLabel = clientName ?? humanizeSlug(clientSlug);
    const clientHref = `/clients/${clientSlug}`;
    const boardHref = `${clientHref}/boards/${boardId}`;
    const parentHref = parentBoardId
      ? `/clients/${parentBoardClientSlug}/boards/${parentBoardId}`
      : null;
    const crumbs = [
      { label: 'Central', href: '/my-tasks' },
      { label: 'Clients', href: '/clients' },
      { label: clientLabel, href: clientHref },
      ...(parentBoardName && parentHref
        ? [{ label: parentBoardName, href: parentHref }]
        : []),
      { label: boardName, href: boardHref },
    ];

    return {
      section: 'board',
      activeNavItem: 'clients',
      title: boardName,
      subtitle: parentBoardName && parentHref ? (
        <Link
          href={parentHref}
          className="inline-flex min-w-0 items-center gap-1 transition-colors hover:text-foreground hover:underline"
        >
          <ArrowLeft className="size-3.5 shrink-0" />
          <span className="truncate">{parentBoardName}</span>
        </Link>
      ) : undefined,
      titleIcon: (
        <span
          aria-hidden="true"
          className="material-symbols-outlined leading-none"
          style={{
            color: boardColor ?? undefined,
            fontSize: 18,
          }}
        >
          {boardIcon ?? 'checklist'}
        </span>
      ),
      crumbs,
      breadcrumbs: crumbs,
      tabs: [{ label: 'Tasks', href: boardHref, active: true }],
      actions: (
        <div className="flex items-center gap-1">
          <FavoriteButton entityType="board" entityId={boardId} />
          {canEdit && (
            <Button variant="ghost" size="icon" asChild>
              <Link href={`${boardHref}/settings`} aria-label="Board settings">
                <Settings className="size-4" />
              </Link>
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            disabled
            aria-label="More board actions"
          >
            <MoreHorizontal className="size-4" />
          </Button>
        </div>
      ),
      actionsSlot: 'board',
      route: {
        pathname: boardHref,
        segments: ['clients', clientSlug, 'boards', boardId],
        clientSlug,
        boardId,
      },
      client: {
        slug: clientSlug,
        name: clientLabel,
        href: clientHref,
      },
      board: {
        id: boardId,
        name: boardName,
        href: boardHref,
      },
      isAdminRoute: false,
    };
  }, [
    boardColor,
    boardIcon,
    boardId,
    boardName,
    canEdit,
    clientName,
    clientSlug,
    parentBoardClientSlug,
    parentBoardId,
    parentBoardName,
  ]);

  useTopShellContextOverride(shellContext);

  return null;
}

function humanizeSlug(slug: string): string {
  return slug
    .replace(/[-_]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ') || slug;
}
