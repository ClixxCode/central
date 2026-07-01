'use client';

import React from 'react';
import Link from 'next/link';
import { Settings } from 'lucide-react';
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
  clientName,
  clientSlug,
  canEdit,
  parentBoard,
}: BoardHeaderProps) {
  const shellContext = React.useMemo<TopShellContext>(() => {
    const clientLabel = clientName ?? humanizeSlug(clientSlug);
    const clientHref = `/clients/${clientSlug}`;
    const boardHref = `${clientHref}/boards/${boardId}`;
    const parentBoardHref = parentBoard
      ? `/clients/${parentBoard.clientSlug ?? clientSlug}/boards/${parentBoard.id}`
      : null;
    const showParentBoardCrumb =
      !!parentBoard &&
      !!parentBoardHref &&
      normalizeLabel(parentBoard.name) !== normalizeLabel(clientLabel);
    const showCurrentBoardCrumb =
      normalizeLabel(boardName) !== normalizeLabel(clientLabel);
    const crumbs = [
      { label: 'Central', href: '/my-tasks' },
      { label: 'Clients', href: '/clients' },
      { label: clientLabel, href: clientHref },
      ...(showParentBoardCrumb
        ? [{ label: parentBoard.name, href: parentBoardHref }]
        : []),
      ...(showCurrentBoardCrumb ? [{ label: boardName, href: boardHref }] : []),
    ];

    return {
      section: 'board',
      activeNavItem: 'clients',
      title: boardName,
      crumbs,
      breadcrumbs: crumbs,
      actions: (
        <div className="flex items-center gap-0.5">
          <FavoriteButton
            entityType="board"
            entityId={boardId}
            className="size-8"
          />
          {canEdit && (
            <Button
              variant="ghost"
              size="icon-sm"
              className="rounded-full text-muted-foreground hover:bg-muted/70 hover:text-foreground"
              asChild
            >
              <Link href={`${boardHref}/settings`} aria-label="Board settings">
                <Settings className="size-4" />
              </Link>
            </Button>
          )}
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
    boardId,
    boardName,
    canEdit,
    clientName,
    clientSlug,
    parentBoard,
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

function normalizeLabel(label: string): string {
  return label.trim().replace(/\s+/g, ' ').toLowerCase();
}
