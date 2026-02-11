import { Metadata } from 'next';
import { ArchiveSettingsPageClient } from './ArchiveSettingsPageClient';

export const metadata: Metadata = {
  title: 'Archive | Central',
};

export default async function AdminArchivePage() {
  return <ArchiveSettingsPageClient />;
}
