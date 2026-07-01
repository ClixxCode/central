'use client';

import * as React from 'react';
import type { TopShellContext } from './shell-context';

type RegisterTopShellContextOverride = (context: TopShellContext) => () => void;

const TopShellContextOverrideContext =
  React.createContext<RegisterTopShellContextOverride | null>(null);

interface TopShellContextOverrideProviderProps {
  children: React.ReactNode;
  registerOverride: RegisterTopShellContextOverride;
}

export function TopShellContextOverrideProvider({
  children,
  registerOverride,
}: TopShellContextOverrideProviderProps) {
  return (
    <TopShellContextOverrideContext.Provider value={registerOverride}>
      {children}
    </TopShellContextOverrideContext.Provider>
  );
}

export function useTopShellContextOverride(context: TopShellContext | null) {
  const registerOverride = React.useContext(TopShellContextOverrideContext);

  React.useEffect(() => {
    if (!context || !registerOverride) {
      return;
    }

    return registerOverride(context);
  }, [context, registerOverride]);
}
