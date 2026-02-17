'use client';

import { useState } from 'react';
import { Plus, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ClientList } from '@/components/clients';
import { NewClientModal } from '@/components/clients/NewClientModal';
import { EditClientModal } from '@/components/clients/EditClientModal';
import { DeleteClientDialog } from '@/components/clients/DeleteClientDialog';
import { EmptyState } from '@/components/shared/EmptyState';
import { PageHeaderSkeleton, CardGridSkeleton } from '@/components/shared/LoadingSkeleton';
import { useClients, useDeleteClient } from '@/lib/hooks';
import type { ClientWithBoards } from '@/lib/actions/clients';

interface TeamMember {
  id: string;
  name: string | null;
  email: string;
  avatarUrl: string | null;
}

interface ClientsListPageProps {
  teamMembers?: TeamMember[];
}

export function ClientsListPage({ teamMembers = [] }: ClientsListPageProps) {
  const { data: clients, isLoading, error } = useClients();
  const deleteClient = useDeleteClient();

  const [newModalOpen, setNewModalOpen] = useState(false);
  const [editClient, setEditClient] = useState<ClientWithBoards | null>(null);
  const [deleteClientData, setDeleteClientData] = useState<ClientWithBoards | null>(null);

  const handleDelete = async () => {
    if (!deleteClientData) return;
    await deleteClient.mutateAsync(deleteClientData.id);
    setDeleteClientData(null);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeaderSkeleton />
        <CardGridSkeleton count={6} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-destructive">Failed to load clients</p>
        <p className="text-sm text-muted-foreground mt-2">{error.message}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Clients</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your agency&apos;s clients and their boards
          </p>
        </div>
        <Button onClick={() => setNewModalOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New Client
        </Button>
      </div>

      {/* Client List */}
      {clients && clients.length > 0 ? (
        <ClientList
          clients={clients}
          teamMembers={teamMembers}
          onEdit={setEditClient}
          onDelete={setDeleteClientData}
        />
      ) : (
        <EmptyState
          icon={Building2}
          title="No clients yet"
          description="Create your first client to start organizing projects"
          action={
            <Button onClick={() => setNewModalOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Client
            </Button>
          }
        />
      )}

      {/* Modals */}
      <NewClientModal open={newModalOpen} onOpenChange={setNewModalOpen} />

      {editClient && (
        <EditClientModal
          open={!!editClient}
          onOpenChange={(open) => !open && setEditClient(null)}
          client={editClient}
        />
      )}

      <DeleteClientDialog
        open={!!deleteClientData}
        onOpenChange={(open) => !open && setDeleteClientData(null)}
        client={deleteClientData}
        onConfirm={handleDelete}
        isPending={deleteClient.isPending}
      />
    </div>
  );
}
