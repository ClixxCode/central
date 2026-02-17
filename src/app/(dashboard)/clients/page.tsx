import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/auth/session';
import { listAssignableUsers } from '@/lib/actions/quick-add';
import { ClientsListPage } from './ClientsListPage';

export default async function ClientsPage() {
  try {
    await requireAdmin();
  } catch {
    redirect('/my-tasks');
  }

  let teamMembers: { id: string; name: string | null; email: string; avatarUrl: string | null }[] = [];
  const usersResult = await listAssignableUsers();
  if (usersResult.success && usersResult.users) {
    teamMembers = usersResult.users;
  }

  return <ClientsListPage teamMembers={teamMembers} />;
}
