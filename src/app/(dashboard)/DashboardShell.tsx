'use client';

import { Sidebar, Header, MobileNav } from '@/components/layout';
import { ImpersonationBanner } from '@/components/layout/ImpersonationBanner';
import { StoreHydration } from '@/lib/stores/StoreHydration';
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
  isContractor?: boolean;
  impersonation?: {
    userName?: string;
    userEmail?: string;
  };
}

export function DashboardShell({
  children,
  user,
  clients,
  isAdmin,
  isContractor = false,
  impersonation,
}: DashboardShellProps) {
  const handleSignOut = async () => {
    await signOutUser();
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {impersonation && (
        <ImpersonationBanner
          userName={impersonation.userName}
          userEmail={impersonation.userEmail}
        />
      )}
      <div className="flex flex-1 overflow-hidden">
        <StoreHydration />
        {/* Desktop Sidebar */}
        <div className="hidden lg:flex h-full">
          <Sidebar clients={clients} isAdmin={isAdmin} isContractor={isContractor} />
        </div>

        {/* Mobile Navigation */}
        <MobileNav clients={clients} isAdmin={isAdmin} isContractor={isContractor} />

        {/* Main Content */}
        <div className="flex flex-1 flex-col overflow-hidden">
          <Header user={user} isAdmin={isAdmin} onSignOut={handleSignOut} />
          <main className="flex-1 overflow-auto bg-background p-4 lg:p-6">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
