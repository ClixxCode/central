import { Metadata } from 'next';
import { CalendarConnectionCard } from '@/components/calendar/CalendarConnectionCard';
import { ExtensionTokenCard } from '@/components/extension/ExtensionTokenCard';

export const metadata: Metadata = {
  title: 'Integrations | Central',
  description: 'Manage your third-party integrations',
};

export default function IntegrationsPage() {
  return (
    <div className="space-y-6">
      <CalendarConnectionCard />
      <ExtensionTokenCard />
    </div>
  );
}
