'use client';

import { useState } from 'react';
import { Puzzle, Copy, Check, Loader2, Trash2, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  useExtensionTokens,
  useCreateExtensionToken,
  useRevokeExtensionToken,
} from '@/lib/hooks';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

export function ExtensionTokenCard() {
  const { data: tokens, isLoading } = useExtensionTokens();
  const createMutation = useCreateExtensionToken();
  const revokeMutation = useRevokeExtensionToken();

  const [newTokenName, setNewTokenName] = useState('');
  const [revealedToken, setRevealedToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleGenerate = () => {
    createMutation.mutate(newTokenName || undefined, {
      onSuccess: (token) => {
        setRevealedToken(token);
        setNewTokenName('');
        toast.success('Token created');
      },
      onError: () => {
        toast.error('Failed to create token');
      },
    });
  };

  const handleCopy = async () => {
    if (!revealedToken) return;
    await navigator.clipboard.writeText(revealedToken);
    setCopied(true);
    toast.success('Token copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRevoke = (tokenId: string) => {
    revokeMutation.mutate(tokenId, {
      onSuccess: () => {
        toast.success('Token revoked');
      },
      onError: () => {
        toast.error('Failed to revoke token');
      },
    });
  };

  const formatDate = (date: Date | null) => {
    if (!date) return 'Never';
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Puzzle className="h-5 w-5" />
          API Tokens
        </CardTitle>
        <CardDescription>
          Generate API tokens for extensions and integrations (Chrome extension, Raycast, etc.).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Revealed token banner */}
        {revealedToken && (
          <div className="rounded-md border bg-muted p-3 space-y-2">
            <p className="text-sm font-medium">
              Copy this token now — it won&apos;t be shown again.
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 truncate rounded bg-background px-2 py-1 text-xs font-mono">
                {revealedToken}
              </code>
              <Button variant="outline" size="sm" onClick={handleCopy}>
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setRevealedToken(null)}>
              Dismiss
            </Button>
          </div>
        )}

        {/* Generate new token */}
        <div className="flex items-center gap-2">
          <Input
            placeholder="Token name (optional)"
            value={newTokenName}
            onChange={(e) => setNewTokenName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
            className="max-w-[240px]"
          />
          <Button
            size="sm"
            onClick={handleGenerate}
            disabled={createMutation.isPending}
          >
            {createMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-1" />
            ) : (
              <Plus className="h-4 w-4 mr-1" />
            )}
            Generate Token
          </Button>
        </div>

        {/* Token list */}
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading tokens...
          </div>
        ) : tokens && tokens.length > 0 ? (
          <div className="space-y-2">
            {tokens.map((token) => (
              <div
                key={token.id}
                className="flex items-center justify-between rounded-md border px-3 py-2"
              >
                <div className="space-y-0.5">
                  <p className="text-sm font-medium">{token.name || 'Unnamed token'}</p>
                  <p className="text-xs text-muted-foreground">
                    Created {formatDate(token.createdAt)}
                    {' · '}
                    Last used {formatDate(token.lastUsedAt)}
                  </p>
                </div>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={revokeMutation.isPending}
                    >
                      <Trash2 className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Revoke token?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Any extension using this token will be disconnected immediately.
                        This cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={() => handleRevoke(token.id)}>
                        Revoke
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No active tokens.</p>
        )}
      </CardContent>
    </Card>
  );
}
