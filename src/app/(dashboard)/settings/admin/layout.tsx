import { redirect } from 'next/navigation';
import { isAdmin } from '@/lib/auth/session';

export default async function AdminSettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const userIsAdmin = await isAdmin();

  if (!userIsAdmin) {
    redirect('/settings/profile');
  }

  return <>{children}</>;
}
