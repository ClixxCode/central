import { notFound } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/session';
import { getClient } from '@/lib/actions/clients';
import { listAssignableUsers } from '@/lib/actions/quick-add';
import { ClientDetailPage } from './ClientDetailPage';

interface Props {
  params: Promise<{ clientSlug: string }>;
}

export default async function ClientPage({ params }: Props) {
  const { clientSlug } = await params;
  const user = await getCurrentUser();

  if (!user) {
    notFound();
  }

  const isAdmin = user.role === 'admin';

  // Initial data fetch for SSR
  const result = await getClient(clientSlug);

  if (!result.success || !result.data) {
    notFound();
  }

  // Fetch team members for lead display and selection
  let teamMembers: { id: string; name: string | null; email: string; avatarUrl: string | null }[] = [];
  const usersResult = await listAssignableUsers(undefined, { includeContractors: true });
  if (usersResult.success && usersResult.users) {
    teamMembers = usersResult.users;
  }

  return (
    <ClientDetailPage
      clientSlug={clientSlug}
      initialData={result.data}
      isAdmin={isAdmin}
      teamMembers={teamMembers}
    />
  );
}
