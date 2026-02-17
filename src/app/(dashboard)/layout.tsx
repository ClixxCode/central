import { redirect } from 'next/navigation';
import { getCurrentUser, getImpersonationState } from '@/lib/auth/session';
import { listClients, checkIsContractor } from '@/lib/actions/clients';
import { DashboardShell } from './DashboardShell';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/login');
  }

  // Fetch clients with boards for sidebar
  const [clientsResult, isContractor] = await Promise.all([
    listClients(),
    checkIsContractor(user.id),
  ]);
  const clients = clientsResult.success ? clientsResult.data ?? [] : [];

  const impersonation = await getImpersonationState();

  return (
    <DashboardShell
      user={{
        id: user.id,
        name: user.name,
        email: user.email,
        image: user.image,
      }}
      clients={clients.map((client) => ({
        id: client.id,
        name: client.name,
        slug: client.slug,
        color: client.color ?? '#6B7280',
        icon: client.icon ?? null,
        defaultBoardId: client.defaultBoardId ?? null,
        boards: client.boards.map((board) => ({
          id: board.id,
          name: board.name,
        })),
      }))}
      isAdmin={user.role === 'admin'}
      isContractor={isContractor}
      impersonation={impersonation.isImpersonating ? {
        userName: impersonation.userName,
        userEmail: impersonation.userEmail,
      } : undefined}
    >
      {children}
    </DashboardShell>
  );
}
