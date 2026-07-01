'use client';

import { useCallback, useMemo, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  AppShellBottomBar,
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
import { TopShellActionsProvider } from '@/components/layout/top-shell-actions';
import { TopShellBottomBarProvider } from '@/components/layout/top-shell-bottom-bar';
import { TopShellToolbarProvider } from '@/components/layout/top-shell-toolbar';
import { CentralFeatureFlagsProvider } from '@/lib/feature-flags/CentralFeatureFlagsProvider';
import type { CentralFeatureFlags } from '@/lib/feature-flags/types';

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
  featureFlags: CentralFeatureFlags;
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
  featureFlags,
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
  const [registeredShellToolbar, setRegisteredShellToolbar] = useState<{
    id: symbol;
    toolbar: React.ReactNode;
  } | null>(null);
  const [registeredShellActions, setRegisteredShellActions] = useState<{
    id: symbol;
    actions: React.ReactNode;
  } | null>(null);
  const [registeredShellBottomBar, setRegisteredShellBottomBar] = useState<{
    id: symbol;
    content: React.ReactNode;
  } | null>(null);

  const registerShellContextOverride = useCallback((context: TopShellContext) => {
    const id = Symbol('top-shell-context-override');
    setRegisteredShellContext({ id, context });

    return () => {
      setRegisteredShellContext((current) => (current?.id === id ? null : current));
    };
  }, []);

  const registerShellToolbar = useCallback((toolbar: React.ReactNode) => {
    const id = Symbol('top-shell-toolbar');
    setRegisteredShellToolbar({ id, toolbar });

    return () => {
      setRegisteredShellToolbar((current) => (current?.id === id ? null : current));
    };
  }, []);

  const registerShellActions = useCallback((actions: React.ReactNode) => {
    const id = Symbol('top-shell-actions');
    setRegisteredShellActions({ id, actions });

    return () => {
      setRegisteredShellActions((current) => (current?.id === id ? null : current));
    };
  }, []);

  const registerShellBottomBar = useCallback((content: React.ReactNode) => {
    const id = Symbol('top-shell-bottom-bar');
    setRegisteredShellBottomBar({ id, content });

    return () => {
      setRegisteredShellBottomBar((current) => (current?.id === id ? null : current));
    };
  }, []);

  const shellContext = registeredShellContext?.context ?? baseShellContext;
  const appShellVisualRefreshEnabled = featureFlags.appShellVisualRefreshEnabled;

  const handleSignOut = async () => {
    await signOutUser();
  };

  return (
    <CentralFeatureFlagsProvider flags={featureFlags}>
      <div
        className={cn(
          'flex h-screen flex-col overflow-hidden',
          appShellVisualRefreshEnabled && 'bg-sidebar'
        )}
        data-shell-visual-refresh={appShellVisualRefreshEnabled ? 'on' : 'off'}
      >
        {impersonation && (
          <ImpersonationBanner
            userName={impersonation.userName}
            userEmail={impersonation.userEmail}
          />
        )}
        <div className="flex min-h-0 flex-1 overflow-hidden">
          <StoreHydration />
          <OuterAppSidebar
            clients={clients}
            user={user}
            isAdmin={isAdmin}
            isContractor={isContractor}
            shellContext={shellContext}
            onSignOut={handleSignOut}
            visualRefreshEnabled={appShellVisualRefreshEnabled}
          />
          <MobileDashboardNav isAdmin={isAdmin} shellContext={shellContext} />
          <div
            className={cn(
              'flex min-w-0 flex-1 flex-col overflow-hidden bg-background',
              appShellVisualRefreshEnabled && 'lg:mb-0 lg:ml-0 lg:mr-2 lg:mt-2 lg:rounded-xl lg:border lg:shadow-panel'
            )}
            data-shell-content
          >
            <TopShellContextOverrideProvider registerOverride={registerShellContextOverride}>
              <TopShellActionsProvider registerActions={registerShellActions}>
                <TopShellBottomBarProvider registerBottomBar={registerShellBottomBar}>
                  <TopShellToolbarProvider registerToolbar={registerShellToolbar}>
                    <TopShellHeader
                      user={user}
                      isAdmin={isAdmin}
                      onSignOut={handleSignOut}
                      shellContext={shellContext}
                      toolbar={registeredShellToolbar?.toolbar}
                      primaryActions={registeredShellActions?.actions}
                    />
                    <MainWorkShell shellContext={shellContext}>{children}</MainWorkShell>
                    <AppShellBottomBar>
                      {registeredShellBottomBar?.content}
                    </AppShellBottomBar>
                  </TopShellToolbarProvider>
                </TopShellBottomBarProvider>
              </TopShellActionsProvider>
            </TopShellContextOverrideProvider>
          </div>
        </div>
      </div>
    </CentralFeatureFlagsProvider>
  );
}
