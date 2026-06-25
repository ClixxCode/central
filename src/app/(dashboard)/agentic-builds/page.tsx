import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/session';
import { AgenticBuildsBoard } from '@/components/builds/AgenticBuildsBoard';

export const metadata = {
  title: 'Agentic Website Builds',
};

export default async function AgenticBuildsPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  return <AgenticBuildsBoard />;
}
