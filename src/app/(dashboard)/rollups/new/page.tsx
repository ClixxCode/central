import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/session';
import { NewRollupForm } from './NewRollupForm';

export default async function NewRollupPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/login');
  }

  return (
    <div className="mx-auto max-w-2xl">
      <NewRollupForm />
    </div>
  );
}
