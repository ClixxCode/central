'use client';

import Link from 'next/link';
import { ChevronRight, Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useUIStore } from '@/lib/stores';
import type { TopShellContext, TopShellCrumb, TopShellTab } from './shell-context';
import { AppActions } from './AppActions';

interface TopShellHeaderUser {
  name: string | null;
  email: string;
  image: string | null;
}

interface TopShellHeaderProps {
  user: TopShellHeaderUser;
  isAdmin?: boolean;
  onSignOut: () => void;
  shellContext?: TopShellContext;
}

export function TopShellHeader({
  user,
  isAdmin = false,
  onSignOut,
  shellContext,
}: TopShellHeaderProps) {
  const { setSidebarOpen, sidebarOpen } = useUIStore();
  const crumbs = shellContext?.breadcrumbs ?? shellContext?.crumbs ?? [];
  const parentCrumbs = crumbs.slice(0, -1);
  const tabs = shellContext?.tabs ?? [];

  return (
    <header
      className="border-b bg-background"
      data-shell-header-section={shellContext?.section}
      data-shell-header-nav-item={shellContext?.activeNavItem ?? undefined}
    >
      <div className="flex h-14 items-center gap-3 px-3 sm:px-4">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            aria-label="Toggle navigation"
          >
            <Menu className="h-5 w-5" />
          </Button>

          <div className="flex min-w-0 items-center gap-3">
            {parentCrumbs.length > 0 && (
              <nav
                aria-label="Breadcrumb"
                className="hidden min-w-0 items-center gap-1 text-xs text-muted-foreground md:flex"
              >
                {parentCrumbs.map((crumb, index) => (
                  <BreadcrumbItem
                    key={`${crumb.label}-${crumb.href ?? index}`}
                    crumb={crumb}
                  />
                ))}
              </nav>
            )}

            {shellContext && (
              <div className="min-w-0">
                <div className="flex min-w-0 items-center gap-2">
                  <h1 className="truncate text-sm font-semibold leading-5 text-foreground">
                    {shellContext.title}
                  </h1>
                  {shellContext.subtitle && (
                    <span className="hidden truncate text-xs text-muted-foreground sm:inline">
                      {shellContext.subtitle}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        <AppActions
          user={user}
          isAdmin={isAdmin}
          onSignOut={onSignOut}
        />
      </div>

      {tabs.length > 0 && (
        <div className="px-3 pb-2 sm:px-4">
          <TopShellTabs tabs={tabs} />
        </div>
      )}
    </header>
  );
}

function BreadcrumbItem({ crumb }: { crumb: TopShellCrumb }) {
  const content = (
    <>
      {crumb.icon}
      <span className="truncate">{crumb.label}</span>
    </>
  );

  return (
    <div className="flex min-w-0 items-center gap-1">
      {crumb.href ? (
        <Link
          href={crumb.href}
          className={cn(
            'flex min-w-0 items-center gap-1 truncate transition-colors hover:text-foreground',
            crumb.tone === 'muted' && 'text-muted-foreground/70'
          )}
        >
          {content}
        </Link>
      ) : (
        <span
          className={cn(
            'flex min-w-0 items-center gap-1 truncate',
            crumb.tone === 'muted' && 'text-muted-foreground/70'
          )}
        >
          {content}
        </span>
      )}
      <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />
    </div>
  );
}

function TopShellTabs({ tabs }: { tabs: TopShellTab[] }) {
  return (
    <nav
      aria-label="Section tabs"
      className="flex min-w-0 items-center gap-1 overflow-x-auto"
    >
      {tabs.map((tab) => {
        const className = cn(
          'inline-flex h-7 shrink-0 items-center rounded-md px-2 text-xs font-medium transition-colors',
          tab.active
            ? 'bg-muted text-foreground'
            : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
        );

        if (!tab.href) {
          return (
            <span key={tab.label} className={className}>
              {tab.label}
            </span>
          );
        }

        return (
          <Link
            key={`${tab.label}-${tab.href}`}
            href={tab.href}
            className={className}
            aria-current={tab.active ? 'page' : undefined}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
