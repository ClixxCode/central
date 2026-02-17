import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { ProfilePageClient } from './ProfilePageClient';

export default async function ProfilePage() {
  const session = await auth();
  
  if (!session?.user?.id) {
    redirect('/login');
  }

  // Fetch user details
  const user = await db.query.users.findFirst({
    where: eq(users.id, session.user.id),
  });

  if (!user) {
    redirect('/login');
  }

  return (
    <ProfilePageClient
      user={{
        id: user.id,
        name: user.name,
        email: user.email,
        avatarUrl: user.avatarUrl,
      }}
    />
  );
}
