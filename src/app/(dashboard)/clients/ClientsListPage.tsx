'use client';

import { useMemo, useState } from 'react';
import { Plus, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ClientList } from '@/components/clients';
import { NewClientModal } from '@/components/clients/NewClientModal';
import { EditClientModal } from '@/components/clients/EditClientModal';
import { DeleteClientDialog } from '@/components/clients/DeleteClientDialog';
import { EmptyState } from '@/components/shared/EmptyState';
import { CardGridSkeleton } from '@/components/shared/LoadingSkeleton';
import { useTopShellActions } from '@/components/layout/top-shell-actions';
import { useTopShellContextOverride } from '@/components/layout/top-shell-override';
import type { TopShellContext } from '@/components/layout/shell-context';
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

  const actions = useMemo(
    () => (
      <Button
        onClick={() => setNewModalOpen(true)}
        variant="ghost"
        size="icon-sm"
        aria-label="New client"
        className="text-muted-foreground hover:text-foreground"
      >
        <Plus className="size-4" />
      </Button>
    ),
    []
  );

  const shellContext = useMemo<TopShellContext>(() => {
    const crumbs = [
      { label: 'Central', href: '/my-tasks' },
      { label: 'Clients', href: '/clients' },
    ];

    return {
      section: 'clients',
      activeNavItem: 'clients',
      title: 'Clients',
      subtitle: "Manage your agency's clients and their boards",
      crumbs,
      breadcrumbs: crumbs,
      actionsSlot: 'board',
      route: {
        pathname: '/clients',
        segments: ['clients'],
      },
      isAdminRoute: false,
    };
  }, []);

  useTopShellContextOverride(shellContext);
  useTopShellActions(actions);

  const handleDelete = async () => {
    if (!deleteClientData) return;
    await deleteClient.mutateAsync(deleteClientData.id);
    setDeleteClientData(null);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
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
