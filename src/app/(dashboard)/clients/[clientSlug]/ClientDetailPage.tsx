'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, FolderKanban, Pencil, Trash2, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
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
      {/* Back link */}
      {isAdmin && (
        <Link
          href="/clients"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          All Clients
        </Link>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div
            className="w-12 h-12 rounded-lg flex items-center justify-center text-white"
            style={{ backgroundColor: displayClient.color ?? '#6B7280' }}
          >
            <ClientIcon icon={displayClient.icon} color="white" name={displayClient.name} size="lg" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{displayClient.name}</h1>
            <p className="text-sm text-muted-foreground">/{displayClient.slug}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
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
      </div>

      {/* Boards */}
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

      {/* Details */}
      <ClientMetadataTab client={displayClient} teamMembers={teamMembers} isAdmin={isAdmin} />

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
