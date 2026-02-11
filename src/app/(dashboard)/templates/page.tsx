import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/session';
import { TemplatesPageClient } from './TemplatesPageClient';

export default async function TemplatesPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/login');
  }

  return <TemplatesPageClient isAdmin={user.role === 'admin'} />;
}
