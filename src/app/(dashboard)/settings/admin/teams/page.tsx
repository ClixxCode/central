import { Metadata } from 'next';
import { TeamsPageClient } from '@/app/(dashboard)/settings/teams/TeamsPageClient';

export const metadata: Metadata = {
  title: 'Team Management | Central',
};

export default async function AdminTeamsPage() {
  // Admin check is handled by the layout
  return <TeamsPageClient />;
}
