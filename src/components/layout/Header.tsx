'use client';

import type { TopShellContext } from './shell-context';
import { TopShellHeader } from './TopShellHeader';

interface HeaderProps {
  user: {
    name: string | null;
    email: string;
    image: string | null;
  };
  isAdmin?: boolean;
  onSignOut: () => void;
  shellContext?: TopShellContext;
}

export function Header({ user, isAdmin = false, onSignOut, shellContext }: HeaderProps) {
  return (
    <TopShellHeader
      user={user}
      isAdmin={isAdmin}
      onSignOut={onSignOut}
      shellContext={shellContext}
    />
  );
}
