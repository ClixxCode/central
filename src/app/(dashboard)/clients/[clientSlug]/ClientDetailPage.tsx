'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, FolderKanban, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BoardList } from '@/components/boards';
import { NewBoardModal } from '@/components/boards/NewBoardModal';
import { EditClientModal } from '@/components/clients/EditClientModal';
import { DeleteClientDialog } from '@/components/clients/DeleteClientDialog';
import { DeleteBoardDialog } from '@/components/boards/DeleteBoardDialog';
import { ClientMetadataTab } from '@/components/clients/ClientMetadataTab';
import { EmptyState } from '@/components/shared/EmptyState';
import { useClient, useDeleteClient, useDeleteBoard } from '@/lib/hooks';
import type { ClientWithBoards } from '@/lib/actions/clients';
import { ClientIcon } from '@/components/clients/ClientIcon';

interface TeamMember {
  id: string;
  name: string | null;
  email: string;
  avatarUrl: string | null;
}

interface ClientDetailPageProps {
  clientSlug: string;
  initialData: ClientWithBoards;
  isAdmin: boolean;
  teamMembers?: TeamMember[];
}

export function ClientDetailPage({
  clientSlug,
  initialData,
  isAdmin,
  teamMembers = [],
}: ClientDetailPageProps) {
  const router = useRouter();
  const { data: client } = useClient(clientSlug);
  const deleteClient = useDeleteClient();
  const deleteBoard = useDeleteBoard();

  const [newBoardModalOpen, setNewBoardModalOpen] = useState(false);
  const [editClientModalOpen, setEditClientModalOpen] = useState(false);
  const [deleteClientDialogOpen, setDeleteClientDialogOpen] = useState(false);
  const [deleteBoardData, setDeleteBoardData] = useState<{ id: string; name: string } | null>(null);

  // Use fresh data if available, fallback to initial
  const displayClient = client ?? initialData;

  const handleDeleteClient = async () => {
    await deleteClient.mutateAsync(displayClient.id);
    router.push('/clients');
  };

  const handleDeleteBoard = async () => {
    if (!deleteBoardData) return;
    await deleteBoard.mutateAsync(deleteBoardData.id);
    setDeleteBoardData(null);
  };

  const handleBoardSettings = (board: { id: string; name: string }) => {
    router.push(`/clients/${clientSlug}/boards/${board.id}/settings`);
  };

  return (
    <div className="space-y-6">
      <section id="overview" className="flex flex-col gap-4 border-b pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-white"
            style={{ backgroundColor: displayClient.color ?? '#6B7280' }}
          >
            <ClientIcon
              icon={displayClient.icon}
              color="white"
              name={displayClient.name}
              size="md"
            />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground">Client overview</p>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
              <span className="truncate">/{displayClient.slug}</span>
              <span aria-hidden="true">·</span>
              <span>
                {displayClient.boards.length}{' '}
                {displayClient.boards.length === 1 ? 'board' : 'boards'}
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {isAdmin && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEditClientModalOpen(true)}
              >
                <Pencil className="h-4 w-4 mr-2" />
                Edit
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDeleteClientDialogOpen(true)}
                className="text-destructive hover:text-destructive/80"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </Button>
            </>
          )}
          {isAdmin && (
            <Button onClick={() => setNewBoardModalOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              New Board
            </Button>
          )}
        </div>
      </section>

      <section id="boards" className="space-y-3 scroll-mt-24">
        <div>
          <h2 className="text-base font-semibold text-foreground">Boards</h2>
        </div>

        {displayClient.boards.length > 0 ? (
          <BoardList
            boards={displayClient.boards}
            clientSlug={clientSlug}
            onSettings={isAdmin ? handleBoardSettings : undefined}
            onDelete={isAdmin ? setDeleteBoardData : undefined}
          />
        ) : (
          <EmptyState
            icon={FolderKanban}
            title="No boards yet"
            description={
              isAdmin
                ? 'Create a board to start organizing tasks for this client.'
                : 'No boards have been shared with you for this client.'
            }
            action={
              isAdmin ? (
                <Button onClick={() => setNewBoardModalOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Board
                </Button>
              ) : undefined
            }
          />
        )}
      </section>

      <section id="details" className="space-y-3 scroll-mt-24">
        <div>
          <h2 className="text-base font-semibold text-foreground">Details</h2>
        </div>
        <ClientMetadataTab client={displayClient} teamMembers={teamMembers} isAdmin={isAdmin} />
      </section>

      {/* Modals */}
      {isAdmin && (
        <>
          <NewBoardModal
            open={newBoardModalOpen}
            onOpenChange={setNewBoardModalOpen}
            clientId={displayClient.id}
          />

          <EditClientModal
            open={editClientModalOpen}
            onOpenChange={setEditClientModalOpen}
            client={displayClient}
          />

          <DeleteClientDialog
            open={deleteClientDialogOpen}
            onOpenChange={setDeleteClientDialogOpen}
            client={displayClient}
            onConfirm={handleDeleteClient}
            isPending={deleteClient.isPending}
          />

          <DeleteBoardDialog
            open={!!deleteBoardData}
            onOpenChange={(open) => !open && setDeleteBoardData(null)}
            board={deleteBoardData}
            onConfirm={handleDeleteBoard}
            isPending={deleteBoard.isPending}
          />
        </>
      )}
    </div>
  );
}
