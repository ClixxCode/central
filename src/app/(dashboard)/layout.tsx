import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/session';
import { listClients } from '@/lib/actions/clients';
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
  const clientsResult = await listClients();
  const clients = clientsResult.success ? clientsResult.data ?? [] : [];

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
    >
      {children}
    </DashboardShell>
  );
}
