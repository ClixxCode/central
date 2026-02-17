import { Metadata } from 'next';
import { StatusesSectionsPageClient } from '@/app/(dashboard)/settings/statuses-sections/StatusesSectionsPageClient';

export const metadata: Metadata = {
  title: 'Statuses & Sections | Central',
};

export default async function AdminStatusesPage() {
  // Admin check is handled by the layout
  return <StatusesSectionsPageClient />;
}
