import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/session';

export default async function Home() {
  const user = await getCurrentUser();

  if (user) {
    // Redirect authenticated users to their personal task view
    redirect('/my-tasks');
  } else {
    // Redirect unauthenticated users to login
    redirect('/login');
  }
}
