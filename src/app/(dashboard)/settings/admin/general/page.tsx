import { Metadata } from 'next';
import { GeneralSettingsPageClient } from './GeneralSettingsPageClient';

export const metadata: Metadata = {
  title: 'General | Central',
};

export default async function AdminGeneralPage() {
  return <GeneralSettingsPageClient />;
}
