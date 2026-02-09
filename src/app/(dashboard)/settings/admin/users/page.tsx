import { Metadata } from 'next';
import { UsersPageClient } from '@/app/(dashboard)/settings/users/UsersPageClient';

export const metadata: Metadata = {
  title: 'User Management | Central',
};

export default async function AdminUsersPage() {
  // Admin check is handled by the layout
  return <UsersPageClient />;
}
