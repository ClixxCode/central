import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/session';
import { NewRollupForm } from './NewRollupForm';

export default async function NewRollupPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/login');
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Create Rollup Board</h1>
        <p className="text-sm text-muted-foreground">
          Aggregate tasks from multiple boards into a single view
        </p>
      </div>

      {/* Form */}
      <NewRollupForm />
    </div>
  );
}
