import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Plus, Layers } from 'lucide-react';
import { getCurrentUser } from '@/lib/auth/session';
import { listRollupBoards } from '@/lib/actions/rollups';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default async function RollupsPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/login');
  }

  const result = await listRollupBoards();
  const rollups = result.success ? result.data ?? [] : [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Rollup Boards</h1>
          <p className="text-sm text-muted-foreground">
            Aggregate tasks from multiple boards into a single view
          </p>
        </div>
        <Button asChild>
          <Link href="/rollups/new">
            <Plus className="mr-2 size-4" />
            New Rollup
          </Link>
        </Button>
      </div>

      {/* Rollup List */}
      {rollups.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Layers className="size-12 text-muted-foreground/50" />
            <h3 className="mt-4 text-lg font-medium">No rollup boards yet</h3>
            <p className="mt-2 text-sm text-muted-foreground text-center max-w-md">
              Create a rollup board to aggregate tasks from multiple boards into a single view.
              This is useful for seeing all your tasks across different clients or projects.
            </p>
            <Button asChild className="mt-6">
              <Link href="/rollups/new">
                <Plus className="mr-2 size-4" />
                Create your first rollup
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rollups.map((rollup) => (
            <Link key={rollup.id} href={`/rollups/${rollup.id}`}>
              <Card className="h-full transition-colors hover:border-primary/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Layers className="size-5" />
                    {rollup.name}
                  </CardTitle>
                  <CardDescription>
                    {rollup.sourceCount} {rollup.sourceCount === 1 ? 'board' : 'boards'}
                  </CardDescription>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
