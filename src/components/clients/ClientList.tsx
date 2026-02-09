'use client';

import { ClientCard } from './ClientCard';
import type { ClientWithBoards } from '@/lib/actions/clients';

interface TeamMember {
  id: string;
  name: string | null;
  email: string;
  avatarUrl: string | null;
}

interface ClientListProps {
  clients: ClientWithBoards[];
  teamMembers?: TeamMember[];
  onEdit?: (client: ClientWithBoards) => void;
  onDelete?: (client: ClientWithBoards) => void;
}

export function ClientList({ clients, teamMembers = [], onEdit, onDelete }: ClientListProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {clients.map((client) => (
        <ClientCard
          key={client.id}
          client={client}
          teamMembers={teamMembers}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}
