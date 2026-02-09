import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/auth/session';
import { NewClientPage } from './NewClientPage';

export default async function ClientsNewPage() {
  try {
    await requireAdmin();
  } catch {
    redirect('/my-tasks');
  }

  return <NewClientPage />;
}
