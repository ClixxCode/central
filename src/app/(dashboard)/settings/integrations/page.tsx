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
      <div>
        <h2 className="text-lg font-semibold">Integrations</h2>
        <p className="text-sm text-muted-foreground">
          Connect third-party services to enhance your workflow.
        </p>
      </div>
      <CalendarConnectionCard />
      <ExtensionTokenCard />
    </div>
  );
}
