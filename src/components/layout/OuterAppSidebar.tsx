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

interface OuterAppSidebarUser {
  name: string | null;
  email: string;
  image: string | null;
}

interface OuterAppSidebarProps {
  clients: Client[];
  user: OuterAppSidebarUser;
  isAdmin: boolean;
  isContractor?: boolean;
  shellContext: TopShellContext;
  onSignOut: () => void;
}

export function OuterAppSidebar({
  clients,
  user,
  isAdmin,
  isContractor = false,
  shellContext,
  onSignOut,
}: OuterAppSidebarProps) {
  return (
    <div className="hidden h-full lg:flex">
      <Sidebar
        clients={clients}
        user={user}
        isAdmin={isAdmin}
        isContractor={isContractor}
        shellContext={shellContext}
        onSignOut={onSignOut}
      />
    </div>
  );
}
