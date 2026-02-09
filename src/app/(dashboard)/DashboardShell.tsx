'use client';

import { Sidebar, Header, MobileNav } from '@/components/layout';
import { signOutUser } from '@/lib/actions/auth';

interface Client {
  id: string;
  name: string;
  slug: string;
  color: string;
  icon: string | null;
  defaultBoardId: string | null;
  boards: { id: string; name: string }[];
}

interface User {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
}

interface DashboardShellProps {
  children: React.ReactNode;
  user: User;
  clients: Client[];
  isAdmin: boolean;
}

export function DashboardShell({
  children,
  user,
  clients,
  isAdmin,
}: DashboardShellProps) {
  const handleSignOut = async () => {
    await signOutUser();
  };

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Desktop Sidebar */}
      <div className="hidden lg:flex h-full">
        <Sidebar clients={clients} isAdmin={isAdmin} />
      </div>

      {/* Mobile Navigation */}
      <MobileNav clients={clients} isAdmin={isAdmin} />

      {/* Main Content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header user={user} isAdmin={isAdmin} onSignOut={handleSignOut} />
        <main className="flex-1 overflow-auto bg-gray-50 p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
