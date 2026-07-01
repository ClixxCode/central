'use client';

import * as React from 'react';

type RegisterTopShellToolbar = (toolbar: React.ReactNode) => () => void;

const TopShellToolbarContext =
  React.createContext<RegisterTopShellToolbar | null>(null);

interface TopShellToolbarProviderProps {
  children: React.ReactNode;
  registerToolbar: RegisterTopShellToolbar;
}

export function TopShellToolbarProvider({
  children,
  registerToolbar,
}: TopShellToolbarProviderProps) {
  return (
    <TopShellToolbarContext.Provider value={registerToolbar}>
      {children}
    </TopShellToolbarContext.Provider>
  );
}

export function useTopShellToolbar(toolbar: React.ReactNode | null) {
  const registerToolbar = React.useContext(TopShellToolbarContext);

  React.useEffect(() => {
    if (!toolbar || !registerToolbar) {
      return;
    }

    return registerToolbar(toolbar);
  }, [toolbar, registerToolbar]);
}
