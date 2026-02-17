import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/session';
import { checkIsContractor } from '@/lib/actions/clients';
import { NewClientPage } from './NewClientPage';

export default async function ClientsNewPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login');
  }

  const isContractor = await checkIsContractor(user.id);
  if (isContractor) {
    redirect('/my-tasks');
  }

  return <NewClientPage />;
}
