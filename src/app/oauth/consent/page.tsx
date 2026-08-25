import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { ShieldCheck } from 'lucide-react';
import { getRealUser } from '@/lib/auth/session';
import {
  OAUTH_TRANSACTION_COOKIE,
  type AuthorizationTransaction,
} from '@/lib/oauth/authorization';
import { verifyTransaction } from '@/lib/oauth/crypto';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export const dynamic = 'force-dynamic';

export default async function OAuthConsentPage() {
  const user = await getRealUser();
  if (!user) redirect('/login?callbackUrl=/oauth/consent');
  const cookieStore = await cookies();
  const transaction = verifyTransaction<AuthorizationTransaction>(
    cookieStore.get(OAUTH_TRANSACTION_COOKIE)?.value
  );
  if (!transaction) redirect('/settings/integrations');

  return (
    <main className="min-h-screen bg-muted/40 px-4 py-12">
      <Card className="mx-auto max-w-lg">
        <CardHeader>
          <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
            <ShieldCheck className="h-5 w-5 text-primary" />
          </div>
          <CardTitle>Connect {transaction.clientName}</CardTitle>
          <CardDescription>
            Signed in as {user.email}. This application is requesting access to Central.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="rounded-md border p-4">
            <p className="text-sm font-medium">Requested permissions</p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
              <li>Read boards, tasks, assignees, and comments</li>
              {transaction.scopes.includes('central:write') && (
                <li>Create and update tasks, archive tasks, and add comments</li>
              )}
            </ul>
          </div>
          <p className="text-xs text-muted-foreground">
            The application receives only the access of your Central account. You can revoke it at any time in Integrations settings.
          </p>
          <form action="/oauth/authorize" method="post" className="flex justify-end gap-3">
            <input type="hidden" name="csrf" value={transaction.csrf} />
            <Button type="submit" name="decision" value="deny" variant="outline">
              Cancel
            </Button>
            <Button type="submit" name="decision" value="approve">
              Allow access
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
