'use client';

import { useCallback, useEffect, useState } from 'react';
import { Bot, Check, Copy, Loader2, Plus, RefreshCw, Shield, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  createStaticOAuthClient,
  listOAuthConnections,
  listStaticOAuthClients,
  revokeOAuthConnection,
  revokeStaticOAuthClient,
} from '@/lib/actions/oauth-clients';

type Connection = Awaited<ReturnType<typeof listOAuthConnections>>['grants'][number];
type StaticClient = Awaited<ReturnType<typeof listStaticOAuthClients>>['clients'][number];

function formatDate(value: Date | null) {
  return value ? new Date(value).toLocaleString() : 'Never';
}

export function McpIntegrationCard({ isAdmin, mcpUrl }: { isAdmin: boolean; mcpUrl: string }) {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [clients, setClients] = useState<StaticClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState('Claude');
  const [redirectUris, setRedirectUris] = useState('https://claude.ai/api/mcp/auth_callback');
  const [revealed, setRevealed] = useState<{ clientId: string; clientSecret: string } | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [connectionResult, clientResult] = await Promise.all([
        listOAuthConnections(),
        isAdmin ? listStaticOAuthClients() : Promise.resolve(null),
      ]);
      setConnections(connectionResult.grants);
      if (clientResult) setClients(clientResult.clients);
    } finally {
      setLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    void load();
  }, [load]);

  const copy = async (label: string, value: string) => {
    await navigator.clipboard.writeText(value);
    setCopied(label);
    toast.success('Copied to clipboard');
    setTimeout(() => setCopied(null), 1500);
  };

  const createClient = async () => {
    setBusy(true);
    const result = await createStaticOAuthClient({
      name,
      redirectUris: redirectUris.split(/\n|,/).map((value) => value.trim()).filter(Boolean),
    });
    setBusy(false);
    if (!result.success) return toast.error(result.error);
    setRevealed({ clientId: result.clientId, clientSecret: result.clientSecret });
    toast.success('OAuth client created');
    await load();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bot className="h-5 w-5" />
          AI assistants (MCP)
        </CardTitle>
        <CardDescription>
          Connect Claude or another remote MCP client with your own Central permissions.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="rounded-md border bg-muted/30 p-3">
          <p className="text-sm font-medium">Remote MCP URL</p>
          <div className="mt-2 flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded bg-background px-2 py-1 text-xs">{mcpUrl}</code>
            <Button
              size="sm"
              variant="outline"
              aria-label="Copy remote MCP URL"
              onClick={() => copy('url', mcpUrl)}
            >
              {copied === 'url' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Add this URL as a custom connector. Compatible clients will discover OAuth automatically.
          </p>
        </div>

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium">Connected applications</h3>
              <p className="text-xs text-muted-foreground">Revocation disconnects the application immediately.</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              aria-label="Refresh connected applications"
              onClick={() => void load()}
              disabled={loading}
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
          {loading ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading…</p>
          ) : connections.length === 0 ? (
            <p className="text-sm text-muted-foreground">No active MCP connections.</p>
          ) : (
            <div className="space-y-2">
              {connections.map((connection) => (
                <div key={connection.id} className="flex items-center justify-between rounded-md border p-3">
                  <div>
                    <p className="text-sm font-medium">{connection.clientName}</p>
                    <p className="text-xs text-muted-foreground">
                      {connection.scopes.join(', ')} · Last used {formatDate(connection.lastUsedAt)}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label={`Revoke ${connection.clientName}`}
                    onClick={async () => {
                      const response = await revokeOAuthConnection(connection.id);
                      if (!response.success) return toast.error(response.error);
                      toast.success('Connection revoked');
                      await load();
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </section>

        {isAdmin && (
          <section className="space-y-4 border-t pt-5">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4" />
              <h3 className="text-sm font-medium">Static OAuth clients</h3>
            </div>
            <p className="text-xs text-muted-foreground">
              Create credentials for clients whose advanced settings require a client ID and secret.
            </p>
            {revealed && (
              <div className="space-y-2 rounded-md border border-amber-500/30 bg-amber-500/5 p-3">
                <p className="text-sm font-medium">Copy this secret now. It will not be shown again.</p>
                {(['clientId', 'clientSecret'] as const).map((field) => (
                  <div key={field} className="flex items-center gap-2">
                    <span className="w-20 text-xs text-muted-foreground">{field === 'clientId' ? 'Client ID' : 'Secret'}</span>
                    <code className="min-w-0 flex-1 truncate rounded bg-background px-2 py-1 text-xs">{revealed[field]}</code>
                    <Button
                      size="sm"
                      variant="outline"
                      aria-label={`Copy ${field === 'clientId' ? 'client ID' : 'client secret'}`}
                      onClick={() => copy(field, revealed[field])}
                    >
                      {copied === field ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                ))}
              </div>
            )}
            <div className="grid gap-2 sm:grid-cols-2">
              <Input
                aria-label="Client name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Client name"
              />
              <Input
                aria-label="OAuth redirect URI"
                value={redirectUris}
                onChange={(event) => setRedirectUris(event.target.value)}
                placeholder="OAuth redirect URI"
              />
            </div>
            <Button size="sm" onClick={createClient} disabled={busy || !name.trim() || !redirectUris.trim()}>
              {busy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Plus className="mr-1 h-4 w-4" />}
              Create OAuth client
            </Button>
            {clients.length > 0 && (
              <div className="space-y-2">
                {clients.map((client) => (
                  <div key={client.id} className="flex items-center justify-between rounded-md border p-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{client.clientName} {!client.active && <span className="text-muted-foreground">(revoked)</span>}</p>
                      <p className="truncate text-xs text-muted-foreground">{client.clientId}</p>
                    </div>
                    {client.active && (
                      <Button
                        size="sm"
                        variant="ghost"
                        aria-label={`Revoke ${client.clientName}`}
                        onClick={async () => {
                          const response = await revokeStaticOAuthClient(client.clientId);
                          if (!response.success) return toast.error(response.error);
                          toast.success('OAuth client revoked');
                          await load();
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </CardContent>
    </Card>
  );
}
