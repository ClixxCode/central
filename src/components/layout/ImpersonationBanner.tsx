'use client';

import { useTransition } from 'react';
import { Eye, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { stopImpersonation } from '@/lib/actions/impersonation';

interface ImpersonationBannerProps {
  userName?: string;
  userEmail?: string;
}

export function ImpersonationBanner({ userName, userEmail }: ImpersonationBannerProps) {
  const [isPending, startTransition] = useTransition();

  const displayName = userName || userEmail || 'Unknown user';

  const handleStop = () => {
    startTransition(async () => {
      try {
        await stopImpersonation();
      } catch {
        // stopImpersonation calls redirect, which throws in Next.js
        // Fall back to manual navigation
        window.location.href = '/settings/admin/users';
      }
    });
  };

  return (
    <div className="bg-amber-500 text-amber-950 px-4 py-2 flex items-center justify-center gap-3 text-sm font-medium shrink-0">
      <Eye className="size-4" />
      <span>
        Viewing as <strong>{displayName}</strong>
      </span>
      <Button
        variant="outline"
        size="sm"
        className="h-7 bg-amber-600/20 border-amber-700/30 text-amber-950 hover:bg-amber-600/40 hover:text-amber-950"
        onClick={handleStop}
        disabled={isPending}
      >
        <X className="size-3.5 mr-1" />
        Stop Impersonating
      </Button>
    </div>
  );
}
