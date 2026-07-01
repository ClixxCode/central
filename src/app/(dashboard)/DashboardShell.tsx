'use client';

import { useCallback, useMemo, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import {
  MainWorkShell,
  MobileDashboardNav,
  OuterAppSidebar,
  TopShellHeader,
} from '@/components/layout';
import { ImpersonationBanner } from '@/components/layout/ImpersonationBanner';
import { StoreHydration } from '@/lib/stores/StoreHydration';
import { signOutUser } from '@/lib/actions/auth';
import {
  resolveDashboardShellContext,
  type TopShellContext,
} from '@/components/layout/shell-context';
import { TopShellContextOverrideProvider } from '@/components/layout/top-shell-override';

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
  topShellContext?: TopShellContext;
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
  topShellContext,
  impersonation,
}: DashboardShellProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const baseShellContext = useMemo(
    () =>
      topShellContext ??
      resolveDashboardShellContext({
        pathname,
        searchParams,
        clients,
        isAdmin,
      }),
    [clients, isAdmin, pathname, searchParams, topShellContext]
  );
  const [registeredShellContext, setRegisteredShellContext] = useState<{
    id: symbol;
    context: TopShellContext;
  } | null>(null);

  const registerShellContextOverride = useCallback((context: TopShellContext) => {
    const id = Symbol('top-shell-context-override');
    setRegisteredShellContext({ id, context });

    return () => {
      setRegisteredShellContext((current) => (current?.id === id ? null : current));
    };
  }, []);

  const shellContext = registeredShellContext?.context ?? baseShellContext;

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
        <OuterAppSidebar
          clients={clients}
          isAdmin={isAdmin}
          isContractor={isContractor}
          shellContext={shellContext}
        />
        <MobileDashboardNav isAdmin={isAdmin} shellContext={shellContext} />
        <div className="flex flex-1 flex-col overflow-hidden">
          <TopShellContextOverrideProvider registerOverride={registerShellContextOverride}>
            <TopShellHeader
              user={user}
              isAdmin={isAdmin}
              onSignOut={handleSignOut}
              shellContext={shellContext}
            />
            <MainWorkShell shellContext={shellContext}>{children}</MainWorkShell>
          </TopShellContextOverrideProvider>
        </div>
      </div>
    </div>
  );
}
