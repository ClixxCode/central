import { Metadata } from 'next';
import { CalendarConnectionCard } from '@/components/calendar/CalendarConnectionCard';
import { ExtensionTokenCard } from '@/components/extension/ExtensionTokenCard';
import { McpIntegrationCard } from '@/components/extension/McpIntegrationCard';
import { requireAuth } from '@/lib/auth/session';
import { mcpResourceUrl } from '@/lib/oauth/config';

export const metadata: Metadata = {
  title: 'Integrations | Central',
  description: 'Manage your third-party integrations',
};

export default async function IntegrationsPage() {
  const user = await requireAuth();
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Integrations</h2>
        <p className="text-sm text-muted-foreground">
          Connect third-party services to enhance your workflow.
        </p>
      </div>
      <CalendarConnectionCard />
      <McpIntegrationCard isAdmin={user.role === 'admin'} mcpUrl={mcpResourceUrl()} />
      <ExtensionTokenCard />
    </div>
  );
}
