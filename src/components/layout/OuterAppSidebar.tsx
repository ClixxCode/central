'use client';

import { Sidebar } from './Sidebar';
import type { TopShellContext } from './shell-context';

interface Client {
  id: string;
  name: string;
  slug: string;
  color: string;
  icon: string | null;
  defaultBoardId: string | null;
  boards: { id: string; name: string }[];
}

interface OuterAppSidebarProps {
  clients: Client[];
  isAdmin: boolean;
  isContractor?: boolean;
  shellContext: TopShellContext;
}

export function OuterAppSidebar({
  clients,
  isAdmin,
  isContractor = false,
  shellContext,
}: OuterAppSidebarProps) {
  return (
    <div className="hidden h-full lg:flex">
      <Sidebar
        clients={clients}
        isAdmin={isAdmin}
        isContractor={isContractor}
        shellContext={shellContext}
      />
    </div>
  );
}
