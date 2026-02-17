import Link from 'next/link';
import { Archive, Bell, Globe, Users, Tags, User, ShieldCheck, Plug } from 'lucide-react';
import { isAdmin } from '@/lib/auth/session';
import { cn } from '@/lib/utils';

interface NavItem {
  name: string;
  href: string;
  icon: typeof User;
  adminOnly?: boolean;
  children?: NavItem[];
}

const settingsNav: NavItem[] = [
  {
    name: 'Profile',
    href: '/settings/profile',
    icon: User,
  },
  {
    name: 'Notifications',
    href: '/settings/notifications',
    icon: Bell,
  },
  {
    name: 'Integrations',
    href: '/settings/integrations',
    icon: Plug,
  },
];

const adminNav: NavItem[] = [
  {
    name: 'General',
    href: '/settings/admin/general',
    icon: Globe,
  },
  {
    name: 'Users',
    href: '/settings/admin/users',
    icon: Users,
  },
  {
    name: 'Teams',
    href: '/settings/admin/teams',
    icon: Users,
  },
  {
    name: 'Statuses & Sections',
    href: '/settings/admin/statuses',
    icon: Tags,
  },
  {
    name: 'Archive',
    href: '/settings/admin/archive',
    icon: Archive,
  },
];

export default async function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const userIsAdmin = await isAdmin();

  return (
    <div className="container max-w-4xl py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-muted-foreground">Manage your account settings and preferences.</p>
      </div>

      <div className="flex flex-col gap-8 md:flex-row">
        <nav className="w-full md:w-48 shrink-0">
          <ul className="space-y-1">
            {settingsNav.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium hover:bg-muted transition-colors"
                >
                  <item.icon className="h-4 w-4" />
                  {item.name}
                </Link>
              </li>
            ))}
          </ul>

          {/* Admin Section */}
          {userIsAdmin && (
            <>
              <div className="my-4 border-t" />
              <div className="px-3 py-2">
                <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  <ShieldCheck className="h-3 w-3" />
                  Admin
                </span>
              </div>
              <ul className="space-y-1">
                {adminNav.map((item) => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium hover:bg-muted transition-colors"
                    >
                      <item.icon className="h-4 w-4" />
                      {item.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}
        </nav>

        <div className="flex-1 min-w-0">{children}</div>
      </div>
    </div>
  );
}
