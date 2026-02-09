'use client';

import Link from 'next/link';
import { MoreHorizontal, Pencil, Trash2, FolderKanban, ExternalLink } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage, AvatarGroup } from '@/components/ui/avatar';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import type { ClientWithBoards } from '@/lib/actions/clients';
import { ClientIcon } from './ClientIcon';

interface TeamMember {
  id: string;
  name: string | null;
  email: string;
  avatarUrl: string | null;
}

interface ClientCardProps {
  client: ClientWithBoards;
  teamMembers?: TeamMember[];
  onEdit?: (client: ClientWithBoards) => void;
  onDelete?: (client: ClientWithBoards) => void;
}

export function ClientCard({ client, teamMembers = [], onEdit, onDelete }: ClientCardProps) {
  const leads = client.metadata?.leads ?? [];
  const cardLinks = (client.metadata?.links ?? []).filter((l) => l.showOnCard);

  return (
    <Card className="group hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <Link
            href={`/clients/${client.slug}`}
            className="flex items-center gap-3 flex-1 min-w-0"
          >
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center text-white shrink-0"
              style={{ backgroundColor: client.color ?? '#6B7280' }}
            >
              <ClientIcon icon={client.icon} color="white" name={client.name} size="lg" />
            </div>
            <div className="min-w-0">
              <h3 className="font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                {client.name}
              </h3>
            </div>
          </Link>

          {(onEdit || onDelete) && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <MoreHorizontal className="h-4 w-4" />
                  <span className="sr-only">Actions</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {onEdit && (
                  <DropdownMenuItem onClick={() => onEdit(client)}>
                    <Pencil className="h-4 w-4 mr-2" />
                    Edit
                  </DropdownMenuItem>
                )}
                {onEdit && onDelete && <DropdownMenuSeparator />}
                {onDelete && (
                  <DropdownMenuItem
                    onClick={() => onDelete(client)}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {/* Account Leads */}
        {leads.length > 0 && (
          <div className="flex items-center gap-2 mb-3">
            <AvatarGroup>
              {leads.map((lead, i) => {
                const member = teamMembers.find((m) => m.id === lead.userId);
                const displayName = member?.name ?? member?.email ?? 'Unknown';
                const initials = displayName.slice(0, 2).toUpperCase();

                return (
                  <Tooltip key={i}>
                    <TooltipTrigger asChild>
                      <Avatar size="sm" className="cursor-default">
                        <AvatarImage src={member?.avatarUrl ?? undefined} />
                        <AvatarFallback className="text-[10px] bg-muted-foreground/20 text-foreground">{initials}</AvatarFallback>
                      </Avatar>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="font-medium">{displayName}</p>
                      <p className="text-muted-foreground">{lead.role}</p>
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </AvatarGroup>
          </div>
        )}

        <Link
          href={`/clients/${client.slug}`}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <FolderKanban className="h-4 w-4" />
          <span>
            {client.boards.length} {client.boards.length === 1 ? 'board' : 'boards'}
          </span>
        </Link>

        {/* Card Links */}
        {cardLinks.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {cardLinks.map((link, i) => (
              <a
                key={i}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-primary hover:text-primary/80 hover:underline bg-primary/5 rounded-md px-2 py-1"
                onClick={(e) => e.stopPropagation()}
              >
                <ExternalLink className="h-3 w-3" />
                {link.name}
              </a>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
